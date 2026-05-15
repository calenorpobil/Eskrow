// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {TestToken} from "../src/TestToken.sol";
import {Escrow} from "../src/Escrow.sol";

contract DeployToken is Script {
    function run() external returns (TestToken token) {
        string memory name = vm.envOr("TOKEN_NAME", string("Mock USD"));
        string memory symbol = vm.envOr("TOKEN_SYMBOL", string("mUSD"));
        uint256 mintAmount = vm.envOr("MINT_AMOUNT", uint256(1_000_000 ether));
        address escrowAddr = vm.envOr("ESCROW_ADDRESS", address(0));

        vm.startBroadcast();

        token = new TestToken(name, symbol);
        console2.log("Token deployed:", address(token));
        console2.log("  name:", name);
        console2.log("  symbol:", symbol);

        if (mintAmount > 0) {
            token.mint(msg.sender, mintAmount);
            console2.log("  minted to deployer:", mintAmount);
        }

        if (escrowAddr != address(0)) {
            Escrow(escrowAddr).addToken(address(token));
            console2.log("  registered in Escrow:", escrowAddr);
        }

        vm.stopBroadcast();
    }
}
