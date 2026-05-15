"use client";

import { Contract, formatUnits, isAddress } from "ethers";
import { useState } from "react";
import { CHAIN_ID, ERC20_ABI } from "@/lib/contracts";
import { useEthereum } from "@/lib/ethereum";

const inputCls =
  "w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30";
const btnPrimary =
  "rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60";

export function BalanceDebug() {
  const { provider, account, chainId } = useEthereum();
  const [token, setToken] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function check() {
    setResult(null);
    if (!provider || !account) {
      setResult("Conecta tu wallet primero");
      return;
    }
    const tokenAddress = token.trim();
    if (!isAddress(tokenAddress)) {
      setResult("Dirección de token inválida");
      return;
    }
    if (chainId !== CHAIN_ID) {
      setResult(`Estás en chain ${chainId}, cambia a chain ${CHAIN_ID} en MetaMask`);
      return;
    }
    try {
      setLoading(true);
      const code = await provider.getCode(tokenAddress);
      if (!code || code === "0x") {
        setResult(
          `No hay contrato en ${tokenAddress} en chain ${chainId}. Verifica la dirección y la red.`
        );
        return;
      }
      const erc20 = new Contract(tokenAddress, ERC20_ABI, provider);
      const [symbol, decimals, balance] = await Promise.all([
        erc20.symbol() as Promise<string>,
        erc20.decimals() as Promise<bigint>,
        erc20.balanceOf(account) as Promise<bigint>
      ]);
      setResult(`${formatUnits(balance, Number(decimals))} ${symbol}`);
    } catch (e) {
      console.error("[BalanceDebug] check failed", e);
      const msg = e instanceof Error ? e.message : "Error al leer balance";
      if (msg.includes("could not decode result data")) {
        setResult("La dirección no parece un token ERC20 estándar (symbol/decimals devolvieron vacío).");
      } else {
        setResult(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={token}
          placeholder="Dirección del token (0x…)"
          onChange={(e) => setToken(e.target.value)}
          className={inputCls}
        />
        <button type="button" onClick={check} disabled={loading || !token} className={btnPrimary}>
          {loading ? "Leyendo…" : "Consultar"}
        </button>
      </div>
      {result ? (
        <p className="rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 text-sm text-white/90">
          Balance: <span className="font-mono text-emerald-300">{result}</span>
        </p>
      ) : null}
    </div>
  );
}
