"use client";

import { Contract, isAddress } from "ethers";
import { useCallback, useEffect, useState } from "react";
import { ERC20_ABI, ESCROW_ABI, ESCROW_ADDRESS } from "@/lib/contracts";
import { useEthereum } from "@/lib/ethereum";
import { getActiveAccounts } from "@/lib/accounts";
import { airdrop, DEFAULT_AIRDROP_AMOUNT } from "@/lib/airdrop";

type TokenInfo = {
  address: string;
  symbol: string;
};

const inputCls =
  "w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30";
const btnPrimary =
  "rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60";

export function AddToken() {
  const { provider, signer, account } = useEthereum();
  const [address, setAddress] = useState("");
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [owner, setOwner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isOwner = !!account && !!owner && account.toLowerCase() === owner.toLowerCase();

  const loadTokens = useCallback(async () => {
    if (!provider) return;
    try {
      const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, provider);
      const [ownerAddr, list] = await Promise.all([
        escrow.owner() as Promise<string>,
        escrow.getAllowedTokens() as Promise<string[]>
      ]);
      setOwner(ownerAddr);
      const infos = await Promise.all(
        list.map(async (addr) => {
          try {
            const token = new Contract(addr, ERC20_ABI, provider);
            const symbol = (await token.symbol()) as string;
            return { address: addr, symbol };
          } catch {
            return { address: addr, symbol: "?" };
          }
        })
      );
      setTokens(infos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la lista de tokens");
    }
  }, [provider]);

  useEffect(() => {
    void loadTokens();
  }, [loadTokens]);

  async function handleAdd() {
    setError(null);
    setInfo(null);
    if (!signer) {
      setError("Conecta tu wallet primero");
      return;
    }
    if (!isAddress(address)) {
      setError("Dirección inválida");
      return;
    }
    if (!isOwner) {
      setError("Solo el owner del contrato puede agregar tokens");
      return;
    }
    const normalized = address.toLowerCase();
    if (tokens.some((t) => t.address.toLowerCase() === normalized)) {
      setError("Ese token ya está en la lista de permitidos");
      return;
    }
    try {
      setLoading(true);
      if (!provider) {
        setError("Proveedor no disponible");
        return;
      }
      const code = await provider.getCode(address);
      if (!code || code === "0x") {
        setError("La dirección no es un contrato");
        return;
      }
      const token = new Contract(address, ERC20_ABI, provider);
      try {
        const [sym, dec] = await Promise.all([
          token.symbol() as Promise<string>,
          token.decimals() as Promise<number>
        ]);
        if (!sym || typeof dec !== "number" && typeof dec !== "bigint") {
          setError("La dirección no responde como un token ERC20");
          return;
        }
      } catch {
        setError("La dirección no implementa la interfaz ERC20 (symbol/decimals)");
        return;
      }
      const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
      const tx = await escrow.addToken(address);
      setInfo(`Tx enviada: ${tx.hash}`);
      await tx.wait();
      setInfo("Token agregado. Minteando a cuentas activas…");

      const accounts = getActiveAccounts().map((a) => a.address);
      const results = await airdrop(signer, [address], accounts);
      const ok = results.filter((r) => r.ok).length;
      if (ok === results.length) {
        setInfo(
          `Token agregado y minteados ${DEFAULT_AIRDROP_AMOUNT} a ${ok} cuentas activas.`
        );
      } else if (ok === 0) {
        setInfo(
          "Token agregado, pero no se pudo mintear (¿el token no expone mint público?)."
        );
      } else {
        setInfo(`Token agregado. Mint completados: ${ok}/${results.length}.`);
      }
      setAddress("");
      await loadTokens();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo agregar el token");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white/10 bg-slate-900/40 px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-white/60">Contrato Escrow:</span>
          <span className="font-mono text-xs text-white/90">{ESCROW_ADDRESS}</span>
        </div>
        {owner ? (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-white/60">Owner:</span>
            <span className="font-mono text-xs text-white/80">{owner}</span>
            {account ? (
              <span
                className={`rounded px-2 py-0.5 text-xs ${
                  isOwner ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
                }`}
              >
                {isOwner ? "Eres owner" : "No eres owner"}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {isOwner ? (
        <div className="flex gap-2">
          <input
            value={address}
            placeholder="0x… dirección del token ERC20"
            onChange={(e) => setAddress(e.target.value)}
            className={inputCls}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={loading || !address}
            className={btnPrimary}
          >
            {loading ? "Enviando…" : "Agregar"}
          </button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      {info ? <p className="text-sm text-emerald-300">{info}</p> : null}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-white/80">Tokens permitidos</h3>
        {tokens.length > 0 ? (
          <ul className="divide-y divide-white/5 rounded-lg border border-white/10 bg-slate-900/40">
            {tokens.map((t) => (
              <li
                key={t.address}
                className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm"
              >
                <span className="rounded bg-indigo-500/20 px-2 py-0.5 font-mono text-indigo-200">
                  {t.symbol}
                </span>
                <span className="ml-auto font-mono text-xs text-white/60">{t.address}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-white/40">Aún no hay tokens permitidos.</p>
        )}
      </div>
    </div>
  );
}
