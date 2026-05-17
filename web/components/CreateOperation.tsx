"use client";

import { Contract, parseUnits } from "ethers";
import { useCallback, useEffect, useState } from "react";
import { ERC20_ABI, ESCROW_ABI, ESCROW_ADDRESS } from "@/lib/contracts";
import { useEthereum } from "@/lib/ethereum";
import { parseReadError, parseTxError } from "@/lib/errors";

const inputCls =
  "w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30";
const btnPrimary =
  "rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60";

type TokenInfo = {
  address: string;
  symbol: string;
  decimals: number;
};

export function CreateOperation() {
  const { signer, provider } = useEthereum();
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [tokenA, setTokenA] = useState("");
  const [amountA, setAmountA] = useState("");
  const [tokenB, setTokenB] = useState("");
  const [amountB, setAmountB] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadTokens = useCallback(
    async (signal?: { cancelled: boolean }) => {
      const runner = signer ?? provider;
      if (!runner || !ESCROW_ADDRESS) return;
      try {
        setLoadingTokens(true);
        const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, runner);
        let addresses: string[] = [];
        try {
          addresses = (await escrow.getAllowedTokens()) as string[];
        } catch (readErr) {
          if (!signal?.cancelled) {
            setTokens([]);
            setError(parseReadError(readErr, "No se pudieron cargar los tokens permitidos"));
          }
          return;
        }
        const infos = await Promise.all(
          addresses.map(async (address) => {
            try {
              const erc20 = new Contract(address, ERC20_ABI, runner);
              const [symbol, decimals] = await Promise.all([erc20.symbol(), erc20.decimals()]);
              return { address, symbol: String(symbol), decimals: Number(decimals) };
            } catch {
              return { address, symbol: `${address.slice(0, 6)}…${address.slice(-4)}`, decimals: 18 };
            }
          })
        );
        if (!signal?.cancelled) setTokens(infos);
      } catch (e) {
        if (!signal?.cancelled) {
          setTokens([]);
          setError(parseReadError(e, "No se pudieron cargar los tokens permitidos"));
        }
      } finally {
        if (!signal?.cancelled) setLoadingTokens(false);
      }
    },
    [signer, provider]
  );

  useEffect(() => {
    const signal = { cancelled: false };
    void loadTokens(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [loadTokens]);

  useEffect(() => {
    const runner = signer ?? provider;
    if (!runner || !ESCROW_ADDRESS) return;
    const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, runner);
    const onTokenAdded = () => {
      void loadTokens();
    };
    escrow.on("TokenAdded", onTokenAdded);
    return () => {
      void escrow.off("TokenAdded", onTokenAdded);
    };
  }, [signer, provider, loadTokens]);

  async function submit() {
    setStatus(null);
    setError(null);
    if (!signer) {
      setError("Conecta tu wallet primero");
      return;
    }
    if (!ESCROW_ADDRESS) {
      setError("Falta NEXT_PUBLIC_ESCROW_ADDRESS en .env.local");
      return;
    }
    if (!tokenA || !tokenB) {
      setError("Selecciona ambos tokens");
      return;
    }
    if (tokenA.toLowerCase() === tokenB.toLowerCase()) {
      setError("Token A y Token B deben ser diferentes");
      return;
    }
    if (!amountA || !amountB || Number(amountA) <= 0 || Number(amountB) <= 0) {
      setError("Ingresa montos válidos mayores a 0");
      return;
    }
    try {
      setBusy(true);

      const offered = new Contract(tokenA, ERC20_ABI, signer);
      const decimalsA = tokens.find((t) => t.address === tokenA)?.decimals ?? Number(await offered.decimals());
      const amountAWei = parseUnits(amountA, decimalsA);

      const decimalsB = tokens.find((t) => t.address === tokenB)?.decimals ?? Number(await new Contract(tokenB, ERC20_ABI, signer).decimals());
      const amountBWei = parseUnits(amountB, decimalsB);

      setStatus("Aprobando token…");
      const approveTx = await offered.approve(ESCROW_ADDRESS, amountAWei);
      await approveTx.wait();

      setStatus("Creando operación…");
      const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
      const tx = await escrow.createOperation(tokenA, tokenB, amountAWei, amountBWei);
      const receipt = await tx.wait();
      setStatus(`Operación creada en tx ${receipt?.hash}. Recargando…`);
      setTimeout(() => {
        if (typeof window !== "undefined") window.location.reload();
      }, 1200);
    } catch (e) {
      setError(parseTxError(e, "Error al crear la operación"));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  const tokenOptions = (excluded: string) =>
    tokens
      .filter((t) => t.address.toLowerCase() !== excluded.toLowerCase())
      .map((t) => (
        <option key={t.address} value={t.address}>
          {t.symbol} — {t.address.slice(0, 6)}…{t.address.slice(-4)}
        </option>
      ));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Token a entregar (tokenA)">
          <select
            value={tokenA}
            onChange={(e) => setTokenA(e.target.value)}
            className={inputCls}
            disabled={loadingTokens || tokens.length === 0}
          >
            <option value="">{loadingTokens ? "Cargando…" : "Selecciona un token"}</option>
            {tokenOptions(tokenB)}
          </select>
        </Field>
        <Field label="Monto a entregar">
          <input
            type="number"
            min="0"
            step="any"
            value={amountA}
            placeholder="0.0"
            onChange={(e) => setAmountA(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Token a recibir (tokenB)">
          <select
            value={tokenB}
            onChange={(e) => setTokenB(e.target.value)}
            className={inputCls}
            disabled={loadingTokens || tokens.length === 0}
          >
            <option value="">{loadingTokens ? "Cargando…" : "Selecciona un token"}</option>
            {tokenOptions(tokenA)}
          </select>
        </Field>
        <Field label="Monto a recibir">
          <input
            type="number"
            min="0"
            step="any"
            value={amountB}
            placeholder="0.0"
            onChange={(e) => setAmountB(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
      {tokens.length === 0 && !loadingTokens ? (
        <p className="text-xs text-amber-300/80">
          No hay tokens permitidos en el contrato. El owner debe agregarlos con addToken().
        </p>
      ) : null}
      <p className="text-xs text-white/40">
        Cualquier cuenta podrá completar la operación enviando el monto solicitado del tokenB.
      </p>
      <button type="button" onClick={submit} disabled={busy || loadingTokens} className={btnPrimary}>
        {busy ? "Enviando…" : "Crear operación"}
      </button>
      {status ? (
        <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
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
