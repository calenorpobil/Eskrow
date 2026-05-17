"use client";

import { isAddress } from "ethers";
import { ESCROW_ADDRESS } from "@/lib/contracts";

export type ActiveAccount = { label: string; address: string };

const STORAGE_KEY = "eskrow:active-accounts";

const BASE_ACCOUNTS: ActiveAccount[] = [
  { label: "Escrow", address: ESCROW_ADDRESS },
  { label: "Account #0", address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" },
  { label: "Account #1", address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" },
  { label: "Account #2", address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" },
  { label: "Account #3", address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906" },
  { label: "Account #4", address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65" }
];

function readExtra(): ActiveAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is ActiveAccount =>
          typeof x === "object" &&
          x !== null &&
          typeof (x as ActiveAccount).address === "string" &&
          typeof (x as ActiveAccount).label === "string"
      )
      .filter((x) => isAddress(x.address));
  } catch {
    return [];
  }
}

function writeExtra(list: ActiveAccount[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("eskrow:accounts-changed"));
}

export function getActiveAccounts(): ActiveAccount[] {
  const extra = readExtra();
  const seen = new Set(BASE_ACCOUNTS.map((a) => a.address.toLowerCase()));
  const merged = [...BASE_ACCOUNTS];
  for (const a of extra) {
    const key = a.address.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(a);
    }
  }
  return merged;
}

export function addActiveAccount(address: string, label?: string): ActiveAccount | null {
  if (!isAddress(address)) return null;
  const normalized = address;
  const lower = normalized.toLowerCase();
  if (BASE_ACCOUNTS.some((a) => a.address.toLowerCase() === lower)) return null;
  const extra = readExtra();
  if (extra.some((a) => a.address.toLowerCase() === lower)) return null;
  const nextLabel = label?.trim() || `#${BASE_ACCOUNTS.length + extra.length}`;
  const entry: ActiveAccount = { label: nextLabel, address: normalized };
  writeExtra([...extra, entry]);
  return entry;
}

export function removeActiveAccount(address: string): boolean {
  const lower = address.toLowerCase();
  if (BASE_ACCOUNTS.some((a) => a.address.toLowerCase() === lower)) return false;
  const extra = readExtra();
  const next = extra.filter((a) => a.address.toLowerCase() !== lower);
  if (next.length === extra.length) return false;
  writeExtra(next);
  return true;
}

export function subscribeAccounts(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener("eskrow:accounts-changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("eskrow:accounts-changed", handler);
    window.removeEventListener("storage", handler);
  };
}
