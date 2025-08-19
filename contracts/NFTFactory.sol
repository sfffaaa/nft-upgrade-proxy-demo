// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./CustomTransparentProxy.sol";

interface IERC721Logic {
    function initialize(
        string memory name,
        string memory symbol,
        uint256 maxSupply,
        uint256 mintPrice
    ) external;
}

contract NFTFactory is Ownable {
    address public logicContract;
    address public proxyAdmin;
    
    // Track all deployed NFT collections
    address[] public deployedCollections;
    mapping(address => bool) public isDeployedCollection;
    
    // Collection metadata
    struct CollectionInfo {
        string name;
        string symbol;
        address deployer;
        uint256 deploymentTime;
        uint256 maxSupply;
        uint256 mintPrice;
    }
    
    mapping(address => CollectionInfo) public collectionInfo;
    
    event NFTCollectionDeployed(
        address indexed proxy,
        string name,
        string symbol,
        address indexed deployer,
        uint256 maxSupply,
        uint256 mintPrice
    );
    
    event LogicContractUpdated(address indexed oldLogic, address indexed newLogic);
    event ProxyAdminUpdated(address indexed oldAdmin, address indexed newAdmin);

    constructor(address _logicContract, address _proxyAdmin) Ownable(msg.sender) {
        require(_logicContract != address(0), "Invalid logic contract");
        require(_proxyAdmin != address(0), "Invalid proxy admin");
        
        logicContract = _logicContract;
        proxyAdmin = _proxyAdmin;
    }

    function createNFTCollection(
        string memory name,
        string memory symbol,
        uint256 maxSupply,
        uint256 mintPrice
    ) external returns (address) {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(symbol).length > 0, "Symbol cannot be empty");
        require(maxSupply > 0, "Max supply must be greater than 0");
        
        // Encode the initialize function call
        bytes memory initData = abi.encodeWithSelector(
            IERC721Logic.initialize.selector,
            name,
            symbol,
            maxSupply,
            mintPrice
        );
        
        // Deploy our custom transparent proxy with direct admin control
        CustomTransparentProxy proxy = new CustomTransparentProxy(
            logicContract,
            proxyAdmin,  // Our main ProxyAdmin becomes the direct admin
            initData
        );
        
        address proxyAddress = address(proxy);
        
        // Track the deployed collection
        deployedCollections.push(proxyAddress);
        isDeployedCollection[proxyAddress] = true;
        
        // Store collection metadata
        collectionInfo[proxyAddress] = CollectionInfo({
            name: name,
            symbol: symbol,
            deployer: msg.sender,
            deploymentTime: block.timestamp,
            maxSupply: maxSupply,
            mintPrice: mintPrice
        });
        
        emit NFTCollectionDeployed(
            proxyAddress,
            name,
            symbol,
            msg.sender,
            maxSupply,
            mintPrice
        );
        
        return proxyAddress;
    }

    function getDeployedCollections() external view returns (address[] memory) {
        return deployedCollections;
    }

    function getCollectionCount() external view returns (uint256) {
        return deployedCollections.length;
    }

    function getCollectionByIndex(uint256 index) external view returns (address) {
        require(index < deployedCollections.length, "Index out of bounds");
        return deployedCollections[index];
    }

    function updateLogicContract(address _newLogicContract) external onlyOwner {
        require(_newLogicContract != address(0), "Invalid logic contract");
        address oldLogic = logicContract;
        logicContract = _newLogicContract;
        emit LogicContractUpdated(oldLogic, _newLogicContract);
    }

    function updateProxyAdmin(address _newProxyAdmin) external onlyOwner {
        require(_newProxyAdmin != address(0), "Invalid proxy admin");
        address oldAdmin = proxyAdmin;
        proxyAdmin = _newProxyAdmin;
        emit ProxyAdminUpdated(oldAdmin, _newProxyAdmin);
    }

    // Note: Using CustomTransparentProxy ensures our main ProxyAdmin
    // has direct control over all deployed proxies. Upgrades can be performed
    // directly through the main ProxyAdmin without ownership chain issues.
}