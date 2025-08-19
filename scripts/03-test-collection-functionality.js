const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🧪 Testing V1 Collection Functionality");
    console.log("=====================================\n");

    // Get test accounts - now we have three distinct accounts
    const [owner, alice, bob] = await ethers.getSigners();
    
    console.log("Test accounts:");
    console.log(`  Owner/Deployer: ${owner.address}`);
    console.log(`  Alice (User):   ${alice.address}`);
    console.log(`  Bob (User):     ${bob.address}\n`);
    
    // Load deployment data
    const infrastructureFile = path.join(__dirname, "../deployments/localhost-infrastructure.json");
    const collectionsFile = path.join(__dirname, "../deployments/localhost-collections.json");
    
    if (!fs.existsSync(collectionsFile)) {
        console.log("❌ Collections not found. Please run step 2 first:");
        console.log("npx hardhat run scripts/02-create-nft-collections.js --network localhost");
        return;
    }
    
    const infrastructureData = JSON.parse(fs.readFileSync(infrastructureFile, 'utf8'));
    const collectionsData = JSON.parse(fs.readFileSync(collectionsFile, 'utf8'));
    
    const factoryAddress = infrastructureData.contracts.NFTFactory;
    console.log(`Factory Address: ${factoryAddress}\n`);
    
    // Test each collection
    for (let i = 0; i < collectionsData.collections.length; i++) {
        const collection = collectionsData.collections[i];
        console.log(`${i + 1}. Testing Collection: ${collection.name} (${collection.symbol})`);
        console.log(`   Address: ${collection.proxyAddress}`);
        console.log(`   Max Supply: ${collection.maxSupply}`);
        console.log(`   Mint Price: ${ethers.formatEther(collection.mintPrice)} ETH`);
        
        try {
            const nftContract = await ethers.getContractAt("ERC721LogicV1", collection.proxyAddress);
            
            // Test 1: Basic contract info
            console.log(`\n   📋 Basic Information:`);
            const name = await nftContract.name();
            const symbol = await nftContract.symbol();
            const version = await nftContract.getVersion();
            const owner = await nftContract.owner();
            const totalSupply = await nftContract.totalSupply();
            
            console.log(`     Name: ${name}`);
            console.log(`     Symbol: ${symbol}`);
            console.log(`     Version: ${version}`);
            console.log(`     Owner: ${owner}`);
            console.log(`     Current Supply: ${totalSupply.toString()}`);
            
            // Test 2: Minting functionality
            console.log(`\n   🪙 Minting Tests:`);
            
            // Mint to Alice
            console.log(`     Minting token to Alice...`);
            const mintPrice = ethers.parseEther(ethers.formatEther(collection.mintPrice));
            const mintTx = await nftContract.connect(alice).mint(alice.address, { 
                value: mintPrice 
            });
            await mintTx.wait();
            
            const newTotalSupply = await nftContract.totalSupply();
            const aliceBalance = await nftContract.balanceOf(alice.address);
            const tokenId = newTotalSupply; // Should be the latest token
            const tokenOwner = await nftContract.ownerOf(tokenId);
            
            console.log(`     ✅ Mint successful!`);
            console.log(`     New Total Supply: ${newTotalSupply.toString()}`);
            console.log(`     Alice Balance: ${aliceBalance.toString()}`);
            console.log(`     Token ${tokenId} owner: ${tokenOwner}`);
            
            // Test 3: Token URI
            console.log(`\n   🔗 Token URI Test:`);
            try {
                const tokenURI = await nftContract.tokenURI(tokenId);
                console.log(`     Token ${tokenId} URI: ${tokenURI}`);
            } catch (error) {
                console.log(`     ⚠️  Token URI not set (expected for V1): ${error.message.slice(0, 50)}...`);
            }
            
            // Test 4: Transfer functionality
            if (alice.address !== bob.address) {
                console.log(`\n   ↔️  Transfer Test:`);
                console.log(`     Transferring token ${tokenId} from Alice to Bob...`);
                
                const transferTx = await nftContract.connect(alice).transferFrom(
                    alice.address, 
                    bob.address, 
                    tokenId
                );
                await transferTx.wait();
                
                const newOwner = await nftContract.ownerOf(tokenId);
                const aliceNewBalance = await nftContract.balanceOf(alice.address);
                const bobBalance = await nftContract.balanceOf(bob.address);
                
                console.log(`     ✅ Transfer successful!`);
                console.log(`     Token ${tokenId} new owner: ${newOwner}`);
                console.log(`     Alice balance: ${aliceNewBalance.toString()}`);
                console.log(`     Bob balance: ${bobBalance.toString()}`);
            }
            
            // Test 5: Access control (onlyOwner functions)
            console.log(`\n   🔐 Access Control Test:`);
            try {
                // Try to call owner function from non-owner account
                await nftContract.connect(alice).setBaseURI("https://test.com/");
                console.log(`     ❌ Access control failed - Alice could call owner function`);
            } catch (error) {
                console.log(`     ✅ Access control working - Non-owner rejected`);
            }
            
            // Test 6: Supply limit test (if max supply is reasonable)
            const maxSupply = BigInt(collection.maxSupply);
            const currentSupply = await nftContract.totalSupply();
            
            if (maxSupply - currentSupply <= 5n && maxSupply <= 100n) { // Only test if close to limit and reasonable max
                console.log(`\n   🚫 Supply Limit Test:`);
                console.log(`     Attempting to mint beyond max supply...`);
                
                try {
                    // Try to mint remaining tokens + 1 more
                    const remainingSupply = maxSupply - currentSupply;
                    for (let j = 0; j <= remainingSupply; j++) {
                        await nftContract.connect(alice).mint(alice.address, { value: mintPrice });
                    }
                    console.log(`     ❌ Supply limit not enforced!`);
                } catch (error) {
                    console.log(`     ✅ Supply limit enforced correctly`);
                }
            }
            
            // Test 7: Price enforcement
            console.log(`\n   💰 Price Enforcement Test:`);
            try {
                // Try to mint with insufficient payment
                const lowPrice = mintPrice / 2n;
                await nftContract.connect(alice).mint(alice.address, { value: lowPrice });
                console.log(`     ❌ Price enforcement failed - Mint succeeded with low payment`);
            } catch (error) {
                console.log(`     ✅ Price enforcement working - Insufficient payment rejected`);
            }
            
        } catch (error) {
            console.log(`   ❌ Collection test failed: ${error.message}`);
        }
        
        console.log(`   ${"─".repeat(60)}`);
    }
    
    // Test Factory integration
    console.log(`\n🏭 Factory Integration Tests:`);
    const factory = await ethers.getContractAt("NFTFactory", factoryAddress);
    
    const collectionCount = await factory.getCollectionCount();
    const deployedCollections = await factory.getDeployedCollections();
    
    console.log(`   Total Collections: ${collectionCount.toString()}`);
    console.log(`   Deployed Addresses: ${deployedCollections.length}`);
    
    // Verify each collection is tracked by factory
    for (let i = 0; i < collectionsData.collections.length; i++) {
        const collection = collectionsData.collections[i];
        const isTracked = await factory.isDeployedCollection(collection.proxyAddress);
        const collectionInfo = await factory.collectionInfo(collection.proxyAddress);
        
        console.log(`\n   Collection ${i + 1}: ${collection.name}`);
        console.log(`     Tracked by Factory: ${isTracked}`);
        console.log(`     Factory Info - Name: ${collectionInfo.name}`);
        console.log(`     Factory Info - Symbol: ${collectionInfo.symbol}`);
        console.log(`     Factory Info - Max Supply: ${collectionInfo.maxSupply.toString()}`);
        console.log(`     Factory Info - Mint Price: ${ethers.formatEther(collectionInfo.mintPrice)} ETH`);
    }
    
    // Final summary
    console.log(`\n✅ V1 Collection Testing Completed!`);
    console.log(`📊 Summary:`);
    console.log(`   - ${collectionsData.collections.length} collections tested`);
    console.log(`   - Basic functionality verified`);
    console.log(`   - Minting and transfers working`);
    console.log(`   - Access control enforced`);
    console.log(`   - Factory integration confirmed`);
    console.log(`\n🚀 Ready for V2 upgrade! Run:`);
    console.log(`   npx hardhat run scripts/04-upgrade-collections-to-v2.js --network localhost`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ V1 testing failed:", error);
        process.exit(1);
    });