
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ERC721LogicV1.sol";

contract ERC721LogicV2Safe is ERC721LogicV1 {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function getVersion() public pure override returns (string memory) {
        return "2.0.0";
    }
    
    function isV2() public pure returns (bool) {
        return true;
    }
}
