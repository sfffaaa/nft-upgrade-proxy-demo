const { ethers } = require("hardhat");
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Function to backtrack recent blocks to find a transaction (inspired by peaq-bc-test)
async function backtrackBlocksForTransaction(txHash, maxBlocks = 10) {
    try {
        const currentBlock = await ethers.provider.getBlockNumber();
        console.log(`   🔍 Backtracking ${maxBlocks} blocks from block ${currentBlock} to find tx ${txHash.slice(0, 10)}...`);
        
        for (let i = 0; i < maxBlocks; i++) {
            const blockNum = currentBlock - i;
            if (blockNum < 0) break;
            
            try {
                const block = await ethers.provider.getBlock(blockNum, true);
                if (block && block.transactions) {
                    for (let txIndex = 0; txIndex < block.transactions.length; txIndex++) {
                        const blockTx = block.transactions[txIndex];
                        if (blockTx.hash === txHash) {
                            console.log(`   ✅ Found tx ${txHash.slice(0, 10)} in block ${blockNum} at index ${txIndex}`);
                            return await ethers.provider.getTransactionReceipt(txHash);
                        }
                    }
                }
            } catch (blockError) {
                console.log(`   ⚠️  Could not fetch block ${blockNum}: ${blockError.message}`);
            }
        }
        
        console.log(`   ❌ Transaction ${txHash.slice(0, 10)} not found in last ${maxBlocks} blocks`);
        return null;
    } catch (error) {
        console.log(`   ⚠️  Backtrack search failed: ${error.message}`);
        return null;
    }
}

// Enhanced wait function with backtrack search (inspired by peaq-bc-test approach)
async function waitForTransactionWithRetry(tx, description = "transaction", maxRetries = 3, timeoutMs = 30000) {
    const BLOCK_WAIT_TIME = 15000; // 15 seconds between blocks (similar to substrate 4-block wait)
    
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
                // Final attempt: try backtrack search before giving up
                console.log(`   🔍 Final attempt: searching recent blocks for transaction...`);
                const backtrackReceipt = await backtrackBlocksForTransaction(tx.hash);
                if (backtrackReceipt) {
                    console.log(`   ✅ ${description} found via backtrack search!`);
                    return backtrackReceipt;
                }
                
                // Ultimate fallback: suggest manual retry
                console.log(`   ⚠️  Transaction ${tx.hash.slice(0, 10)} may have been lost due to severe reorg`);
                console.log(`   💡 Suggestion: The transaction may need to be re-submitted manually`);
                throw new Error(`Failed to confirm ${description} after ${maxRetries} attempts and backtrack search. Transaction may be lost due to reorg.`);
            }
            
            // Wait for blocks to settle (inspired by substrate wait_for_n_blocks pattern)
            console.log(`   ⏳ Waiting ${BLOCK_WAIT_TIME/1000}s for blocks to settle...`);
            await new Promise(resolve => setTimeout(resolve, BLOCK_WAIT_TIME));
            
            // Try backtrack search during retry
            console.log(`   🔍 Checking if transaction was included during reorg...`);
            const backtrackReceipt = await backtrackBlocksForTransaction(tx.hash);
            if (backtrackReceipt) {
                console.log(`   ✅ ${description} found via backtrack search during retry!`);
                return backtrackReceipt;
            }
            
            console.log(`   🔄 Transaction not found in recent blocks, will retry with new attempt...`);
        }
    }
}

// Function to execute transaction with full retry including re-submission
async function executeTransactionWithFullRetry(txFunction, description = "transaction", maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`   📤 Executing ${description} (attempt ${attempt}/${maxRetries})...`);
            const tx = await txFunction();
            console.log(`   📤 Transaction sent: ${tx.hash.slice(0, 10)}...`);
            
            const receipt = await waitForTransactionWithRetry(tx, description, 2, 45000); // 2 retries, 45s timeout per retry
            return receipt;
            
        } catch (error) {
            console.log(`   ❌ Full retry attempt ${attempt} failed: ${error.message}`);
            
            if (attempt === maxRetries) {
                throw new Error(`Failed to execute ${description} after ${maxRetries} full retry attempts: ${error.message}`);
            }
            
            // Wait longer between full retries
            console.log(`   ⏳ Waiting 30s before full re-submission retry...`);
            await new Promise(resolve => setTimeout(resolve, 30000));
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

    // Deploy ERC721LogicV2Fixed with full retry logic
    console.log("\n1. Deploying ERC721LogicV2Fixed implementation...");
    let logicV2FixedAddress;
    
    const deployReceipt = await executeTransactionWithFullRetry(async () => {
        const ERC721LogicV2Fixed = await ethers.getContractFactory("ERC721LogicV2Fixed");
        
        // Use higher gas price for testnet stability
        const feeData = await ethers.provider.getFeeData();
        const deployGasPrice = feeData.gasPrice * 2n;
        
        console.log("   📤 Deploying with gas price:", ethers.formatUnits(deployGasPrice, "gwei"), "gwei");
        const logicV2Fixed = await ERC721LogicV2Fixed.deploy({
            gasPrice: deployGasPrice,
            gasLimit: 3000000 // Increased gas limit for larger contract
        });
        
        const deployTx = logicV2Fixed.deploymentTransaction();
        console.log(`   📤 Deploy tx hash: ${deployTx.hash.slice(0, 10)}...`);
        console.log(`   📤 Deploy tx nonce: ${deployTx.nonce}`);
        
        // Show current block when tx is sent
        const currentBlockAtSend = await ethers.provider.getBlock("latest");
        console.log(`   📊 Current block when sent: #${currentBlockAtSend.number} (${currentBlockAtSend.hash.slice(0, 10)}...)`);
        
        // Wait for deployment with timeout
        console.log("   ⏳ Waiting for contract deployment...");
        const deploymentTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Deployment timeout after 120s")), 120000)
        );
        
        await Promise.race([
            logicV2Fixed.waitForDeployment(),
            deploymentTimeout
        ]);
        
        logicV2FixedAddress = await logicV2Fixed.getAddress();
        console.log("   🏭 Contract deployed to:", logicV2FixedAddress);
        
        return deployTx;
    }, "ERC721LogicV2Fixed deployment");
    
    console.log("   ✅ ERC721LogicV2Fixed deployment completed!");
    console.log(`   📋 Deploy confirmed in block #${deployReceipt.blockNumber}, tx index: ${deployReceipt.index}`);
    console.log(`   ⛽ Gas used: ${deployReceipt.gasUsed.toString()}`);

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
                
                const upgradeReceipt = await executeTransactionWithFullRetry(async () => {
                    // Prepare V2Fixed initialization data
                    const ERC721LogicV2FixedFactory = await ethers.getContractFactory("ERC721LogicV2Fixed");
                    const initData = ERC721LogicV2FixedFactory.interface.encodeFunctionData("initializeV2Features", [
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
                    
                    console.log(`   📤 Upgrade tx nonce: ${upgradeTx.nonce}`);
                    
                    // Show current block when tx is sent
                    const currentBlockAtUpgrade = await ethers.provider.getBlock("latest");
                    console.log(`   📊 Current block when sent: #${currentBlockAtUpgrade.number} (${currentBlockAtUpgrade.hash.slice(0, 10)}...)`);
                    
                    return upgradeTx;
                }, `upgrade of ${collection.name}`);
                
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

    // Clean up provider connections to prevent hanging
    try {
        if (ethers.provider && typeof ethers.provider.destroy === 'function') {
            await ethers.provider.destroy();
            console.log("🔌 Provider connection cleaned up");
        } else if (ethers.provider && typeof ethers.provider.removeAllListeners === 'function') {
            ethers.provider.removeAllListeners();
            console.log("🔌 Provider listeners cleaned up");
        }
    } catch (error) {
        console.log("⚠️  Provider cleanup warning:", error.message);
    }

    // Force exit to prevent hanging (standard for deployment scripts)
    process.exit(0);
}

main().catch(console.error);