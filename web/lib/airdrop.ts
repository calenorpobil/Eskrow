"use client";

import { Contract, parseUnits, type Signer } from "ethers";

const MINTABLE_ABI = [
  "function mint(address to, uint256 amount)",
  "function decimals() view returns (uint8)"
];

export const DEFAULT_AIRDROP_AMOUNT = "1000";

export type AirdropResult = {
  token: string;
  account: string;
  ok: boolean;
  error?: string;
};

export async function airdrop(
  signer: Signer,
  tokens: string[],
  accounts: string[],
  amount: string = DEFAULT_AIRDROP_AMOUNT
): Promise<AirdropResult[]> {
  const results: AirdropResult[] = [];
  for (const tokenAddr of tokens) {
    let decimals = 18;
    let value: bigint;
    try {
      const token = new Contract(tokenAddr, MINTABLE_ABI, signer);
      try {
        decimals = Number((await token.decimals()) as bigint);
      } catch {
        decimals = 18;
      }
      value = parseUnits(amount, decimals);
      for (const account of accounts) {
        try {
          const tx = await token.mint(account, value);
          await tx.wait();
          results.push({ token: tokenAddr, account, ok: true });
        } catch (e) {
          results.push({
            token: tokenAddr,
            account,
            ok: false,
            error: e instanceof Error ? e.message : "mint failed"
          });
        }
      }
    } catch (e) {
      for (const account of accounts) {
        results.push({
          token: tokenAddr,
          account,
          ok: false,
          error: e instanceof Error ? e.message : "token setup failed"
        });
      }
    }
  }
  return results;
}
