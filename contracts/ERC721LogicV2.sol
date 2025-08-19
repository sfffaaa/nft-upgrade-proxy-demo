// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ERC721LogicV1.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract ERC721LogicV2 is ERC721LogicV1, ERC2981Upgradeable, PausableUpgradeable {
    
    // New storage variables for V2
    mapping(uint256 => string) private _tokenURIs;
    string public baseURI;
    bool public revealed;
    string public notRevealedUri;
    
    // Whitelist functionality
    mapping(address => bool) public whitelisted;
    bool public whitelistEnabled;
    
    event BaseURIUpdated(string newBaseURI);
    event Revealed(bool status);
    event WhitelistUpdated(address indexed account, bool status);
    event WhitelistStatusChanged(bool enabled);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initializeV2(
        string memory _baseURI,
        string memory _notRevealedUri,
        address royaltyReceiver,
        uint96 royaltyFeeNumerator
    ) public reinitializer(2) {
        __ERC2981_init();
        __Pausable_init();
        
        baseURI = _baseURI;
        notRevealedUri = _notRevealedUri;
        revealed = false;
        whitelistEnabled = false;
        
        // Set default royalty
        _setDefaultRoyalty(royaltyReceiver, royaltyFeeNumerator);
    }

    function mint(address to) public payable override whenNotPaused {
        if (whitelistEnabled) {
            require(whitelisted[msg.sender], "Not whitelisted");
        }
        super.mint(to);
    }

    function setBaseURI(string memory _baseURI) public onlyOwner {
        baseURI = _baseURI;
        emit BaseURIUpdated(_baseURI);
    }

    function setTokenURI(uint256 tokenId, string memory _tokenURI) public onlyOwner {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        _tokenURIs[tokenId] = _tokenURI;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        
        if (!revealed) {
            return notRevealedUri;
        }
        
        string memory _tokenURI = _tokenURIs[tokenId];
        if (bytes(_tokenURI).length > 0) {
            return _tokenURI;
        }
        
        return bytes(baseURI).length > 0
            ? string(abi.encodePacked(baseURI, Strings.toString(tokenId), ".json"))
            : "";
    }

    function reveal() public onlyOwner {
        revealed = true;
        emit Revealed(true);
    }

    function setNotRevealedURI(string memory _notRevealedUri) public onlyOwner {
        notRevealedUri = _notRevealedUri;
    }

    // Whitelist functions
    function setWhitelistEnabled(bool _enabled) public onlyOwner {
        whitelistEnabled = _enabled;
        emit WhitelistStatusChanged(_enabled);
    }

    function addToWhitelist(address[] calldata accounts) public onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            whitelisted[accounts[i]] = true;
            emit WhitelistUpdated(accounts[i], true);
        }
    }

    function removeFromWhitelist(address[] calldata accounts) public onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            whitelisted[accounts[i]] = false;
            emit WhitelistUpdated(accounts[i], false);
        }
    }

    // Pausable functions
    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    // Royalty functions
    function setDefaultRoyalty(address receiver, uint96 feeNumerator) public onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    function deleteDefaultRoyalty() public onlyOwner {
        _deleteDefaultRoyalty();
    }

    // Batch mint function (new in V2)
    function batchMint(address to, uint256 quantity) public onlyOwner {
        require(quantity > 0, "Quantity must be greater than 0");
        require(_nextTokenId + quantity - 1 <= maxSupply, "Exceeds max supply");
        
        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = _nextTokenId++;
            _safeMint(to, tokenId);
            emit TokenMinted(to, tokenId);
        }
    }

    function getVersion() public pure override returns (string memory) {
        return "2.0.0";
    }

    // Required overrides for multiple inheritance
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Upgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // Storage gap for future upgrades
    uint256[45] private __gap;
}