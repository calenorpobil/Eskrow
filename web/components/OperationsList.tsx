"use client";

import { Contract, MaxUint256 } from "ethers";
import { useCallback, useEffect, useState } from "react";
import { ERC20_ABI, ESCROW_ABI, ESCROW_ADDRESS } from "@/lib/contracts";
import { useEthereum } from "@/lib/ethereum";

type Operation = {
  id: number;
  creator: string;
  counterparty: string;
  tokenA: string;
  tokenB: string;
  amountA: bigint;
  amountB: bigint;
  status: number;
};

const STATUS_LABEL = ["Active", "Completed", "Cancelled"];
const STATUS_STYLES: Record<number, string> = {
  0: "bg-emerald-500/20 text-emerald-300",
  1: "bg-indigo-500/20 text-indigo-200",
  2: "bg-rose-500/20 text-rose-300"
};

const btnGhost =
  "rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/90 transition hover:bg-white/10 disabled:opacity-50";
const btnDanger =
  "rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20";

const ZERO = "0x0000000000000000000000000000000000000000";

function parseTxError(e: unknown, fallback: string): string {
  if (typeof e !== "object" || e === null) return fallback;
  const err = e as {
    code?: string | number;
    shortMessage?: string;
    reason?: string;
    message?: string;
    data?: { message?: string };
    info?: { error?: { message?: string } };
  };
  const raw = (
    err.info?.error?.message ??
    err.data?.message ??
    err.reason ??
    err.shortMessage ??
    err.message ??
    ""
  ).toLowerCase();

  if (err.code === "ACTION_REJECTED" || raw.includes("user rejected") || raw.includes("user denied")) {
    return "Transacción rechazada en la wallet.";
  }
  if (raw.includes("insufficient funds")) {
    return "No tienes suficiente ETH para pagar el gas.";
  }
  if (
    raw.includes("erc20: transfer amount exceeds balance") ||
    raw.includes("transfer amount exceeds balance") ||
    raw.includes("insufficient balance")
  ) {
    return "Saldo insuficiente del token requerido para completar la operación.";
  }
  if (
    raw.includes("erc20: insufficient allowance") ||
    raw.includes("insufficient allowance")
  ) {
    return "Approve insuficiente: la wallet no autorizó al contrato a mover los tokens.";
  }
  if (raw.includes("operation not active") || raw.includes("not active")) {
    return "La operación ya no está activa (puede haber sido completada o cancelada).";
  }
  if (raw.includes("only creator") || raw.includes("not creator")) {
    return "Solo el creador puede cancelar esta operación.";
  }
  if (raw.includes("cannot complete own") || raw.includes("own operation")) {
    return "No puedes completar tu propia operación.";
  }
  if (raw.includes("token not allowed")) {
    return "El token utilizado no está permitido en el contrato.";
  }
  if (raw.includes("nonce")) {
    return "Conflicto de nonce: reinicia la wallet o vuelve a intentarlo.";
  }
  if (raw.includes("network") || raw.includes("disconnect") || raw.includes("timeout")) {
    return "Problema de red al enviar la transacción. Intenta de nuevo.";
  }
  if (err.shortMessage) return err.shortMessage;
  if (err.message) return err.message;
  return fallback;
}

export function OperationsList() {
  const { provider, signer, account } = useEthereum();
  const [ops, setOps] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opErrors, setOpErrors] = useState<Record<number, string>>({});
  const [symbols, setSymbols] = useState<Record<string, string>>({});

  const setOpError = (id: number, msg: string | null) =>
    setOpErrors((prev) => {
      const next = { ...prev };
      if (msg) next[id] = msg;
      else delete next[id];
      return next;
    });

  const refresh = useCallback(async () => {
    setError(null);
    if (!provider || !ESCROW_ADDRESS) return;
    try {
      setLoading(true);
      const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, provider);
      const raw = (await escrow.getAllOperations()) as Array<{
        id: bigint;
        creator: string;
        counterparty: string;
        tokenA: string;
        tokenB: string;
        amountA: bigint;
        amountB: bigint;
        status: bigint;
      }>;
      const mapped = raw.map((o) => ({
        id: Number(o.id),
        creator: o.creator,
        counterparty: o.counterparty,
        tokenA: o.tokenA,
        tokenB: o.tokenB,
        amountA: o.amountA,
        amountB: o.amountB,
        status: Number(o.status)
      }));
      setOps(mapped);

      const unique = Array.from(
        new Set(mapped.flatMap((o) => [o.tokenA.toLowerCase(), o.tokenB.toLowerCase()]))
      );
      setSymbols((prev) => {
        const missing = unique.filter((addr) => !(addr in prev));
        if (missing.length === 0) return prev;
        void Promise.all(
          missing.map(async (addr) => {
            try {
              const erc20 = new Contract(addr, ERC20_ABI, provider);
              const sym = (await erc20.symbol()) as string;
              return [addr, sym] as const;
            } catch {
              return [addr, ""] as const;
            }
          })
        ).then((entries) => {
          setSymbols((curr) => {
            const next = { ...curr };
            for (const [addr, sym] of entries) next[addr] = sym;
            return next;
          });
        });
        return prev;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar operaciones");
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function complete(op: Operation) {
    if (!signer) return;
    setOpError(op.id, null);
    try {
      const tokenB = new Contract(op.tokenB, ERC20_ABI, signer);
      const owner = await signer.getAddress();
      const balance = (await tokenB.balanceOf(owner)) as bigint;
      if (balance < op.amountB) {
        setOpError(
          op.id,
          `Saldo insuficiente: necesitas ${op.amountB.toString()} del token ${op.tokenB.slice(0, 10)}… y tienes ${balance.toString()}.`
        );
        return;
      }
      const allowance = (await tokenB.allowance(owner, ESCROW_ADDRESS)) as bigint;
      if (allowance < op.amountB) {
        const approveTx = await tokenB.approve(ESCROW_ADDRESS, MaxUint256);
        await approveTx.wait();
      }
      const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
      const tx = await escrow.completeOperation(op.id);
      await tx.wait();
      await refresh();
    } catch (e) {
      setOpError(op.id, parseTxError(e, "Error al completar operación"));
    }
  }

  async function cancel(op: Operation) {
    if (!signer) return;
    setOpError(op.id, null);
    try {
      const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
      const tx = await escrow.cancelOperation(op.id);
      await tx.wait();
      await refresh();
    } catch (e) {
      setOpError(op.id, parseTxError(e, "Error al cancelar operación"));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/50">
          {ops.length} {ops.length === 1 ? "operación" : "operaciones"}
        </span>
        <button type="button" onClick={refresh} disabled={loading} className={btnGhost}>
          {loading ? "Actualizando…" : "Refrescar"}
        </button>
      </div>
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      {ops.length === 0 && !loading ? (
        <p className="text-sm text-white/40">No hay operaciones todavía.</p>
      ) : null}
      <ul className="space-y-3">
        {[...ops].sort((a, b) => b.id - a.id).map((o) => {
          const isCreator = account?.toLowerCase() === o.creator.toLowerCase();
          const active = o.status === 0;
          const settled = o.counterparty !== ZERO;
          const symA = symbols[o.tokenA.toLowerCase()];
          const symB = symbols[o.tokenB.toLowerCase()];
          const labelA = symA ? `${symA} (${o.tokenA.slice(0, 6)}…)` : `${o.tokenA.slice(0, 10)}…`;
          const labelB = symB ? `${symB} (${o.tokenB.slice(0, 6)}…)` : `${o.tokenB.slice(0, 10)}…`;
          return (
            <li
              key={o.id}
              className="rounded-xl border border-white/10 bg-slate-900/40 p-4 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-white/60">#{o.id}</span>
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[o.status]}`}>
                  {STATUS_LABEL[o.status]}
                </span>
                <span className="ml-auto flex gap-2">
                  {active && !isCreator ? (
                    <button type="button" onClick={() => complete(o)} className={btnGhost}>
                      Completar
                    </button>
                  ) : null}
                  {active && isCreator ? (
                    <button type="button" onClick={() => cancel(o)} className={btnDanger}>
                      Cancelar
                    </button>
                  ) : null}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-white/80 md:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-white/40">Ofrece</div>
                  <div className="font-mono">
                    {o.amountA.toString()}{" "}
                    <span className="text-white/50">de {labelA}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-white/40">Pide</div>
                  <div className="font-mono">
                    {o.amountB.toString()}{" "}
                    <span className="text-white/50">de {labelB}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-white/40">Creador</div>
                  <div className="font-mono text-white/70">{o.creator}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-white/40">Contraparte</div>
                  <div className="font-mono text-white/70">
                    {settled ? o.counterparty : <span className="text-white/40">(abierta)</span>}
                  </div>
                </div>
              </div>
              {opErrors[o.id] ? (
                <p className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  {opErrors[o.id]}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
