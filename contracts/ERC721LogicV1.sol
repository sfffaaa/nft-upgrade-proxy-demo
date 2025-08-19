// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract ERC721LogicV1 is Initializable, ERC721Upgradeable, OwnableUpgradeable {
    uint256 internal _nextTokenId;
    uint256 public maxSupply;
    uint256 public mintPrice;

    event TokenMinted(address indexed to, uint256 indexed tokenId);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name,
        string memory symbol,
        uint256 _maxSupply,
        uint256 _mintPrice
    ) public initializer {
        __ERC721_init(name, symbol);
        __Ownable_init(msg.sender);
        maxSupply = _maxSupply;
        mintPrice = _mintPrice;
        _nextTokenId = 1;
    }

    function mint(address to) public payable virtual {
        require(_nextTokenId <= maxSupply, "Max supply reached");
        require(msg.value >= mintPrice, "Insufficient payment");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        
        emit TokenMinted(to, tokenId);

        // Refund excess payment
        if (msg.value > mintPrice) {
            payable(msg.sender).transfer(msg.value - mintPrice);
        }
    }

    function totalSupply() public view virtual returns (uint256) {
        return _nextTokenId - 1;
    }

    function setMintPrice(uint256 _mintPrice) public onlyOwner {
        mintPrice = _mintPrice;
    }

    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        payable(owner()).transfer(balance);
    }

    function getVersion() public pure virtual returns (string memory) {
        return "1.0.0";
    }
}