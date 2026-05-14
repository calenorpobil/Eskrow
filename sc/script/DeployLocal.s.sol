// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Escrow} from "../src/Escrow.sol";
import {TestToken} from "../src/TestToken.sol";

/// @dev Despliegue local (Anvil): Escrow + TokenA + TokenB, registra ambos
/// tokens en el Escrow y mintea 1000 unidades a las tres cuentas de prueba.
contract DeployLocal is Script {
    function run() external {
        address[3] memory testAccounts = [
            0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266,
            0x70997970C51812dc3A010C7d01b50e0d17dc79C8,
            0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
        ];
        uint256 amount = 1_000 ether;

        vm.startBroadcast();

        Escrow escrow = new Escrow();
        TestToken tokenA = new TestToken("Token A", "TKA");
        TestToken tokenB = new TestToken("Token B", "TKB");
        TestToken tokenC = new TestToken("Token C", "TKC");

        escrow.addToken(address(tokenA));
        escrow.addToken(address(tokenB));
        escrow.addToken(address(tokenC));

        for (uint256 i = 0; i < testAccounts.length; i++) {
            tokenA.mint(testAccounts[i], amount);
            tokenB.mint(testAccounts[i], amount);
            tokenC.mint(testAccounts[i], amount);
        }

        vm.stopBroadcast();

        console2.log("ESCROW_ADDRESS=", address(escrow));
        console2.log("TOKEN_A_ADDRESS=", address(tokenA));
        console2.log("TOKEN_B_ADDRESS=", address(tokenB));
        console2.log("TOKEN_C_ADDRESS=", address(tokenC));
    }
}
