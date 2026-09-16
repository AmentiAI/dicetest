// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {BlockDiceNft} from "../src/BlockDiceNft.sol";
import {DiceDuel} from "../src/DiceDuel.sol";

contract Deploy is Script {
    function run() external {
        string memory baseUri = vm.envOr("NFT_BASE_URI", string("https://your-app.example/api/nft/"));
        vm.startBroadcast();
        BlockDiceNft nft = new BlockDiceNft(baseUri);
        DiceDuel duel = new DiceDuel(address(nft));
        vm.stopBroadcast();
        console.log("NFT", address(nft));
        console.log("DUEL", address(duel));
    }
}
