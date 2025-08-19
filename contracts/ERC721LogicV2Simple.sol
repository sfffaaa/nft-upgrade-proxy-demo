
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ERC721LogicV1.sol";

contract ERC721LogicV2Simple is ERC721LogicV1 {
    // Just add version change for now
    function getVersion() public pure override returns (string memory) {
        return "2.0.0";
    }
    
    // Add a simple new function to test upgrade
    function isV2() public pure returns (bool) {
        return true;
    }
}
