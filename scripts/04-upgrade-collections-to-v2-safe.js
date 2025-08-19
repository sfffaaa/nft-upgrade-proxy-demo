const { ethers } = require("hardhat");
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Function to wait for transaction with timeout and reorg handling
async function waitForTransactionWithRetry(tx, description = "transaction", maxRetries = 3, timeoutMs = 60000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`   ⏳ Waiting for ${description} (attempt ${attempt}/${maxRetries}, timeout: ${timeoutMs/1000}s)...`);
            
            // Create a timeout promise
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Transaction wait timeout after ${timeoutMs/1000}s`)), timeoutMs)
            );
            
            // Race between transaction confirmation and timeout
            const receipt = await Promise.race([
                tx.wait(),
                timeoutPromise
            ]);
            
            console.log(`   ✅ ${description} confirmed!`);
            return receipt;
            
        } catch (error) {
            console.log(`   ❌ Attempt ${attempt} failed: ${error.message}`);
            
            if (attempt === maxRetries) {
                throw new Error(`Failed to confirm ${description} after ${maxRetries} attempts: ${error.message}`);
            }
            
            // Check if transaction is still pending
            try {
                const txStatus = await ethers.provider.getTransaction(tx.hash);
                if (txStatus && txStatus.blockNumber) {
                    console.log(`   🔍 Transaction was actually mined in block ${txStatus.blockNumber}, getting receipt...`);
                    return await ethers.provider.getTransactionReceipt(tx.hash);
                }
                console.log(`   🔍 Transaction still pending, retrying...`);
            } catch (checkError) {
                console.log(`   ⚠️  Could not check transaction status: ${checkError.message}`);
            }
            
            // Wait before retry
            console.log(`   ⏳ Waiting 10 seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }
}

// Function to handle reorg and stuck transactions
async function handleReorgAndStuckTransactions(deployer) {
    try {
        console.log("   🔧 Handling potential reorg situation...");
        
        // Get network nonce vs local nonce
        const networkNonce = await ethers.provider.getTransactionCount(deployer.address, "latest");
        const pendingNonce = await ethers.provider.getTransactionCount(deployer.address, "pending");
        
        console.log(`   Network nonce (latest): ${networkNonce}`);
        console.log(`   Pending nonce: ${pendingNonce}`);
        
        if (pendingNonce > networkNonce) {
            console.log(`   🚨 Found ${pendingNonce - networkNonce} stuck transaction(s)`);
            
            // Wait for block confirmations
            console.log("   ⏳ Waiting for network to stabilize...");
            await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second wait
            
            // Try to replace stuck transactions with higher gas
            const feeData = await ethers.provider.getFeeData();
            const higherGasPrice = feeData.gasPrice * 5n; // 5x current gas price
            
            for (let nonce = networkNonce; nonce < pendingNonce; nonce++) {
                try {
                    console.log(`   🔄 Replacing stuck tx at nonce ${nonce}...`);
                    const replaceTx = await deployer.sendTransaction({
                        to: deployer.address,
                        value: 0,
                        nonce: nonce,
                        gasLimit: 21000,
                        gasPrice: higherGasPrice,
                        type: 0
                    });
                    
                    console.log(`   📤 Replacement tx hash: ${replaceTx.hash}`);
                    // Don't wait for confirmation, send all replacements first
                } catch (replaceError) {
                    console.log(`   ⚠️  Could not replace nonce ${nonce}: ${replaceError.message}`);
                }
            }
            
            // Now wait for all replacements
            console.log("   ⏳ Waiting for replacement transactions...");
            await new Promise(resolve => setTimeout(resolve, 15000)); // 15 second wait
            
            // Check final nonce
            const finalNonce = await ethers.provider.getTransactionCount(deployer.address, "latest");
            console.log(`   Final nonce: ${finalNonce}`);
            
        } else {
            console.log("   ✅ No stuck transactions detected");
        }
        
    } catch (error) {
        console.log(`   ⚠️  Reorg handling failed: ${error.message}`);
        console.log("   Continuing with deployment anyway...");
    }
}

async function main() {
    console.log("🚀 Safe V2 Upgrade (skips already upgraded collections)...");

    const [deployer] = await ethers.getSigners();
    console.log("Upgrader:", deployer.address);

    // Detect network from Hardhat runtime environment
    const networkName = hre.network.name;
    console.log(`Network: ${networkName}`);
    
    // Show current block info
    const currentBlock = await ethers.provider.getBlock("latest");
    console.log(`Current block: #${currentBlock.number} (${currentBlock.hash.slice(0, 10)}...)`);
    console.log(`Block timestamp: ${new Date(currentBlock.timestamp * 1000).toISOString()}`);
    
    // Handle reorg and stuck transactions if not on localhost
    if (networkName !== "localhost" && networkName !== "hardhat") {
        await handleReorgAndStuckTransactions(deployer);
    }

    // Load infrastructure data
    const infraFile = path.join(__dirname, `../deployments/${networkName}-infrastructure.json`);
    if (!fs.existsSync(infraFile)) {
        throw new Error(`Infrastructure file not found: ${infraFile}. Please run step 1 first.`);
    }
    const infrastructureData = JSON.parse(fs.readFileSync(infraFile, "utf8"));
    const mainProxyAdminAddress = infrastructureData.contracts.ProxyAdmin;
    console.log("Main ProxyAdmin:", mainProxyAdminAddress);

    // Load collections data
    const collectionsFile = path.join(__dirname, `../deployments/${networkName}-collections.json`);
    if (!fs.existsSync(collectionsFile)) {
        throw new Error(`Collections file not found: ${collectionsFile}. Please run step 2 first.`);
    }
    const collectionsData = JSON.parse(fs.readFileSync(collectionsFile, "utf8"));

    // Deploy ERC721LogicV2Fixed with retry logic
    console.log("\n1. Deploying ERC721LogicV2Fixed implementation...");
    let logicV2Fixed;
    let logicV2FixedAddress;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            console.log(`   Attempt ${attempt}/3...`);
            const ERC721LogicV2Fixed = await ethers.getContractFactory("ERC721LogicV2Fixed");
            
            // Use higher gas price for testnet stability
            const feeData = await ethers.provider.getFeeData();
            const deployGasPrice = feeData.gasPrice * 2n;
            
            logicV2Fixed = await ERC721LogicV2Fixed.deploy({
                gasPrice: deployGasPrice,
                gasLimit: 2000000 // Explicit gas limit
            });
            
            const deployTx = logicV2Fixed.deploymentTransaction();
            console.log(`   📤 Deploy tx sent: ${deployTx.hash}`);
            console.log(`   📤 Deploy tx nonce: ${deployTx.nonce}`);
            
            // Show current block when tx is sent
            const currentBlockAtSend = await ethers.provider.getBlock("latest");
            console.log(`   📊 Current block when sent: #${currentBlockAtSend.number} (${currentBlockAtSend.hash.slice(0, 10)}...)`);
            console.log("   ⏳ Waiting for deployment confirmation...");
            
            const receipt = await logicV2Fixed.waitForDeployment();
            const deployReceipt = await waitForTransactionWithRetry(deployTx, "deployment");
            
            logicV2FixedAddress = await logicV2Fixed.getAddress();
            console.log("   ✅ ERC721LogicV2Fixed deployed to:", logicV2FixedAddress);
            console.log(`   📋 Deploy confirmed in block #${deployReceipt.blockNumber}, tx index: ${deployReceipt.index}`);
            console.log(`   ⛽ Gas used: ${deployReceipt.gasUsed.toString()}`);
            break; // Success, exit retry loop
            
        } catch (error) {
            console.log(`   ❌ Attempt ${attempt} failed: ${error.message}`);
            
            if (attempt === 3) {
                throw new Error(`Failed to deploy after 3 attempts: ${error.message}`);
            }
            
            // Wait before retry and handle potential stuck transactions
            console.log(`   ⏳ Waiting 15 seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, 15000));
            await handleReorgAndStuckTransactions(deployer);
        }
    }

    // Check and upgrade collections
    const collectionsToCheck = collectionsData.collections.slice(0, 2);
    console.log(`\n2. Checking ${collectionsToCheck.length} collections...`);

    const mainProxyAdmin = await ethers.getContractAt("ProxyAdmin", mainProxyAdminAddress);
    const upgradedCollections = [];
    
    for (let i = 0; i < collectionsToCheck.length; i++) {
        const collection = collectionsToCheck[i];
        console.log(`\n${i + 1}. Checking "${collection.name}" (${collection.symbol})`);
        console.log(`   Proxy Address: ${collection.proxyAddress}`);

        try {
            // Try to get version
            let currentVersion = "unknown";
            let isV2 = false;
            
            try {
                const v1Contract = await ethers.getContractAt("ERC721LogicV1", collection.proxyAddress);
                currentVersion = await v1Contract.getVersion();
                console.log(`   Current Version: ${currentVersion}`);
                
                if (currentVersion === "2.0.0") {
                    // Check if it's already V2Fixed by trying to call royaltyReceiver
                    try {
                        const v2Contract = await ethers.getContractAt("ERC721LogicV2Fixed", collection.proxyAddress);
                        const baseURI = await v2Contract.baseURI();
                        const royaltyReceiver = await v2Contract.royaltyReceiver();
                        console.log(`   ✅ Already V2Fixed with Base URI: ${baseURI}`);
                        console.log(`   ✅ Royalty Receiver: ${royaltyReceiver}`);
                        isV2 = true;
                    } catch (error) {
                        console.log(`   V2 but needs upgrade to V2Fixed (missing royalty getters)`);
                        isV2 = false;
                    }
                } else {
                    console.log(`   Needs upgrade from ${currentVersion} to V2Fixed`);
                }
            } catch (error) {
                console.log(`   ❌ Cannot determine version: ${error.message}`);
                continue;
            }

            if (!isV2) {
                // Upgrade this collection
                console.log(`   Upgrading to V2...`);
                
                console.log(`   Upgrading to V2Fixed and initializing features...`);
                
                // Prepare V2Fixed initialization data
                const ERC721LogicV2FixedInterface = ERC721LogicV2Fixed.interface;
                const initData = ERC721LogicV2FixedInterface.encodeFunctionData("initializeV2Features", [
                    `https://metadata.peaq.network/${collection.symbol.toLowerCase()}/`,
                    `https://metadata.peaq.network/${collection.symbol.toLowerCase()}/hidden.json`,
                    deployer.address, // Royalty receiver
                    250 // 2.5% royalty (250 basis points)
                ]);

                const upgradeTx = await mainProxyAdmin.upgradeAndCall(
                    collection.proxyAddress,
                    logicV2FixedAddress,
                    initData
                );
                console.log(`   📤 Upgrade tx sent: ${upgradeTx.hash}`);
                console.log(`   📤 Upgrade tx nonce: ${upgradeTx.nonce}`);
                
                // Show current block when tx is sent
                const currentBlockAtUpgrade = await ethers.provider.getBlock("latest");
                console.log(`   📊 Current block when sent: #${currentBlockAtUpgrade.number} (${currentBlockAtUpgrade.hash.slice(0, 10)}...)`);
                console.log("   ⏳ Waiting for upgrade confirmation...");
                
                const upgradeReceipt = await waitForTransactionWithRetry(upgradeTx, "upgrade");
                console.log(`   ✅ Upgraded to V2Fixed and initialized features!`);
                console.log(`   📋 Upgrade confirmed in block #${upgradeReceipt.blockNumber}, tx index: ${upgradeReceipt.index}`);
                console.log(`   ⛽ Gas used: ${upgradeReceipt.gasUsed.toString()}`);

                // Verify upgrade
                const upgradedContract = await ethers.getContractAt("ERC721LogicV2Fixed", collection.proxyAddress);
                const newVersion = await upgradedContract.getVersion();
                const baseURI = await upgradedContract.baseURI();
                const royaltyReceiver = await upgradedContract.royaltyReceiver();
                console.log(`   New Version: ${newVersion}`);
                console.log(`   Base URI: ${baseURI}`);
                console.log(`   Royalty Receiver: ${royaltyReceiver}`);
            }

            upgradedCollections.push({
                name: collection.name,
                symbol: collection.symbol,
                proxyAddress: collection.proxyAddress
            });

        } catch (error) {
            console.log(`   ❌ Failed: ${error.message}`);
        }
    }

    console.log("\n🎉 Safe upgrade process completed!");
    console.log(`✅ ${upgradedCollections.length} collections confirmed as V2`);
    
    // Save upgrade data
    const upgradeData = {
        network: networkName,
        upgradeTime: new Date().toISOString(),
        upgrader: deployer.address,
        newImplementation: logicV2FixedAddress,
        upgradedCollections: upgradedCollections
    };
    
    const upgradeFile = path.join(__dirname, `../deployments/${networkName}-upgrades.json`);
    fs.writeFileSync(upgradeFile, JSON.stringify(upgradeData, null, 2));
    console.log(`📁 Upgrade data saved to: ${upgradeFile}`);
}

main().catch(console.error);