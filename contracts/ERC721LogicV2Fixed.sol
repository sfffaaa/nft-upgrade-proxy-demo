// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ERC721LogicV1.sol";

contract ERC721LogicV2Fixed is ERC721LogicV1 {
    // New storage variables for V2 (must be added at the end to avoid storage collision)
    string public baseURI;
    bool public revealed;
    string public notRevealedUri;
    
    // Royalty info
    address public royaltyReceiver;
    uint96 public royaltyFeeNumerator;
    
    // Events
    event BaseURIUpdated(string newBaseURI);
    event Revealed(bool status);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // Simple initialization function that doesn't conflict with existing initialization
    function initializeV2Features(
        string memory _baseURI,
        string memory _notRevealedUri,
        address _royaltyReceiver,
        uint96 _royaltyFeeNumerator
    ) external {
        require(bytes(baseURI).length == 0, "V2 already initialized"); // Prevent double initialization
        
        baseURI = _baseURI;
        notRevealedUri = _notRevealedUri;
        revealed = false;
        
        royaltyReceiver = _royaltyReceiver;
        royaltyFeeNumerator = _royaltyFeeNumerator;
    }

    function setBaseURI(string memory _baseURI) public onlyOwner {
        baseURI = _baseURI;
        emit BaseURIUpdated(_baseURI);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        
        if (!revealed) {
            return notRevealedUri;
        }
        
        return bytes(baseURI).length > 0
            ? string(abi.encodePacked(baseURI, _toString(tokenId), ".json"))
            : "";
    }

    function reveal() public onlyOwner {
        revealed = true;
        emit Revealed(true);
    }

    function setNotRevealedURI(string memory _notRevealedUri) public onlyOwner {
        notRevealedUri = _notRevealedUri;
    }

    // Simple royalty implementation
    function royaltyInfo(uint256 /*tokenId*/, uint256 salePrice) 
        external 
        view 
        returns (address receiver, uint256 royaltyAmount) 
    {
        receiver = royaltyReceiver;
        royaltyAmount = (salePrice * royaltyFeeNumerator) / 10000;
    }

    function setRoyalty(address _receiver, uint96 _feeNumerator) public onlyOwner {
        royaltyReceiver = _receiver;
        royaltyFeeNumerator = _feeNumerator;
    }

    // Batch mint function (new in V2)
    function batchMint(address to, uint256 quantity) public payable {
        require(quantity > 0, "Quantity must be greater than 0");
        require(_nextTokenId + quantity - 1 <= maxSupply, "Exceeds max supply");
        require(msg.value >= mintPrice * quantity, "Insufficient payment");
        
        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = _nextTokenId++;
            _safeMint(to, tokenId);
            emit TokenMinted(to, tokenId);
        }
        
        // Refund excess payment
        if (msg.value > mintPrice * quantity) {
            payable(msg.sender).transfer(msg.value - (mintPrice * quantity));
        }
    }

    // Set custom token URI
    function setTokenURI(uint256 tokenId, string memory _tokenURI) public onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        // Store custom URI in mapping if needed - for now just emit event
        // In a full implementation, you'd store this in a mapping
    }

    function getVersion() public pure override returns (string memory) {
        return "2.0.0";
    }

    // Helper function to convert uint to string
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        
        return string(buffer);
    }

    // EIP-165 support for royalties
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override
        returns (bool)
    {
        return interfaceId == 0x2a55205a || // EIP-2981 royalty standard
               super.supportsInterface(interfaceId);
    }

    // Storage gap for future upgrades
    uint256[44] private __gap;
}