# 🎨 NFT Factory System Architecture & Flow

## 🏗️ System Architecture Diagram

```
                    📋 UPGRADEABLE NFT FACTORY SYSTEM
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                           LOGIC IMPLEMENTATIONS                         │
    └─────────────────────────────────────────────────────────────────────────┘
              ┌─────────────┐    ┌──────────────┐    ┌─────────────┐
              │ERC721LogicV1│    │ERC721LogicV2 │    │ERC721LogicV3│
              │   Basic     │    │  Enhanced    │    │   Future    │
              │   NFT       │    │ +Royalties   │    │  Features   │
              │             │    │ +BatchMint   │    │             │
              │             │    │ +Reveal      │    │             │
              └─────────────┘    └──────────────┘    └─────────────┘
                     ▲                   ▲                   ▲
                     │                   │                   │
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                          PROXY ADMIN LAYER                             │
    │               Controls which logic each collection uses                 │
    └─────────┬───────────────────────────────────────────────────────────────┘
              │
              ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                            NFT FACTORY                                  │
    │                  Deploys collections as proxies                        │
    └─────────┬───────────────────────────────────────────────────────────────┘
              │
              ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                         DEPLOYED COLLECTIONS                           │
    └─────────────────────────────────────────────────────────────────────────┘
         ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
         │Collection A │    │Collection B │    │Collection C │
         │  (Proxy)    │    │  (Proxy)    │    │  (Proxy)    │
         │             │    │             │    │             │
         │Points to V1 │    │Points to V2 │    │Points to V1 │
         │Max: 10,000  │    │Max: 5,000   │    │Max: 1,000   │
         │Price: 0.01Ξ │    │Price: 0.05Ξ │    │Price: 0.1Ξ  │
         └─────────────┘    └─────────────┘    └─────────────┘
              │                     │                   │
              ▼                     ▼                   ▼
         ┌─────────┐           ┌─────────┐         ┌─────────┐
         │  NFT    │           │  NFT    │         │  NFT    │
         │ Tokens  │           │ Tokens  │         │ Tokens  │
         │         │           │ +V2     │         │         │
         │         │           │Features │         │         │
         └─────────┘           └─────────┘         └─────────┘
```

## 🚀 Deployment Flow

```
                         ⚙️ AUTOMATED DEPLOYMENT WORKFLOW

    ┌─────────────────────────────────────────────────────────────────────────┐
    │ STEP 0: Master Script (00-go-through-all-flow.js)                      │
    │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
    │ 🧹 Clean deployment artifacts                                          │
    │ 🔑 Initialize //Alice substrate keypair (Polkadot.js)                 │
    │ 💰 Set account balances via sudo.balances.force_set_balance           │
    │ 🎬 Execute scripts 01-04 with real-time output streaming              │
    └─┬───────────────────────────────────────────────────────────────────────┘
      │
      ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │ STEP 1: Infrastructure Deployment (01-deploy-infrastructure.js)        │
    │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
    │ 📦 Deploy ERC721LogicV1 → Implementation Contract                      │
    │ 🔐 Deploy ProxyAdmin    → Upgrade Controller                           │
    │ 🏭 Deploy NFTFactory    → Collection Creator                           │
    │ 💾 Save deployment data → localhost-infrastructure.json                │
    └─┬───────────────────────────────────────────────────────────────────────┘
      │
      ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │ STEP 2: Collection Creation (02-create-nft-collections.js)             │
    │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
    │ 🎨 Create Collection A → "Peaq Genesis Collection" (PGC)               │
    │ 🖼️  Create Collection B → "Peaq Art Gallery" (PAG)                      │
    │ 🎫 Create Collection C → "Peaq Exclusive Pass" (PEP)                   │
    │ 🪙 Test mint tokens   → Verify functionality                           │
    │ 💾 Save collection data → localhost-collections.json                   │
    └─┬───────────────────────────────────────────────────────────────────────┘
      │
      ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │ STEP 3: V2 Upgrades (03-upgrade-collections-to-v2-safe.js)             │
    │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
    │ 📦 Deploy ERC721LogicV2Fixed → Enhanced Implementation                 │
    │ ⬆️  Upgrade Collection A & B   → To V2 with atomic initialization      │
    │ ⏭️  Skip Collection C          → Keep on V1 (demonstrating independence)│
    │ ✅ Verify upgrade success     → Check V2 features availability         │
    │ 💾 Save upgrade data         → localhost-upgrades.json                │
    └─┬───────────────────────────────────────────────────────────────────────┘
      │
      ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │ STEP 4: V2 Feature Testing (04-advanced-v2-operations.js)              │
    │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
    │ 🔗 Test Batch Minting     → batchMint() functionality                  │
    │ 🎭 Test Reveal Mechanism  → Hidden → Revealed metadata                 │
    │ 🔗 Test Custom Token URIs → setTokenURI() for special tokens           │
    │ 💎 Test EIP-2981 Royalties → Royalty calculations & updates            │
    │ 🌐 Test Base URI Updates  → setBaseURI() administration                │
    │ 🔐 Test Access Control    → Verify owner restrictions                  │
    │ 💾 Save test results      → localhost-v2-test-results.json             │
    └─────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Upgrade Process Flow

```
                          🔄 INDEPENDENT COLLECTION UPGRADES

    ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
    │Collection A │         │Collection B │         │Collection C │
    │  (Proxy)    │         │  (Proxy)    │         │  (Proxy)    │
    │             │         │             │         │             │
    │Points to V1 │         │Points to V1 │         │Points to V1 │
    └──────┬──────┘         └──────┬──────┘         └──────┬──────┘
           │                       │                       │
           │                       │                       │
    ┌──────▼──────┐                │                       │
    │   UPGRADE   │                │                       │
    │ A to V2     │                │                       │
    │ ⬆️ ProxyAdmin │                │                       │
    │   .upgradeAndCall()           │                       │
    └──────┬──────┘                │                       │
           │                       │                       │
           ▼                       │                       │
    ┌─────────────┐         ┌──────▼──────┐               │
    │Collection A │         │   UPGRADE   │               │
    │  (Proxy)    │         │ B to V2     │               │
    │             │         │ ⬆️ ProxyAdmin │               │
    │Points to V2 │         │   .upgradeAndCall()         │
    └─────────────┘         └──────┬──────┘               │
                                   │                       │
                                   ▼                       │
                            ┌─────────────┐               │
                            │Collection B │               │
                            │  (Proxy)    │               │
                            │             │               │
                            │Points to V2 │               │
                            └─────────────┘               │
                                                          │
                                               ┌──────────▼──────────┐
                                               │   STAYS ON V1       │
                                               │ Collection C        │
                                               │ Independent choice  │
                                               │ No migration needed │
                                               └─────────────────────┘
```

## 🔄 Transaction Flow with Reorg Handling

```
                      🛡️ TRANSACTION EXECUTION WITH REORG PROTECTION

    ┌─────────────────────────────────────────────────────────────────────────┐
    │                    executeTransactionWithFullRetry()                    │
    └─────────────────────────────────────────────────────────────────────────┘
              │
              ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │ Attempt 1: Submit Transaction                                           │
    │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
    │ 📤 Send transaction to mempool                                          │
    │ ⏳ Wait for confirmation (45s timeout)                                  │
    └─┬───────────────────────────────────────────────────┬─────────────────────┘
      │                                                   │
      ▼ ✅ Success                                         ▼ ❌ Timeout/Failure
    ┌─────────────┐                                    ┌─────────────────────┐
    │ Return      │                                    │ Check Transaction   │
    │ Receipt     │                                    │ Status              │
    └─────────────┘                                    └─┬───────────────────┘
                                                         │
                                                         ▼
                                                    ┌─────────────────────┐
                                                    │ Transaction Found?  │
                                                    └─┬─────────────────┬─┘
                                                      │ ✅ Yes          │ ❌ No
                                                      ▼                 ▼
                                                ┌─────────────┐    ┌─────────────┐
                                                │ Get Receipt │    │ Backtrack   │
                                                │ and Return  │    │ Search      │
                                                └─────────────┘    └─────┬───────┘
                                                                         │
                                                                         ▼
                                                                  ┌─────────────┐
                                                                  │ Search last │
                                                                  │ 10 blocks   │
                                                                  │ for tx hash │
                                                                  └─────┬───────┘
                                                                        │
                                                   ┌────────────────────┼────────────────────┐
                                                   ▼ ✅ Found                               ▼ ❌ Not Found
                                             ┌─────────────┐                         ┌─────────────────┐
                                             │ Return      │                         │ Re-submit       │
                                             │ Receipt     │                         │ Transaction     │
                                             └─────────────┘                         │ (Attempt 2/3)   │
                                                                                     └─────────────────┘
```

## 📊 Data Flow Diagram

```
                           📊 DATA FLOW & STORAGE ARCHITECTURE

    ┌─────────────────────────────────────────────────────────────────────────┐
    │                         DEPLOYMENT ARTIFACTS                           │
    └─────────────────────────────────────────────────────────────────────────┘
              │                      │                      │
              ▼                      ▼                      ▼
    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
    │localhost-       │    │localhost-       │    │localhost-       │
    │infrastructure   │    │collections      │    │upgrades         │
    │.json            │    │.json            │    │.json            │
    │                 │    │                 │    │                 │
    │• LogicV1 addr   │    │• Collection A   │    │• LogicV2 addr   │
    │• ProxyAdmin     │    │• Collection B   │    │• Upgraded list  │
    │• Factory addr   │    │• Collection C   │    │• Upgrade time   │
    └─────────────────┘    └─────────────────┘    └─────────────────┘
              │                      │                      │
              └──────────────────────┼──────────────────────┘
                                     │
                                     ▼
                        ┌─────────────────────────┐
                        │ Master Script Reads     │
                        │ All Deployment Data     │
                        │ for Automation          │
                        └─────────────────────────┘
                                     │
                                     ▼
                        ┌─────────────────────────┐
                        │ Real-time Output        │
                        │ Streaming to Console    │
                        │ • Deployment progress   │
                        │ • Transaction hashes    │
                        │ • Block confirmations   │
                        │ • Test results          │
                        └─────────────────────────┘
```

## 🧠 State Management Flow

```
                        🧠 SMART CONTRACT STATE MANAGEMENT

    ┌─────────────────────────────────────────────────────────────────────────┐
    │                          STORAGE LAYOUT                                │
    └─────────────────────────────────────────────────────────────────────────┘
    
    ERC721LogicV1 Storage:
    ┌─────────────────────────────────────────────────────────────────────────┐
    │ Slot 0: name                │ Slot 1: symbol              │ Slot 2: ...  │
    │ Slot 3: balances            │ Slot 4: ownerOf             │ Slot 5: ...  │
    │ Slot 6: maxSupply           │ Slot 7: mintPrice           │ Slot 8: ...  │
    └─────────────────────────────────────────────────────────────────────────┘
    
    ERC721LogicV2Fixed Storage (Backward Compatible):
    ┌─────────────────────────────────────────────────────────────────────────┐
    │ Slot 0: name (preserved)    │ Slot 1: symbol (preserved)  │ Slot 2: ...  │
    │ Slot 3: balances (preserved)│ Slot 4: ownerOf (preserved) │ Slot 5: ...  │
    │ Slot 6: maxSupply (preserved)│ Slot 7: mintPrice (preserved)│ Slot 8: ... │
    │ Slot 9: baseURI (NEW)       │ Slot 10: revealed (NEW)     │ Slot 11: ... │
    │ Slot 12: royaltyReceiver    │ Slot 13: royaltyFee         │ Slot 14: ... │
    └─────────────────────────────────────────────────────────────────────────┘
                                     ▲
                                     │ Safe Addition
                                     │ (No conflicts)
```

## 🌊 User Interaction Flow

```
                          👤 USER INTERACTION PATTERNS

    User Wants to Mint NFT
              │
              ▼
    ┌─────────────────────┐
    │ Check Collection    │
    │ Version & Features  │
    └─────┬───────────────┘
          │
          ▼
    ┌─────────────────────┐         ┌─────────────────────┐
    │ V1 Collection       │         │ V2 Collection       │
    │                     │         │                     │
    │ mint(to)            │         │ mint(to) OR         │
    │ + payment           │         │ batchMint(to, qty)  │
    └─────┬───────────────┘         └─────┬───────────────┘
          │                               │
          ▼                               ▼
    ┌─────────────────────┐         ┌─────────────────────┐
    │ Receive NFT         │         │ Receive NFT(s)      │
    │ Basic metadata      │         │ Enhanced metadata   │
    │ No royalties        │         │ + Royalty support   │
    └─────────────────────┘         └─────────────────────┘
```

## 🚨 Error Handling Flow

```
                           🚨 COMPREHENSIVE ERROR HANDLING

    Transaction Submitted
              │
              ▼
    ┌─────────────────────┐
    │ Wait for            │
    │ Confirmation        │
    │ (45s timeout)       │
    └─────┬───────────────┘
          │
          ▼
    ┌─────────────────────┐
    │ Timeout or Error?   │
    └─────┬───────────────┘
          │
          ▼ ❌ Yes
    ┌─────────────────────┐
    │ Check if tx exists  │
    │ in pending mempool  │
    └─────┬───────────────┘
          │
          ▼
    ┌─────────────────────┐         ┌─────────────────────┐
    │ Found in mempool?   │    ❌ No │ Submit replacement  │
    └─────┬───────────────┘ ────────▶ with higher gas     │
          │ ✅ Yes                   └─────────────────────┘
          ▼
    ┌─────────────────────┐
    │ Search recent       │
    │ blocks for tx       │
    │ (reorg recovery)    │
    └─────┬───────────────┘
          │
          ▼
    ┌─────────────────────┐         ┌─────────────────────┐
    │ Transaction found?  │    ❌ No │ Retry from          │
    └─────┬───────────────┘ ────────▶ beginning           │
          │ ✅ Yes                   │ (up to 3 attempts)  │
          ▼                         └─────────────────────┘
    ┌─────────────────────┐
    │ Success! Return     │
    │ receipt to user     │
    └─────────────────────┘
```

This flowchart system provides a comprehensive visual understanding of the entire NFT factory architecture, from high-level system design down to detailed transaction flow and error handling mechanisms.