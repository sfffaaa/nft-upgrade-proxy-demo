# Specification: Upgradeable ERC721 Factory Architecture

## Overview
This specification defines an upgradeable architecture for deploying multiple ERC721 NFT collections via a factory contract. Each deployed collection must be independently upgradeable in the future without requiring users to migrate their assets.

## Goals
- Deploy multiple ERC721 contracts from a single factory.
- Ensure each deployed NFT contract is upgradeable independently.
- Maintain isolated storage for each NFT collection.
- Enable centralized or role-based upgrade control (e.g., ProxyAdmin or multisig).
- Optimize for gas cost and future maintainability.

## Key Components

### 1. Logic Contract (Implementation)
- A single `ERC721Upgradeable`-based contract containing shared logic for all NFT collections.
- Initialized using `initialize(name, symbol)` instead of a constructor.
- Upgradable versioning supported via `TransparentUpgradeableProxy`.

### 2. Factory Contract
- Deploys new NFT contracts as **transparent proxy contracts** pointing to the shared logic contract.
- Each proxy is initialized with custom metadata (e.g., collection name/symbol).
- Tracks deployed proxy addresses for potential future management (e.g., upgrades, indexing).

### 3. ProxyAdmin
- Manages upgrade rights to each proxy.
- Can be owned by the deployer, multisig, DAO, or role-based system.
- Upgrades are initiated via the factory or external management scripts.

## Workflow

### ✅ Initial Setup
1. Deploy `ERC721Logic` (Upgradeable logic contract)
2. Deploy `ProxyAdmin`
3. Deploy `Factory` and store both above addresses

### ✅ NFT Deployment (per collection)
1. Call `createNFT(name, symbol)` from the Factory
2. Factory deploys a `TransparentUpgradeableProxy`:
   - Points to `ERC721Logic`
   - Uses `ProxyAdmin`
   - Calls `initialize(name, symbol)` via constructor
3. Factory emits `NewNFTCollection(address proxy)` event

### ✅ Future Upgrade
1. Deploy `ERC721LogicV2`
2. Call `upgradeNFT(proxyAddress, ERC721LogicV2)` via ProxyAdmin

## Technical Stack
- Solidity ^0.8.x
- OpenZeppelin Contracts:
  - `ERC721Upgradeable`
  - `TransparentUpgradeableProxy`
  - `ProxyAdmin`
- Hardhat + `@openzeppelin/hardhat-upgrades` for testing/deployment

## Upgrade Security Considerations
- Only `ProxyAdmin` (or its owner) can upgrade proxies.
- `initialize()` is guarded by the `initializer` modifier to prevent re-initialization.
- All logic contracts must remain storage-compatible across versions.

## Gas Cost Estimate

| Action                 | Gas Estimate | Notes                      |
|------------------------|--------------|----------------------------|
| Deploy Logic Contract  | 200k–300k    | Done only once             |
| Deploy Proxy           | 350k–400k    | Per NFT collection         |
| Initialize Proxy       | ~50k         | Via constructor call       |
| **Total per NFT**      | ~400k–450k   | ~$10–15 USD (at 25 gwei)   |

## Benefits
- Efficient deployment: Shared logic across all collections
- Upgrade flexibility: Each collection can upgrade independently
- Gas optimized: No need to deploy logic repeatedly
- Industry-standard design (used by OpenSea, Zora, Sound.xyz)

## Future Extensions
- Add role-based permissions for ProxyAdmin
- Support upgrade proposal via DAO governance
- Implement optional `metadataURI`, `mint`, or royalty hooks per collection
