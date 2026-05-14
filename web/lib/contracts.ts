import type { InterfaceAbi } from "ethers";

export const ESCROW_ADDRESS = (process.env.NEXT_PUBLIC_ESCROW_ADDRESS ?? "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1") as `0x${string}`;
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 11155111);
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "";

export const ESCROW_ABI: InterfaceAbi = [
  "function owner() view returns (address)",
  "function addToken(address token)",
  "function isTokenAllowed(address) view returns (bool)",
  "function getAllowedTokens() view returns (address[])",
  "function createOperation(address tokenA,address tokenB,uint256 amountA,uint256 amountB) returns (uint256)",
  "function completeOperation(uint256 operationId)",
  "function cancelOperation(uint256 operationId)",
  "function getAllOperations() view returns (tuple(uint256 id,address creator,address counterparty,address tokenA,address tokenB,uint256 amountA,uint256 amountB,uint8 status)[])",
  "function getOperation(uint256 operationId) view returns (tuple(uint256 id,address creator,address counterparty,address tokenA,address tokenB,uint256 amountA,uint256 amountB,uint8 status))",
  "function operationsCount() view returns (uint256)",
  "event TokenAdded(address indexed token)",
  "event OperationCreated(uint256 indexed operationId,address indexed creator,address tokenA,address tokenB,uint256 amountA,uint256 amountB)",
  "event OperationCompleted(uint256 indexed operationId,address indexed counterparty)",
  "event OperationCancelled(uint256 indexed operationId)"
];

export const ERC20_ABI: InterfaceAbi = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 value) returns (bool)",
  "function transfer(address to,uint256 value) returns (bool)"
];
export const TOKEN_A_ADDRESS = (process.env.NEXT_PUBLIC_TOKEN_A_ADDRESS ?? "0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE") as `0x${string}`;
export const TOKEN_B_ADDRESS = (process.env.NEXT_PUBLIC_TOKEN_B_ADDRESS ?? "0x68B1D87F95878fE05B998F19b66F4baba5De1aed") as `0x${string}`;
