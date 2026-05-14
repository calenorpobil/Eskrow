"use client";

import { useEffect, useState } from "react";
import { useEthereum } from "@/lib/ethereum";

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ConnectButton() {
  const { account, chainId, connect, disconnect, isConnecting, error } = useEthereum();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled
          aria-hidden="true"
          className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 opacity-60"
        >
          Conectar wallet
        </button>
      </div>
    );
  }

  if (account) {
    return (
      <div className="flex items-center gap-3">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-mono text-white/80">
          {shortenAddress(account)} {chainId ? `· chain ${chainId}` : ""}
        </span>
        <button
          type="button"
          onClick={disconnect}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10"
        >
          Desconectar
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={connect}
        disabled={isConnecting}
        className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isConnecting ? "Conectando…" : "Conectar wallet"}
      </button>
      {error ? <span className="text-sm text-rose-400">{error}</span> : null}
    </div>
  );
}
