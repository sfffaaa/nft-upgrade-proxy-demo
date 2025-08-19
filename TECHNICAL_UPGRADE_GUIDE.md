# 🔧 Technical Guide: Upgradeable NFT Factory Implementation

This document provides deep technical insight into how the upgradeable NFT factory system works, focusing on the implementation details and upgrade mechanisms.

## 🏗️ Architecture Overview

### Core Components

The system implements a **transparent proxy pattern** with three interconnected components:

```
┌─────────────────────────────────────────────────────────────┐
│                    LOGIC LAYER                              │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │  ERC721LogicV1  │    │ ERC721LogicV2   │  ... VN        │
│  │  (Basic NFT)    │    │ (Enhanced)      │                │
│  └─────────────────┘    └─────────────────┘                │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ Points to implementation
┌─────────────────────────────────────────────────────────────┐
│                   PROXY LAYER                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │Collection A │  │Collection B │  │Collection C │         │
│  │  (Proxy)    │  │  (Proxy)    │  │  (Proxy)    │         │
│  │  Stores:    │  │  Stores:    │  │  Stores:    │         │
│  │  - Owners   │  │  - Owners   │  │  - Owners   │         │
│  │  - Metadata │  │  - Metadata │  │  - Metadata │         │
│  │  - Balances │  │  - Balances │  │  - Balances │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ Manages upgrades
┌─────────────────────────────────────────────────────────────┐
│                MANAGEMENT LAYER                             │
│  ┌─────────────┐           ┌─────────────┐                 │
│  │ ProxyAdmin  │           │ NFTFactory  │                 │
│  │ (Upgrades)  │           │ (Deploys)   │                 │
│  └─────────────┘           └─────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Contract Analysis

### 1. ERC721LogicV1 (Basic Implementation)

```solidity
// contracts/ERC721LogicV1.sol:8-65
contract ERC721LogicV1 is Initializable, ERC721Upgradeable, OwnableUpgradeable {
    uint256 internal _nextTokenId;     // Storage slot 0
    uint256 public maxSupply;          // Storage slot 1  
    uint256 public mintPrice;          // Storage slot 2
```

**Key Implementation Details:**

1. **No Constructor**: Uses `_disableInitializers()` in constructor to prevent direct calls
2. **Initialization Pattern**: `initialize()` function replaces constructor for proxy compatibility
3. **Storage Layout**: Simple sequential layout that V2 must preserve

**Critical Functions:**
```solidity
function initialize(string memory name, string memory symbol, uint256 _maxSupply, uint256 _mintPrice) 
    public initializer {
    __ERC721_init(name, symbol);      // OpenZeppelin's upgradeable init
    __Ownable_init(msg.sender);       // Set owner
    maxSupply = _maxSupply;           // Store supply limit
    mintPrice = _mintPrice;           // Store mint cost
    _nextTokenId = 1;                 // Start token IDs at 1
}
```

### 2. ERC721LogicV2Fixed (Enhanced Implementation)

```solidity
// contracts/ERC721LogicV2Fixed.sol:6-146
contract ERC721LogicV2Fixed is ERC721LogicV1 {
    // CRITICAL: New storage variables MUST be added at the end
    string public baseURI;            // Storage slot 3
    bool public revealed;             // Storage slot 4
    string public notRevealedUri;     // Storage slot 5
    address public royaltyReceiver;   // Storage slot 6
    uint96 public royaltyFeeNumerator; // Storage slot 7
```

**Why This Works:**
- **Inheritance**: Extends V1, so all V1 storage is preserved
- **Additive Storage**: New variables added after existing ones
- **Storage Gap**: `uint256[44] private __gap;` reserves space for future upgrades

**V2 Initialization Pattern:**
```solidity
function initializeV2Features(
    string memory _baseURI,
    string memory _notRevealedUri, 
    address _royaltyReceiver,
    uint96 _royaltyFeeNumerator
) external {
    require(bytes(baseURI).length == 0, "V2 already initialized");
    
    baseURI = _baseURI;
    notRevealedUri = _notRevealedUri;
    revealed = false;
    royaltyReceiver = _royaltyReceiver;
    royaltyFeeNumerator = _royaltyFeeNumerator;
}
```

**Enhanced Features:**
1. **Batch Minting**: `batchMint()` for efficient multiple token creation
2. **Reveal Mechanism**: Hidden metadata until `reveal()` is called
3. **EIP-2981 Royalties**: On-chain royalty information
4. **Custom Token URIs**: Per-token metadata overrides

### 3. NFTFactory (Deployment Engine)

```solidity
// contracts/NFTFactory.sol:57-108
function createNFTCollection(
    string memory name,
    string memory symbol, 
    uint256 maxSupply,
    uint256 mintPrice
) external returns (address) {
    // Encode initialization call
    bytes memory initData = abi.encodeWithSelector(
        IERC721Logic.initialize.selector,
        name, symbol, maxSupply, mintPrice
    );
    
    // Deploy transparent proxy
    CustomTransparentProxy proxy = new CustomTransparentProxy(
        logicContract,    // Points to ERC721LogicV1
        proxyAdmin,       // ProxyAdmin controls upgrades
        initData          // Initialization call
    );
    
    // Track deployed collection
    deployedCollections.push(address(proxy));
    return address(proxy);
}
```

**Factory Process:**
1. **Encode Init Data**: Prepares the `initialize()` call
2. **Deploy Proxy**: Creates new `CustomTransparentProxy` instance
3. **Set Implementation**: Proxy points to current logic contract (V1)
4. **Initialize**: Calls `initialize()` on proxy (executes on logic contract)
5. **Track Deployment**: Stores proxy address for management

## 🔄 Upgrade Process Deep Dive

### Step-by-Step Upgrade Flow

#### 1. Deploy New Logic Contract
```javascript
// scripts/03-upgrade-collections-to-v2-safe.js:222-258
const ERC721LogicV2Fixed = await ethers.getContractFactory("ERC721LogicV2Fixed");
const logicV2Fixed = await ERC721LogicV2Fixed.deploy({
    gasPrice: deployGasPrice,
    gasLimit: 3000000
});
```

**What Happens:**
- New V2 contract deployed to blockchain
- Contains all V1 functionality + V2 enhancements
- No initialization yet - it's just code

#### 2. Prepare Initialization Data
```javascript
// scripts/03-upgrade-collections-to-v2-safe.js:315-321
const initData = ERC721LogicV2FixedFactory.interface.encodeFunctionData("initializeV2Features", [
    `https://metadata.peaq.network/${collection.symbol.toLowerCase()}/`,
    `https://metadata.peaq.network/${collection.symbol.toLowerCase()}/hidden.json`,
    deployer.address, // Royalty receiver
    250 // 2.5% royalty (250 basis points)
]);
```

**Purpose:**
- Encodes the call to `initializeV2Features()`
- Sets up V2-specific storage variables
- Prepares royalty information

#### 3. Atomic Upgrade + Initialization
```javascript
// scripts/03-upgrade-collections-to-v2-safe.js:323-327
const upgradeTx = await mainProxyAdmin.upgradeAndCall(
    collection.proxyAddress,    // Which proxy to upgrade
    logicV2FixedAddress,        // New implementation address
    initData                    // V2 initialization call
);
```

**Critical Process:**
1. **ProxyAdmin.upgradeAndCall()** executes atomically:
   - Changes proxy's implementation pointer from V1 → V2
   - Immediately calls `initializeV2Features()` on the proxy
   - Both operations succeed or both fail

2. **Storage Preservation**:
   - All existing NFT data remains in proxy's storage
   - V1 variables (`_nextTokenId`, `maxSupply`, `mintPrice`) unchanged
   - V2 variables initialized with new values

3. **Function Resolution**:
   - Old V1 functions still work (inherited)
   - New V2 functions now available
   - Enhanced functions (like `tokenURI()`) use V2 logic

## 🗃️ Storage Layout Analysis

### Why Storage Compatibility Matters

**The Problem:**
```solidity
// ❌ DANGEROUS - Would break existing data
contract BadV2 {
    string public baseURI;        // NEW slot 0 - overwrites _nextTokenId!
    uint256 internal _nextTokenId; // Now slot 1 - data lost!
    uint256 public maxSupply;     // Now slot 2 - data moved!
}
```

**The Solution:**
```solidity
// ✅ SAFE - Preserves all existing storage
contract ERC721LogicV2Fixed is ERC721LogicV1 {
    // V1 storage preserved (slots 0-2):
    // uint256 internal _nextTokenId;  (slot 0)
    // uint256 public maxSupply;       (slot 1)  
    // uint256 public mintPrice;       (slot 2)
    
    // V2 additions (slots 3+):
    string public baseURI;            // slot 3
    bool public revealed;             // slot 4
    string public notRevealedUri;     // slot 5
    // ... more V2 variables
}
```

### Storage Layout Diagram

```
PROXY STORAGE (Persists Across Upgrades)
┌─────────────────────────────────────┐
│ Slot 0: _nextTokenId = 156          │  ← V1 data preserved
│ Slot 1: maxSupply = 10000           │  ← V1 data preserved  
│ Slot 2: mintPrice = 0.1 ETH         │  ← V1 data preserved
│ Slot 3: baseURI = "https://..."     │  ← V2 data added
│ Slot 4: revealed = false            │  ← V2 data added
│ Slot 5: notRevealedUri = "..."      │  ← V2 data added
│ Slot 6: royaltyReceiver = 0x123...  │  ← V2 data added
│ Slot 7: royaltyFeeNumerator = 250   │  ← V2 data added
│ ...                                 │
└─────────────────────────────────────┘

LOGIC CONTRACT (Changes During Upgrade)
┌─────────────────────────────────────┐
│ Before: Points to ERC721LogicV1     │
│ After:  Points to ERC721LogicV2     │
└─────────────────────────────────────┘
```

## 🔍 Function Call Analysis

### V1 Function Call Flow
```
User calls proxy.mint(address)
       ↓
Proxy delegatecall to ERC721LogicV1.mint()
       ↓
Executes in proxy's storage context
       ↓
Updates proxy's _nextTokenId, _owners mapping
```

### V2 Function Call Flow
```
User calls proxy.batchMint(address, quantity)
       ↓
Proxy delegatecall to ERC721LogicV2Fixed.batchMint()
       ↓
Executes in proxy's storage context
       ↓
Updates proxy's _nextTokenId, _owners mapping
Access V2 storage: baseURI, revealed, etc.
```

### Enhanced tokenURI() Logic
```solidity
// ERC721LogicV2Fixed.sol:47-57
function tokenURI(uint256 tokenId) public view override returns (string memory) {
    require(ownerOf(tokenId) != address(0), "Token does not exist");
    
    if (!revealed) {
        return notRevealedUri;    // Return hidden metadata
    }
    
    return bytes(baseURI).length > 0
        ? string(abi.encodePacked(baseURI, _toString(tokenId), ".json"))
        : "";
}
```

**Logic Flow:**
1. Check if token exists (uses V1 `ownerOf()`)
2. If not revealed, return hidden URI (V2 feature)
3. If revealed, construct URI from baseURI + tokenId (V2 feature)

## 💡 Why This Architecture Works

### 1. **State Preservation**
- **Proxy Pattern**: All NFT data lives in proxy, not implementation
- **Storage Compatibility**: V2 extends V1 without changing existing slots
- **Atomic Upgrades**: Implementation change + initialization happens together

### 2. **Independent Upgradeability**
- **Per-Collection Control**: Each proxy can point to different logic versions
- **Flexible Rollouts**: Upgrade Collection A to V2, keep Collection B on V1
- **Risk Management**: Test upgrades on one collection before others

### 3. **Gas Efficiency**
- **Logic Reuse**: One V2 contract serves hundreds of collections
- **Deployment Cost**: ~400k gas per collection (not ~3M for full contract)
- **Upgrade Cost**: Only proxy pointer change + initialization

### 4. **Forward Compatibility**
- **Storage Gaps**: Reserved slots for V3, V4, etc.
- **Interface Compliance**: EIP-2981, EIP-165 support built-in
- **Extension Points**: New features can be added without breaking existing

## 🚀 Complete Workflow Example

### Deployment Phase
```bash
# 1. Deploy infrastructure
npx hardhat run scripts/01-deploy-infrastructure.js
```
**Result**: ERC721LogicV1, ProxyAdmin, NFTFactory deployed

### Collection Creation
```bash
# 2. Create NFT collections  
npx hardhat run scripts/02-create-nft-collections.js
```
**Result**: 3 proxy contracts, each pointing to ERC721LogicV1

### Upgrade Phase
```bash
# 3. Upgrade to V2
npx hardhat run scripts/03-upgrade-collections-to-v2-safe.js
```
**Result**: ERC721LogicV2Fixed deployed, selected proxies upgraded

### State Before Upgrade
```javascript
Collection A Proxy:
├── Storage: { _nextTokenId: 156, maxSupply: 10000, mintPrice: 0.1 }
├── Implementation: ERC721LogicV1
└── Available functions: mint(), totalSupply(), withdraw()
```

### State After Upgrade
```javascript
Collection A Proxy:
├── Storage: { 
│     _nextTokenId: 156,           // Preserved
│     maxSupply: 10000,            // Preserved  
│     mintPrice: 0.1,              // Preserved
│     baseURI: "https://...",      // New V2 data
│     revealed: false,             // New V2 data
│     royaltyReceiver: "0x123..."  // New V2 data
│   }
├── Implementation: ERC721LogicV2Fixed
└── Available functions: mint(), batchMint(), reveal(), setRoyalty(), tokenURI()
```

## 🎯 Key Technical Insights

### 1. **Why `delegatecall` Works**
- Proxy uses `delegatecall` to execute implementation code
- Code runs in proxy's storage context, not implementation's
- Implementation can't access its own storage, only proxy's

### 2. **Why Inheritance is Critical**
- V2 inherits from V1, ensuring all V1 functions remain available
- Storage layout preserved through inheritance chain
- Function overrides (like `tokenURI()`) provide enhanced behavior

### 3. **Why Initialization Matters**
- Constructors don't work with proxies (executed in wrong context)
- `initialize()` functions run in proxy context via `delegatecall`
- `initializer` modifier prevents multiple initialization attempts

### 4. **Why Storage Gaps Exist**
```solidity
uint256[44] private __gap;  // Reserves 44 storage slots for future use
```
- Ensures V3 can add variables without affecting V4+ upgrades
- Standard OpenZeppelin practice for upgradeable contracts
- Maintains consistent storage layout across version chains

This architecture provides maximum flexibility while preserving all existing NFT data and maintaining backward compatibility. Each collection becomes independently upgradeable while sharing battle-tested implementation code.