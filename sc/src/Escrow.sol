// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title Escrow para intercambio atómico de tokens ERC20 entre dos partes.
contract Escrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status {
        Active,
        Completed,
        Cancelled
    }

    struct Operation {
        uint256 id;
        address creator;
        address counterparty;
        address tokenA;
        address tokenB;
        uint256 amountA;
        uint256 amountB;
        Status status;
    }

    address[] private allowedTokens;
    mapping(address => bool) public isTokenAllowed;

    Operation[] private operations;

    event TokenAdded(address indexed token);
    event OperationCreated(
        uint256 indexed operationId,
        address indexed creator,
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB
    );
    event OperationCompleted(uint256 indexed operationId, address indexed counterparty);
    event OperationCancelled(uint256 indexed operationId);

    error TokenAlreadyAllowed();
    error TokenNotAllowed();
    error InvalidParams();
    error NotAuthorized();
    error CannotCompleteOwn();
    error InvalidStatus();
    error OperationNotFound();

    constructor() Ownable(msg.sender) {}

    function addToken(address token) external onlyOwner {
        if (token == address(0)) revert InvalidParams();
        if (isTokenAllowed[token]) revert TokenAlreadyAllowed();
        if (token.code.length == 0) revert InvalidParams();

        (bool okSym,) = token.staticcall(abi.encodeWithSignature("symbol()"));
        (bool okDec,) = token.staticcall(abi.encodeWithSignature("decimals()"));
        if (!okSym || !okDec) revert InvalidParams();

        isTokenAllowed[token] = true;
        allowedTokens.push(token);
        emit TokenAdded(token);
    }

    function createOperation(address tokenA, address tokenB, uint256 amountA, uint256 amountB)
        external
        nonReentrant
        returns (uint256 operationId)
    {
        if (tokenA == tokenB) revert InvalidParams();
        if (amountA == 0 || amountB == 0) revert InvalidParams();
        if (!isTokenAllowed[tokenA] || !isTokenAllowed[tokenB]) revert TokenNotAllowed();

        operationId = operations.length;
        operations.push(
            Operation({
                id: operationId,
                creator: msg.sender,
                counterparty: address(0),
                tokenA: tokenA,
                tokenB: tokenB,
                amountA: amountA,
                amountB: amountB,
                status: Status.Active
            })
        );

        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountA);

        emit OperationCreated(operationId, msg.sender, tokenA, tokenB, amountA, amountB);
    }

    function completeOperation(uint256 operationId) external nonReentrant {
        if (operationId >= operations.length) revert OperationNotFound();
        Operation storage op = operations[operationId];
        if (op.status != Status.Active) revert InvalidStatus();
        if (msg.sender == op.creator) revert CannotCompleteOwn();

        op.status = Status.Completed;
        op.counterparty = msg.sender;

        IERC20(op.tokenB).safeTransferFrom(msg.sender, op.creator, op.amountB);
        IERC20(op.tokenA).safeTransfer(msg.sender, op.amountA);

        emit OperationCompleted(operationId, msg.sender);
    }

    function cancelOperation(uint256 operationId) external nonReentrant {
        if (operationId >= operations.length) revert OperationNotFound();
        Operation storage op = operations[operationId];
        if (op.status != Status.Active) revert InvalidStatus();
        if (msg.sender != op.creator) revert NotAuthorized();

        op.status = Status.Cancelled;

        IERC20(op.tokenA).safeTransfer(op.creator, op.amountA);

        emit OperationCancelled(operationId);
    }

    function getAllowedTokens() external view returns (address[] memory) {
        return allowedTokens;
    }

    function getAllOperations() external view returns (Operation[] memory) {
        return operations;
    }

    function getOperation(uint256 operationId) external view returns (Operation memory) {
        if (operationId >= operations.length) revert OperationNotFound();
        return operations[operationId];
    }

    function operationsCount() external view returns (uint256) {
        return operations.length;
    }
}
