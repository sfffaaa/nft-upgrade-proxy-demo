# 🎨 Upgradeable ERC721 NFT Factory System

A production-ready upgradeable NFT factory system that deploys multiple independent NFT collections via transparent proxies. Each collection can be upgraded independently without requiring users to migrate assets.

## 🏗️ Architecture Overview

The system consists of three core components:

### 1. **ERC721Logic Versions** (v1, v2, etc.)
- **ERC721LogicV1**: Initial implementation with basic NFT functionality
- **ERC721LogicV2Fixed**: Enhanced version with royalties, metadata management, batch operations
- All versions use OpenZeppelin's ERC721Upgradeable
- Initialized via `initialize(name, symbol)` instead of constructor

### 2. **Factory Contract**
- Deploys new NFT collections as transparent proxies
- Each proxy initially points to ERC721LogicV1
- Proxies can be individually upgraded to ERC721LogicV2Fixed (or later versions)
- Tracks deployed proxy addresses for management

### 3. **ProxyAdmin**
- Manages upgrade permissions for all proxies
- Controls which logic version each NFT collection uses
- Enables upgrading Collection A to v2 while Collection B stays on v1
- Can be owned by multisig, DAO, or role-based system

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- Hardhat development environment
- Local blockchain network or testnet access

### Installation
```bash
# Clone and install dependencies
git clone <repository-url>
cd nft_upgrade
npm install

# Initialize Hardhat (if needed)
npx hardhat init
```

### Quick Deployment
```bash
# Run complete automated workflow (localhost)
npx hardhat run scripts/00-go-through-all-flow.js --network localhost

# Or run individual steps:
npx hardhat run scripts/01-deploy-infrastructure.js --network localhost
npx hardhat run scripts/02-create-nft-collections.js --network localhost
npx hardhat run scripts/03-upgrade-collections-to-v2-safe.js --network localhost
npx hardhat run scripts/04-advanced-v2-operations.js --network localhost
```

## 📋 Scripts Overview

### **00-go-through-all-flow.js** (Master Script)
**Complete automated workflow that:**
- ✅ Cleans previous deployment artifacts
- ✅ Uses Polkadot.js API for authentic //Alice substrate keypair derivation
- ✅ Sets account balances using `sudo.balances.force_set_balance` (peaq-bc-test pattern)
- ✅ Runs all deployment scripts in sequence with real-time output
- ✅ Comprehensive reorg handling and error recovery

### **01-deploy-infrastructure.js**
**Deploys core infrastructure:**
- ERC721LogicV1 implementation contract
- ProxyAdmin for upgrade management
- NFTFactory for creating new collections
- **Features**: 120s deployment timeouts, transaction retry logic

### **02-create-nft-collections.js**
**Creates sample NFT collections:**
- Peaq Genesis Collection (PGC) - 10,000 supply
- Peaq Art Gallery (PAG) - 5,000 supply  
- Peaq Exclusive Pass (PEP) - 1,000 supply
- **Features**: Test minting, balance verification

### **03-upgrade-collections-to-v2-safe.js**
**Upgrades collections to V2:**
- Deploys ERC721LogicV2Fixed implementation
- Upgrades selected collections with atomic initialization
- **Features**: Most comprehensive reorg handling with backtrack search
- **Features**: Skips already upgraded collections safely

### **04-advanced-v2-operations.js**
**Tests V2 enhanced features:**
- Batch minting operations
- Reveal mechanism (hidden → revealed metadata)
- Custom token URI system
- EIP-2981 royalty management
- Base URI updates and access control

## 🔧 Key Features

### **Independent Upgradeability**
```solidity
// Each collection can be upgraded independently
ProxyAdmin.upgradeAndCall(collectionA, newLogicV2, initData); // Only Collection A upgraded
ProxyAdmin.upgradeAndCall(collectionB, newLogicV3, initData); // Collection B gets V3 later
```

### **V2 Enhanced Features**
- **Batch Operations**: `batchMint()` for efficient multiple minting
- **Metadata Management**: Hidden/revealed URI system with `reveal()`
- **EIP-2981 Royalties**: On-chain royalty enforcement
- **Custom URIs**: Per-token URI overrides with `setTokenURI()`
- **Access Control**: Owner-based permissions for administrative functions

### **Reorg Resilience**
All scripts implement comprehensive reorg handling:
- **Transaction retry logic** with exponential backoff
- **Backtrack search** for lost transactions during reorgs
- **Stuck transaction clearing** with higher gas prices
- **Timeout protection** for all deployments and operations

### **Substrate Integration**
The master script uses authentic substrate patterns:
- **Polkadot.js Keyring** with `Keypair.addFromUri('//Alice')`
- **sudo.balances.force_set_balance** for account funding
- **Graceful fallback** to ethers simulation when substrate unavailable

## 🌐 Network Configuration

### **Localhost (Hardhat)**
```javascript
localhost: {
  url: "http://127.0.0.1:10044",
  chainId: 3338,
  accounts: [
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // Owner
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // Charlie
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"  // Diana
  ]
}
```

### **Agung Testnet**
```javascript
agung: {
  url: "https://wss-async.agung.peaq.network",
  chainId: 9990,
  accounts: [...] // Same test accounts
}
```

## 📊 System Flow

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   ERC721LogicV1 │    │   ERC721LogicV2  │    │ ERC721LogicV3   │
│   (Basic NFT)   │    │   (Enhanced)     │    │ (Future)        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         ▲                        ▲                       ▲
         │                        │                       │
    ┌────┴────────────────────────┴───────────────────────┴────┐
    │                ProxyAdmin                                │
    │          (Manages all upgrades)                          │
    └─────────────────────────┬────────────────────────────────┘
                              │
    ┌─────────────────────────▼────────────────────────────────┐
    │                    NFTFactory                             │
    │        (Deploys new collections as proxies)               │
    └─────────────────────────┬────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
    ┌─────────────┐  ┌─────────────┐    ┌─────────────┐
    │Collection A │  │Collection B │    │Collection C │
    │   (Proxy)   │  │   (Proxy)   │    │   (Proxy)   │
    │             │  │             │    │             │
    │ Points to   │  │ Points to   │    │ Points to   │
    │ LogicV1     │  │ LogicV2     │    │ LogicV1     │
    └─────────────┘  └─────────────┘    └─────────────┘
```

## 💡 Usage Examples

### **Creating a New Collection**
```javascript
const factory = await ethers.getContractAt("NFTFactory", factoryAddress);
const tx = await factory.createNFTCollection(
  "My Collection",      // name
  "MC",                // symbol  
  1000,                // maxSupply
  ethers.parseEther("0.1") // mintPrice
);
```

### **Upgrading to V2**
```javascript
const proxyAdmin = await ethers.getContractAt("ProxyAdmin", proxyAdminAddress);
const initData = ERC721LogicV2Fixed.interface.encodeFunctionData("initializeV2Features", [
  "https://api.example.com/metadata/", // baseURI
  "https://api.example.com/hidden.json", // hiddenURI
  ownerAddress,                           // royaltyReceiver
  250                                     // 2.5% royalty
]);

await proxyAdmin.upgradeAndCall(collectionAddress, logicV2Address, initData);
```

### **Using V2 Features**
```javascript
const collection = await ethers.getContractAt("ERC721LogicV2Fixed", collectionAddress);

// Batch mint
await collection.batchMint(userAddress, 5, { value: mintPrice * 5n });

// Reveal collection
await collection.reveal();

// Set custom token URI
await collection.setTokenURI(tokenId, "https://special.metadata.json");

// Update royalties
await collection.setRoyalty(newReceiver, 500); // 5%
```

## 🔍 Testing & Verification

### **Run Complete Test Suite**
```bash
# Test all functionality
npx hardhat test

# Test specific components
npx hardhat test test/Factory.test.js
npx hardhat test test/Upgrades.test.js
```

### **Verify Deployments**
```bash
# Verify on testnet
npx hardhat verify --network agung <contract_address>

# Check contract sizes
npx hardhat size-contracts

# Generate coverage report
npx hardhat coverage
```

## 🛡️ Security Features

### **Access Control**
- **ProxyAdmin ownership**: Controls all upgrade permissions
- **Collection ownership**: Each collection has independent owner
- **Function-level restrictions**: Owner-only administrative functions

### **Upgrade Safety**
- **Storage compatibility**: Maintains storage layout across versions
- **Initialization protection**: Prevents re-initialization attacks
- **Atomic upgrades**: Upgrade and initialization in single transaction

### **Economic Security**
- **Payment validation**: All mint functions validate payment amounts
- **Supply limits**: Hard caps prevent over-minting
- **Royalty enforcement**: On-chain royalty compliance

## 📁 Project Structure

```
nft_upgrade/
├── contracts/
│   ├── ERC721LogicV1.sol          # Basic NFT implementation
│   ├── ERC721LogicV2Fixed.sol     # Enhanced V2 implementation
│   ├── NFTFactory.sol             # Factory for creating collections
│   └── CustomTransparentProxy.sol # Custom proxy implementation
├── scripts/
│   ├── 00-go-through-all-flow.js  # Master automation script
│   ├── 01-deploy-infrastructure.js # Core infrastructure
│   ├── 02-create-nft-collections.js # Sample collections
│   ├── 03-upgrade-collections-to-v2-safe.js # V2 upgrades
│   └── 04-advanced-v2-operations.js # V2 feature testing
├── test/                          # Comprehensive test suite
├── deployments/                   # Deployment artifacts (gitignored)
├── hardhat.config.js             # Network and account configuration
└── CLAUDE.md                     # Development guidance
```

## 🚨 Important Notes

### **Storage Compatibility**
When creating new logic versions, **NEVER**:
- Remove existing storage variables
- Reorder existing storage variables  
- Change types of existing storage variables

**ALWAYS**:
- Add new storage variables at the end
- Use storage gaps for future flexibility
- Test upgrades thoroughly on testnets

### **Initialization Security**
- Use `initializer` modifier to prevent re-initialization
- Validate all initialization parameters
- Test initialization with various edge cases

### **Gas Considerations**
- Deployment costs ~400k-450k gas per collection
- Logic contracts deployed only once and reused
- Batch operations reduce per-token gas costs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [OpenZeppelin Upgrades](https://docs.openzeppelin.com/upgrades-plugins/1.x/)
- [EIP-2981 Royalty Standard](https://eips.ethereum.org/EIPS/eip-2981)
- [Hardhat Documentation](https://hardhat.org/docs)
