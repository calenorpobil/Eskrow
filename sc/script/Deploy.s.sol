// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Escrow} from "../src/Escrow.sol";

contract Deploy is Script {
    function run() external returns (Escrow escrow) {
        vm.startBroadcast();
        escrow = new Escrow();
        vm.stopBroadcast();

        console2.log("Escrow deployed at:", address(escrow));
    }
}
