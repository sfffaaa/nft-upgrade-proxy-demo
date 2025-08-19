
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ERC721LogicV1.sol";

contract ERC721LogicV1Copy is ERC721LogicV1 {
    function getVersion() public pure override returns (string memory) {
        return "1.1.0";
    }
}
