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

export function OperationsList() {
  const { provider, signer, account } = useEthereum();
  const [ops, setOps] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setOps(
        raw.map((o) => ({
          id: Number(o.id),
          creator: o.creator,
          counterparty: o.counterparty,
          tokenA: o.tokenA,
          tokenB: o.tokenB,
          amountA: o.amountA,
          amountB: o.amountB,
          status: Number(o.status)
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar operaciones");
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function complete(op: Operation) {
    if (!signer) return;
    try {
      const tokenB = new Contract(op.tokenB, ERC20_ABI, signer);
      const owner = await signer.getAddress();
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
      setError(e instanceof Error ? e.message : "Error al completar operación");
    }
  }

  async function cancel(op: Operation) {
    if (!signer) return;
    try {
      const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
      const tx = await escrow.cancelOperation(op.id);
      await tx.wait();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cancelar operación");
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
        {ops.map((o) => {
          const isCreator = account?.toLowerCase() === o.creator.toLowerCase();
          const active = o.status === 0;
          const settled = o.counterparty !== ZERO;
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
                    <span className="text-white/50">de {o.tokenA.slice(0, 10)}…</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-white/40">Pide</div>
                  <div className="font-mono">
                    {o.amountB.toString()}{" "}
                    <span className="text-white/50">de {o.tokenB.slice(0, 10)}…</span>
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
