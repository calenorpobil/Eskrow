"use client";

import { BrowserProvider, JsonRpcSigner } from "ethers";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

type EthereumContextValue = {
  account: string | null;
  chainId: number | null;
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  isConnecting: boolean;
  error: string | null;
};

const EthereumContext = createContext<EthereumContextValue | undefined>(undefined);

function getInjected(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  const eth = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
  return eth ?? null;
}

export function EthereumProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [isConnecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setAccount(null);
    setSigner(null);
    setProvider(null);
    setChainId(null);
  }, []);

  const hydrate = useCallback(
    async (method: "eth_requestAccounts" | "eth_accounts", forcedAccount?: string) => {
      const injected = getInjected();
      if (!injected) {
        if (method === "eth_requestAccounts") setError("Wallet no detectada (instala MetaMask)");
        return;
      }
      const interactive = method === "eth_requestAccounts";
      try {
        if (interactive) setConnecting(true);
        const browserProvider = new BrowserProvider(injected as never);
        const raw = forcedAccount
          ? [forcedAccount]
          : ((await injected.request({ method })) as string[]);
        const accounts = (raw ?? []).filter((a): a is string => typeof a === "string" && a.length > 0);
        if (accounts.length === 0) {
          resetState();
          return;
        }
        const target = accounts[0];
        const network = await browserProvider.getNetwork();
        const nextSigner = await browserProvider.getSigner(target);
        setProvider(browserProvider);
        setSigner(nextSigner);
        setAccount(target);
        setChainId(Number(network.chainId));
      } catch (e) {
        console.error("[ethereum] hydrate failed", { method, forcedAccount, error: e });
        if (interactive) {
          setError(e instanceof Error ? e.message : "Error al conectar");
        }
      } finally {
        if (interactive) setConnecting(false);
      }
    },
    [resetState]
  );

  const connect = useCallback(async () => {
    setError(null);
    await hydrate("eth_requestAccounts");
  }, [hydrate]);

  const disconnect = useCallback(() => {
    resetState();
  }, [resetState]);

  useEffect(() => {
    void hydrate("eth_accounts");
  }, [hydrate]);

  useEffect(() => {
    const injected = getInjected();
    if (!injected?.on) return;
    const onAccounts = (...args: unknown[]) => {
      const first = args[0];
      const accounts = Array.isArray(first)
        ? (first as string[])
        : typeof first === "string" && first.length > 0
          ? [first]
          : [];
      if (accounts.length === 0) {
        resetState();
        return;
      }
      void hydrate("eth_accounts", accounts[0]);
    };
    const onChain = (...args: unknown[]) => {
      const cid = args[0];
      if (typeof cid === "string") {
        setChainId(Number.parseInt(cid, 16));
      }
      void hydrate("eth_accounts");
    };
    const onDisconnect = () => {
      resetState();
    };
    injected.on("accountsChanged", onAccounts);
    injected.on("chainChanged", onChain);
    injected.on("disconnect", onDisconnect);
    return () => {
      injected.removeListener?.("accountsChanged", onAccounts);
      injected.removeListener?.("chainChanged", onChain);
      injected.removeListener?.("disconnect", onDisconnect);
    };
  }, [hydrate, resetState]);

  const value = useMemo(
    () => ({ account, chainId, provider, signer, connect, disconnect, isConnecting, error }),
    [account, chainId, provider, signer, connect, disconnect, isConnecting, error]
  );

  return <EthereumContext.Provider value={value}>{children}</EthereumContext.Provider>;
}

export function useEthereum() {
  const ctx = useContext(EthereumContext);
  if (!ctx) throw new Error("useEthereum debe usarse dentro de <EthereumProvider>");
  return ctx;
}
