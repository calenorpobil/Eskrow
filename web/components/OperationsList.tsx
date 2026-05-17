"use client";

import { Contract, MaxUint256, formatUnits } from "ethers";
import { useCallback, useEffect, useState } from "react";
import { ERC20_ABI, ESCROW_ABI, ESCROW_ADDRESS } from "@/lib/contracts";
import { useEthereum } from "@/lib/ethereum";
import { parseReadError, parseTxError } from "@/lib/errors";

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

export function OperationsList() {
  const { provider, signer, account } = useEthereum();
  const [ops, setOps] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opErrors, setOpErrors] = useState<Record<number, string>>({});
  const [tokenMeta, setTokenMeta] = useState<Record<string, { symbol: string; decimals: number }>>({});

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
      let raw: Array<{
        id: bigint;
        creator: string;
        counterparty: string;
        tokenA: string;
        tokenB: string;
        amountA: bigint;
        amountB: bigint;
        status: bigint;
      }> = [];
      try {
        raw = (await escrow.getAllOperations()) as typeof raw;
      } catch (readErr) {
        setOps([]);
        setError(parseReadError(readErr, "No se pudieron cargar las operaciones"));
        return;
      }
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
      setTokenMeta((prev) => {
        const missing = unique.filter((addr) => !(addr in prev));
        if (missing.length === 0) return prev;
        void Promise.all(
          missing.map(async (addr) => {
            try {
              const erc20 = new Contract(addr, ERC20_ABI, provider);
              const [sym, dec] = await Promise.all([
                erc20.symbol() as Promise<string>,
                erc20.decimals() as Promise<bigint>
              ]);
              return [addr, { symbol: sym, decimals: Number(dec) }] as const;
            } catch {
              return [addr, { symbol: "", decimals: 18 }] as const;
            }
          })
        ).then((entries) => {
          setTokenMeta((curr) => {
            const next = { ...curr };
            for (const [addr, meta] of entries) next[addr] = meta;
            return next;
          });
        });
        return prev;
      });
    } catch (e) {
      setError(parseReadError(e, "Error al cargar operaciones"));
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
          const metaA = tokenMeta[o.tokenA.toLowerCase()];
          const metaB = tokenMeta[o.tokenB.toLowerCase()];
          const symA = metaA?.symbol;
          const symB = metaB?.symbol;
          const labelA = symA ? `${symA} (${o.tokenA.slice(0, 6)}…)` : `${o.tokenA.slice(0, 10)}…`;
          const labelB = symB ? `${symB} (${o.tokenB.slice(0, 6)}…)` : `${o.tokenB.slice(0, 10)}…`;
          const amountADisplay = metaA ? formatUnits(o.amountA, metaA.decimals) : o.amountA.toString();
          const amountBDisplay = metaB ? formatUnits(o.amountB, metaB.decimals) : o.amountB.toString();
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
                    {amountADisplay}{" "}
                    <span className="text-white/50">de {labelA}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-white/40">Pide</div>
                  <div className="font-mono">
                    {amountBDisplay}{" "}
                    <span className="text-white/50">de {labelB}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-white/40">Creador</div>
                  <div className="font-mono text-white/70" title={o.creator}>
                    {`${o.creator.slice(0, 6)}…${o.creator.slice(-4)}`}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-white/40">Contraparte</div>
                  <div className="font-mono text-white/70" title={settled ? o.counterparty : undefined}>
                    {settled ? (
                      `${o.counterparty.slice(0, 6)}…${o.counterparty.slice(-4)}`
                    ) : (
                      <span className="text-white/40">(abierta)</span>
                    )}
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
