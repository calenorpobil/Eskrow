import { Contract, JsonRpcProvider, formatUnits } from "ethers";
import { ERC20_ABI, ESCROW_ABI } from "../../lib/contracts";

export const ANVIL_RPC = process.env.E2E_RPC_URL ?? "http://localhost:8545";

export function provider() {
  return new JsonRpcProvider(ANVIL_RPC, 31337);
}

export function escrowContract(address: string) {
  return new Contract(address, ESCROW_ABI, provider());
}

export function erc20(address: string) {
  return new Contract(address, ERC20_ABI, provider());
}

export async function tokenBalance(token: string, holder: string): Promise<string> {
  const t = erc20(token);
  const [bal, dec] = await Promise.all([
    t.balanceOf(holder) as Promise<bigint>,
    t.decimals() as Promise<bigint>
  ]);
  return formatUnits(bal, Number(dec));
}

export async function getAllOperations(escrow: string) {
  const c = escrowContract(escrow);
  return (await c.getAllOperations()) as Array<{
    id: bigint;
    creator: string;
    counterparty: string;
    tokenA: string;
    tokenB: string;
    amountA: bigint;
    amountB: bigint;
    status: bigint;
  }>;
}

export const STATUS = { ACTIVE: 0, COMPLETED: 1, CANCELLED: 2 } as const;
