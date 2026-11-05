// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {DiceDuel} from "../src/DiceDuel.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        DiceDuel duel = new DiceDuel();
        vm.stopBroadcast();
        console.log("DUEL", address(duel));
    }
}
