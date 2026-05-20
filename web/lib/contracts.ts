import type { InterfaceAbi } from "ethers";

export const ESCROW_ADDRESS = (process.env.NEXT_PUBLIC_ESCROW_ADDRESS ?? "0xE6E340D132b5f46d1e472DebcD681B2aBc16e57E") as `0x${string}`;
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
  "event OperationCancelled(uint256 indexed operationId)",
  "error TokenAlreadyAllowed()",
  "error TokenNotAllowed()",
  "error InvalidParams()",
  "error NotAuthorized()",
  "error CannotCompleteOwn()",
  "error InvalidStatus()",
  "error OperationNotFound()",
  "error ERC20InsufficientBalance(address sender,uint256 balance,uint256 needed)",
  "error ERC20InsufficientAllowance(address spender,uint256 allowance,uint256 needed)",
  "error ERC20InvalidSender(address sender)",
  "error ERC20InvalidReceiver(address receiver)",
  "error SafeERC20FailedOperation(address token)"
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
export const TOKEN_A_ADDRESS = (process.env.NEXT_PUBLIC_TOKEN_A_ADDRESS ?? "0xc3e53F4d16Ae77Db1c982e75a937B9f60FE63690") as `0x${string}`;
export const TOKEN_B_ADDRESS = (process.env.NEXT_PUBLIC_TOKEN_B_ADDRESS ?? "0x84eA74d481Ee0A5332c457a4d796187F6Ba67fEB") as `0x${string}`;
