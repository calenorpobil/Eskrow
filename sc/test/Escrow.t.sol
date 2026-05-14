// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Escrow} from "../src/Escrow.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MockERC20 is ERC20 {
    constructor(string memory n, string memory s) ERC20(n, s) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract EscrowTest is Test {
    Escrow internal escrow;
    MockERC20 internal tokenA;
    MockERC20 internal tokenB;

    address internal owner = address(this);
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    uint256 internal constant INITIAL = 1_000 ether;

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

    function setUp() public {
        escrow = new Escrow();
        tokenA = new MockERC20("Token A", "TKA");
        tokenB = new MockERC20("Token B", "TKB");

        tokenA.mint(alice, INITIAL);
        tokenA.mint(bob, INITIAL);
        tokenB.mint(alice, INITIAL);
        tokenB.mint(bob, INITIAL);
        tokenB.mint(carol, INITIAL);

        vm.prank(alice);
        tokenA.approve(address(escrow), type(uint256).max);
        vm.prank(alice);
        tokenB.approve(address(escrow), type(uint256).max);
        vm.prank(bob);
        tokenA.approve(address(escrow), type(uint256).max);
        vm.prank(bob);
        tokenB.approve(address(escrow), type(uint256).max);
        vm.prank(carol);
        tokenB.approve(address(escrow), type(uint256).max);
    }

    // ---------- addToken ----------

    function test_AddToken_Owner() public {
        vm.expectEmit(true, false, false, false);
        emit TokenAdded(address(tokenA));
        escrow.addToken(address(tokenA));

        assertTrue(escrow.isTokenAllowed(address(tokenA)));
        address[] memory list = escrow.getAllowedTokens();
        assertEq(list.length, 1);
        assertEq(list[0], address(tokenA));
    }

    function test_AddToken_RevertIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        escrow.addToken(address(tokenA));
    }

    function test_AddToken_RevertIfZero() public {
        vm.expectRevert(Escrow.InvalidParams.selector);
        escrow.addToken(address(0));
    }

    function test_AddToken_RevertIfDuplicate() public {
        escrow.addToken(address(tokenA));
        vm.expectRevert(Escrow.TokenAlreadyAllowed.selector);
        escrow.addToken(address(tokenA));
    }

    function test_GetAllowedTokens_Multiple() public {
        escrow.addToken(address(tokenA));
        escrow.addToken(address(tokenB));
        address[] memory list = escrow.getAllowedTokens();
        assertEq(list.length, 2);
        assertEq(list[0], address(tokenA));
        assertEq(list[1], address(tokenB));
    }

    // ---------- createOperation ----------

    function _addBothTokens() internal {
        escrow.addToken(address(tokenA));
        escrow.addToken(address(tokenB));
    }

    function test_CreateOperation_HappyPath() public {
        _addBothTokens();

        vm.expectEmit(true, true, false, true);
        emit OperationCreated(0, alice, address(tokenA), address(tokenB), 100 ether, 200 ether);

        vm.prank(alice);
        uint256 id = escrow.createOperation(address(tokenA), address(tokenB), 100 ether, 200 ether);

        assertEq(id, 0);
        assertEq(tokenA.balanceOf(address(escrow)), 100 ether);
        assertEq(tokenA.balanceOf(alice), INITIAL - 100 ether);

        Escrow.Operation memory op = escrow.getOperation(0);
        assertEq(op.creator, alice);
        assertEq(op.tokenA, address(tokenA));
        assertEq(op.tokenB, address(tokenB));
        assertEq(op.amountA, 100 ether);
        assertEq(op.amountB, 200 ether);
        assertEq(uint8(op.status), uint8(Escrow.Status.Active));
    }

    function test_CreateOperation_RevertIfTokenNotAllowed() public {
        escrow.addToken(address(tokenA));
        vm.prank(alice);
        vm.expectRevert(Escrow.TokenNotAllowed.selector);
        escrow.createOperation(address(tokenA), address(tokenB), 100 ether, 200 ether);
    }

    function test_CreateOperation_RevertIfSameToken() public {
        _addBothTokens();
        vm.prank(alice);
        vm.expectRevert(Escrow.InvalidParams.selector);
        escrow.createOperation(address(tokenA), address(tokenA), 100 ether, 200 ether);
    }

    function test_CreateOperation_RevertIfZeroAmountA() public {
        _addBothTokens();
        vm.prank(alice);
        vm.expectRevert(Escrow.InvalidParams.selector);
        escrow.createOperation(address(tokenA), address(tokenB), 0, 200 ether);
    }

    function test_CreateOperation_RevertIfZeroAmountB() public {
        _addBothTokens();
        vm.prank(alice);
        vm.expectRevert(Escrow.InvalidParams.selector);
        escrow.createOperation(address(tokenA), address(tokenB), 100 ether, 0);
    }

    function test_CreateOperation_RevertIfInsufficientAllowance() public {
        _addBothTokens();
        address dave = makeAddr("dave");
        tokenA.mint(dave, 100 ether);
        vm.prank(dave);
        vm.expectRevert();
        escrow.createOperation(address(tokenA), address(tokenB), 100 ether, 200 ether);
    }

    function test_CreateOperation_IncrementsId() public {
        _addBothTokens();
        vm.startPrank(alice);
        uint256 id0 = escrow.createOperation(address(tokenA), address(tokenB), 1 ether, 2 ether);
        uint256 id1 = escrow.createOperation(address(tokenA), address(tokenB), 3 ether, 4 ether);
        vm.stopPrank();
        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(escrow.operationsCount(), 2);
    }

    // ---------- completeOperation ----------

    function test_CompleteOperation_HappyPath() public {
        _addBothTokens();
        vm.prank(alice);
        escrow.createOperation(address(tokenA), address(tokenB), 100 ether, 200 ether);

        uint256 aliceBBefore = tokenB.balanceOf(alice);
        uint256 bobBBefore = tokenB.balanceOf(bob);
        uint256 bobABefore = tokenA.balanceOf(bob);

        vm.expectEmit(true, true, false, false);
        emit OperationCompleted(0, bob);

        vm.prank(bob);
        escrow.completeOperation(0);

        assertEq(tokenB.balanceOf(alice), aliceBBefore + 200 ether);
        assertEq(tokenB.balanceOf(bob), bobBBefore - 200 ether);
        assertEq(tokenA.balanceOf(bob), bobABefore + 100 ether);
        assertEq(tokenA.balanceOf(address(escrow)), 0);

        Escrow.Operation memory op = escrow.getOperation(0);
        assertEq(uint8(op.status), uint8(Escrow.Status.Completed));
        assertEq(op.counterparty, bob);
    }

    function test_CompleteOperation_RevertIfCreator() public {
        _addBothTokens();
        vm.prank(alice);
        escrow.createOperation(address(tokenA), address(tokenB), 100 ether, 200 ether);

        vm.prank(alice);
        vm.expectRevert(Escrow.CannotCompleteOwn.selector);
        escrow.completeOperation(0);
    }

    function test_CompleteOperation_RevertIfNotFound() public {
        vm.prank(bob);
        vm.expectRevert(Escrow.OperationNotFound.selector);
        escrow.completeOperation(999);
    }

    function test_CompleteOperation_RevertIfAlreadyCompleted() public {
        _addBothTokens();
        vm.prank(alice);
        escrow.createOperation(address(tokenA), address(tokenB), 100 ether, 200 ether);
        vm.prank(bob);
        escrow.completeOperation(0);

        vm.prank(carol);
        vm.expectRevert(Escrow.InvalidStatus.selector);
        escrow.completeOperation(0);
    }

    function test_CompleteOperation_RevertIfCancelled() public {
        _addBothTokens();
        vm.prank(alice);
        escrow.createOperation(address(tokenA), address(tokenB), 100 ether, 200 ether);
        vm.prank(alice);
        escrow.cancelOperation(0);

        vm.prank(bob);
        vm.expectRevert(Escrow.InvalidStatus.selector);
        escrow.completeOperation(0);
    }

    function test_CompleteOperation_RevertIfInsufficientAllowance() public {
        _addBothTokens();
        vm.prank(alice);
        escrow.createOperation(address(tokenA), address(tokenB), 100 ether, 200 ether);

        address dave = makeAddr("dave");
        tokenB.mint(dave, 200 ether);
        vm.prank(dave);
        vm.expectRevert();
        escrow.completeOperation(0);
    }

    // ---------- cancelOperation ----------

    function test_CancelOperation_HappyPath() public {
        _addBothTokens();
        vm.prank(alice);
        escrow.createOperation(address(tokenA), address(tokenB), 100 ether, 200 ether);

        uint256 aliceABefore = tokenA.balanceOf(alice);

        vm.expectEmit(true, false, false, false);
        emit OperationCancelled(0);

        vm.prank(alice);
        escrow.cancelOperation(0);

        assertEq(tokenA.balanceOf(alice), aliceABefore + 100 ether);
        assertEq(tokenA.balanceOf(address(escrow)), 0);

        Escrow.Operation memory op = escrow.getOperation(0);
        assertEq(uint8(op.status), uint8(Escrow.Status.Cancelled));
    }

    function test_CancelOperation_RevertIfNotCreator() public {
        _addBothTokens();
        vm.prank(alice);
        escrow.createOperation(address(tokenA), address(tokenB), 100 ether, 200 ether);

        vm.prank(bob);
        vm.expectRevert(Escrow.NotAuthorized.selector);
        escrow.cancelOperation(0);
    }

    function test_CancelOperation_RevertIfNotFound() public {
        vm.prank(alice);
        vm.expectRevert(Escrow.OperationNotFound.selector);
        escrow.cancelOperation(999);
    }

    function test_CancelOperation_RevertIfAlreadyCancelled() public {
        _addBothTokens();
        vm.prank(alice);
        escrow.createOperation(address(tokenA), address(tokenB), 100 ether, 200 ether);
        vm.prank(alice);
        escrow.cancelOperation(0);

        vm.prank(alice);
        vm.expectRevert(Escrow.InvalidStatus.selector);
        escrow.cancelOperation(0);
    }

    function test_CancelOperation_RevertIfCompleted() public {
        _addBothTokens();
        vm.prank(alice);
        escrow.createOperation(address(tokenA), address(tokenB), 100 ether, 200 ether);
        vm.prank(bob);
        escrow.completeOperation(0);

        vm.prank(alice);
        vm.expectRevert(Escrow.InvalidStatus.selector);
        escrow.cancelOperation(0);
    }

    // ---------- getAllOperations ----------

    function test_GetAllOperations() public {
        _addBothTokens();
        vm.startPrank(alice);
        escrow.createOperation(address(tokenA), address(tokenB), 10 ether, 20 ether);
        escrow.createOperation(address(tokenA), address(tokenB), 30 ether, 40 ether);
        vm.stopPrank();

        Escrow.Operation[] memory ops = escrow.getAllOperations();
        assertEq(ops.length, 2);
        assertEq(ops[0].amountA, 10 ether);
        assertEq(ops[1].amountA, 30 ether);
    }

    function test_GetAllOperations_EmptyInitially() public view {
        Escrow.Operation[] memory ops = escrow.getAllOperations();
        assertEq(ops.length, 0);
    }

    // ---------- fuzz ----------

    function testFuzz_CreateAndComplete(uint96 amtA, uint96 amtB) public {
        amtA = uint96(bound(amtA, 1, INITIAL));
        amtB = uint96(bound(amtB, 1, INITIAL));
        _addBothTokens();

        vm.prank(alice);
        uint256 id = escrow.createOperation(address(tokenA), address(tokenB), amtA, amtB);

        vm.prank(bob);
        escrow.completeOperation(id);

        Escrow.Operation memory op = escrow.getOperation(id);
        assertEq(uint8(op.status), uint8(Escrow.Status.Completed));
    }
}
