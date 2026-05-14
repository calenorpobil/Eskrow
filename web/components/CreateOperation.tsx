"use client";

import { Contract, parseUnits } from "ethers";
import { useState } from "react";
import { ERC20_ABI, ESCROW_ABI, ESCROW_ADDRESS } from "@/lib/contracts";
import { useEthereum } from "@/lib/ethereum";

const inputCls =
  "w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30";
const btnPrimary =
  "rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60";

export function CreateOperation() {
  const { signer } = useEthereum();
  const [tokenA, setTokenA] = useState("");
  const [amountA, setAmountA] = useState("");
  const [tokenB, setTokenB] = useState("");
  const [amountB, setAmountB] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setStatus(null);
    if (!signer) {
      setStatus("Conecta tu wallet primero");
      return;
    }
    if (!ESCROW_ADDRESS) {
      setStatus("Falta NEXT_PUBLIC_ESCROW_ADDRESS en .env.local");
      return;
    }
    try {
      setBusy(true);

      const offered = new Contract(tokenA, ERC20_ABI, signer);
      const decimalsA = Number(await offered.decimals());
      const amountAWei = parseUnits(amountA, decimalsA);

      const requested = new Contract(tokenB, ERC20_ABI, signer);
      const decimalsB = Number(await requested.decimals());
      const amountBWei = parseUnits(amountB, decimalsB);

      setStatus("Aprobando token…");
      const approveTx = await offered.approve(ESCROW_ADDRESS, amountAWei);
      await approveTx.wait();

      setStatus("Creando operación…");
      const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
      const tx = await escrow.createOperation(tokenA, tokenB, amountAWei, amountBWei);
      const receipt = await tx.wait();
      setStatus(`Operación creada en tx ${receipt?.hash}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Error al crear la operación");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Token a entregar (tokenA)">
          <input value={tokenA} placeholder="0x…" onChange={(e) => setTokenA(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Monto a entregar">
          <input value={amountA} placeholder="0.0" onChange={(e) => setAmountA(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Token a recibir (tokenB)">
          <input value={tokenB} placeholder="0x…" onChange={(e) => setTokenB(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Monto a recibir">
          <input value={amountB} placeholder="0.0" onChange={(e) => setAmountB(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <p className="text-xs text-white/40">
        Cualquier cuenta podrá completar la operación enviando el monto solicitado del tokenB.
      </p>
      <button type="button" onClick={submit} disabled={busy} className={btnPrimary}>
        {busy ? "Enviando…" : "Crear operación"}
      </button>
      {status ? (
        <p className="rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 text-sm text-white/80">{status}</p>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-white/50">{label}</span>
      {children}
    </label>
  );
}
