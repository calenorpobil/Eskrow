"use client";

import { Contract, formatEther, formatUnits, isAddress } from "ethers";
import { useCallback, useEffect, useState } from "react";
import { CHAIN_ID, ERC20_ABI, ESCROW_ABI, ESCROW_ADDRESS } from "@/lib/contracts";
import { useEthereum } from "@/lib/ethereum";
import {
  addActiveAccount,
  getActiveAccounts,
  removeActiveAccount,
  subscribeAccounts,
  type ActiveAccount
} from "@/lib/accounts";
import { airdrop, DEFAULT_AIRDROP_AMOUNT } from "@/lib/airdrop";

type TokenMeta = { address: string; symbol: string; decimals: number };
type Row = {
  label: string;
  address: string;
  eth: string;
  balances: Record<string, string | null>;
  removable: boolean;
};

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function AnvilBalances() {
  const { provider, signer, chainId } = useEthereum();
  const [accounts, setAccounts] = useState<ActiveAccount[]>(() => getActiveAccounts());
  const [tokenMetas, setTokenMetas] = useState<TokenMeta[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [newAddress, setNewAddress] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const unsub = subscribeAccounts(() => setAccounts(getActiveAccounts()));
    return unsub;
  }, []);

  const refresh = useCallback(async () => {
    if (!provider) return;
    setError(null);
    setLoading(true);
    try {
      const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, provider);
      const tokenList = (await escrow.getAllowedTokens()) as string[];

      const metas: TokenMeta[] = [];
      for (const addr of tokenList) {
        try {
          const code = await provider.getCode(addr);
          if (!code || code === "0x") continue;
          const t = new Contract(addr, ERC20_ABI, provider);
          const [sym, dec] = await Promise.all([
            t.symbol() as Promise<string>,
            t.decimals() as Promise<bigint>
          ]);
          metas.push({ address: addr, symbol: sym, decimals: Number(dec) });
        } catch {
          // skip tokens that don't respond
        }
      }
      setTokenMetas(metas);

      const baseAddrs = new Set(
        getActiveAccounts().slice(0, 5).map((a) => a.address.toLowerCase())
      );

      const next: Row[] = await Promise.all(
        accounts.map(async ({ label, address }) => {
          const ethBal = await provider.getBalance(address);
          const balances: Record<string, string | null> = {};
          await Promise.all(
            metas.map(async (m) => {
              try {
                const t = new Contract(m.address, ERC20_ABI, provider);
                const bal = (await t.balanceOf(address)) as bigint;
                balances[m.address] = formatUnits(bal, m.decimals);
              } catch {
                balances[m.address] = null;
              }
            })
          );
          return {
            label,
            address,
            eth: formatEther(ethBal),
            balances,
            removable: !baseAddrs.has(address.toLowerCase())
          };
        })
      );
      setRows(next);
    } catch (e) {
      console.error("[AnvilBalances] refresh failed", e);
      setError(e instanceof Error ? e.message : "Error al leer balances");
    } finally {
      setLoading(false);
    }
  }, [provider, accounts]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleAddAccount() {
    setError(null);
    setInfo(null);
    if (!isAddress(newAddress)) {
      setError("Dirección inválida");
      return;
    }
    const entry = addActiveAccount(newAddress, newLabel || undefined);
    if (!entry) {
      setError("Esa cuenta ya está registrada");
      return;
    }
    setNewAddress("");
    setNewLabel("");

    if (!signer) {
      setInfo("Cuenta añadida. Conecta tu wallet para mintearle tokens.");
      return;
    }
    const tokens = tokenMetas.map((m) => m.address);
    if (tokens.length === 0) {
      setInfo("Cuenta añadida. No hay tokens activos para mintear.");
      return;
    }
    try {
      setAdding(true);
      const results = await airdrop(signer, tokens, [entry.address]);
      const failed = results.filter((r) => !r.ok);
      if (failed.length === 0) {
        setInfo(`Cuenta añadida y minteados ${DEFAULT_AIRDROP_AMOUNT} de cada token (${tokens.length}).`);
      } else {
        setInfo(
          `Cuenta añadida. Mint completados: ${results.length - failed.length}/${results.length}. Algunos tokens no exponen mint público.`
        );
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al mintear");
    } finally {
      setAdding(false);
    }
  }

  function handleRemove(address: string) {
    if (removeActiveAccount(address)) {
      setInfo(`Cuenta ${short(address)} eliminada de la lista.`);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-xl backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Cuentas activas</h2>
        <button
          type="button"
          onClick={refresh}
          disabled={loading || !provider}
          className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/90 transition hover:bg-white/10 disabled:opacity-50"
        >
          {loading ? "…" : "↻"}
        </button>
      </div>

      {!provider ? (
        <p className="text-xs text-white/50">Conecta tu wallet para leer balances.</p>
      ) : chainId !== CHAIN_ID ? (
        <p className="text-xs text-amber-300/90">
          Chain actual {chainId}. Cambia a {CHAIN_ID} para Anvil local.
        </p>
      ) : null}

      <div className="mb-3 space-y-2 rounded-lg border border-white/10 bg-slate-900/40 p-3">
        <div className="flex flex-wrap gap-2">
          <input
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            placeholder="0x… dirección a añadir"
            className="flex-1 min-w-[220px] rounded-md border border-white/10 bg-slate-950/60 px-2 py-1 text-xs text-white placeholder-white/40 outline-none focus:border-indigo-400"
          />
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="etiqueta (opcional)"
            className="w-32 rounded-md border border-white/10 bg-slate-950/60 px-2 py-1 text-xs text-white placeholder-white/40 outline-none focus:border-indigo-400"
          />
          <button
            type="button"
            onClick={handleAddAccount}
            disabled={adding || !newAddress}
            className="rounded-md bg-indigo-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
          >
            {adding ? "Minteando…" : "Añadir + airdrop 1000"}
          </button>
        </div>
        <p className="text-[10px] text-white/40">
          La cuenta nueva recibe {DEFAULT_AIRDROP_AMOUNT} de cada token activo (requiere mint público).
        </p>
      </div>

      {error ? <p className="mb-2 text-xs text-rose-400">{error}</p> : null}
      {info ? <p className="mb-2 text-xs text-emerald-300">{info}</p> : null}

      <ul className="space-y-3">
        {rows.map((r) => (
          <li
            key={r.address}
            className="rounded-lg border border-white/10 bg-slate-900/40 p-3 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-white/80">{r.label}</span>
              <span className="font-mono text-white/50">{short(r.address)}</span>
              {r.removable ? (
                <button
                  type="button"
                  onClick={() => handleRemove(r.address)}
                  className="rounded border border-rose-400/30 px-1.5 py-0.5 text-[10px] text-rose-300 hover:bg-rose-500/10"
                  title="Eliminar de la lista (no afecta on-chain)"
                >
                  ×
                </button>
              ) : null}
            </div>
            <dl className="mt-2 space-y-1 font-mono text-white/80">
              <div className="flex justify-between gap-2">
                <dt className="text-white/40">ETH</dt>
                <dd className="text-emerald-300">{Number(r.eth).toFixed(4)}</dd>
              </div>
              {tokenMetas.map((m) => (
                <div key={m.address} className="flex justify-between gap-2">
                  <dt className="text-white/40">{m.symbol}</dt>
                  <dd>
                    {r.balances[m.address] !== null && r.balances[m.address] !== undefined
                      ? Number(r.balances[m.address]).toLocaleString()
                      : "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
        {rows.length === 0 && !loading && provider ? (
          <li className="text-xs text-white/40">Sin datos.</li>
        ) : null}
      </ul>
    </section>
  );
}
