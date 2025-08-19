const { ethers, upgrades } = require("hardhat");
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

// Function to clear stuck transactions
async function clearStuckTransactions(deployer) {
    try {
        const currentNonce = await deployer.getNonce();
        console.log(`   Current nonce: ${currentNonce}`);
        
        // Send a replacement transaction with higher gas price to clear mempool
        console.log("   🔧 Clearing any stuck transactions...");
        const clearTx = await deployer.sendTransaction({
            to: deployer.address,
            value: 0,
            nonce: currentNonce,
            gasLimit: 21000,
            gasPrice: ethers.parseUnits("2", "gwei")
        });
        
        await waitForTransactionWithRetry(clearTx, "stuck transaction clearing");
        console.log("   ✅ Transaction mempool cleared");
        
        const newNonce = await deployer.getNonce();
        console.log(`   New nonce: ${newNonce}`);
        
    } catch (error) {
        console.log("   ⚠️  No stuck transactions to clear");
    }
}

async function main() {
    console.log("🚀 Starting infrastructure deployment...\n");

    // Get the deployer account
    const signers = await ethers.getSigners();
    if (!signers || signers.length === 0) {
        throw new Error("No signers available. Make sure your local blockchain is running at http://127.0.0.1:10044");
    }
    
    const deployer = signers[0];
    const networkName = hre.network.name;
    
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
    console.log("Network:", networkName);
    
    // Clear stuck transactions if not on localhost
    if (networkName !== "localhost" && networkName !== "hardhat") {
        await clearStuckTransactions(deployer);
    }
    console.log();

    // Step 1: Deploy ERC721LogicV1 (implementation contract)
    console.log("1. Deploying ERC721LogicV1...");
    let logicV1Address;
    await executeTransactionWithFullRetry(async () => {
        const ERC721LogicV1 = await ethers.getContractFactory("ERC721LogicV1");
        const logicV1 = await ERC721LogicV1.deploy();
        const deployTx = logicV1.deploymentTransaction();
        console.log(`   📤 Deploy tx hash: ${deployTx.hash.slice(0, 10)}...`);
        console.log(`   ⏳ Waiting for contract deployment...`);
        
        // Add timeout protection
        const deploymentTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Deployment timeout after 120s")), 120000)
        );
        
        await Promise.race([
            logicV1.waitForDeployment(),
            deploymentTimeout
        ]);
        
        logicV1Address = await logicV1.getAddress();
        console.log("   🏭 ERC721LogicV1 deployed to:", logicV1Address);
        return deployTx;
    }, "ERC721LogicV1 deployment");
    console.log("   ✅ ERC721LogicV1 deployment completed!");

    // Step 2: Deploy ProxyAdmin
    console.log("\n2. Deploying ProxyAdmin...");
    let proxyAdminAddress;
    await executeTransactionWithFullRetry(async () => {
        const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
        const proxyAdmin = await ProxyAdmin.deploy(deployer.address);
        const deployTx = proxyAdmin.deploymentTransaction();
        console.log(`   📤 Deploy tx hash: ${deployTx.hash.slice(0, 10)}...`);
        console.log(`   ⏳ Waiting for contract deployment...`);
        
        // Add timeout protection
        const deploymentTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Deployment timeout after 120s")), 120000)
        );
        
        await Promise.race([
            proxyAdmin.waitForDeployment(),
            deploymentTimeout
        ]);
        
        proxyAdminAddress = await proxyAdmin.getAddress();
        console.log("   🏭 ProxyAdmin deployed to:", proxyAdminAddress);
        console.log("   ProxyAdmin owner:", deployer.address);
        return deployTx;
    }, "ProxyAdmin deployment");
    console.log("   ✅ ProxyAdmin deployment completed!");

    // Step 3: Deploy NFTFactory
    console.log("\n3. Deploying NFTFactory...");
    let factoryAddress;
    await executeTransactionWithFullRetry(async () => {
        const NFTFactory = await ethers.getContractFactory("NFTFactory");
        const factory = await NFTFactory.deploy(logicV1Address, proxyAdminAddress);
        const deployTx = factory.deploymentTransaction();
        console.log(`   📤 Deploy tx hash: ${deployTx.hash.slice(0, 10)}...`);
        console.log(`   ⏳ Waiting for contract deployment...`);
        
        // Add timeout protection
        const deploymentTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Deployment timeout after 120s")), 120000)
        );
        
        await Promise.race([
            factory.waitForDeployment(),
            deploymentTimeout
        ]);
        
        factoryAddress = await factory.getAddress();
        console.log("   🏭 NFTFactory deployed to:", factoryAddress);
        return deployTx;
    }, "NFTFactory deployment");
    console.log("   ✅ NFTFactory deployment completed!");

    // Save deployment addresses to a file for later use
    const deploymentData = {
        network: networkName,
        deploymentTime: new Date().toISOString(),
        deployer: deployer.address,
        contracts: {
            ERC721LogicV1: logicV1Address,
            ProxyAdmin: proxyAdminAddress,
            NFTFactory: factoryAddress
        }
    };

    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir);
    }

    const deploymentFile = path.join(deploymentsDir, `${networkName}-infrastructure.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));

    console.log("\n📄 Deployment Summary:");
    console.log("========================");
    console.log(`Network: ${networkName}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`ERC721LogicV1: ${logicV1Address}`);
    console.log(`ProxyAdmin: ${proxyAdminAddress}`);
    console.log(`NFTFactory: ${factoryAddress}`);
    console.log("========================");
    console.log(`\n✅ Infrastructure deployment complete!`);
    console.log(`Deployment data saved to: ${deploymentFile}`);

    // Verify contracts on Etherscan (if not on localhost)
    if (networkName !== "localhost" && networkName !== "hardhat") {
        console.log("\n🔍 Preparing contract verification...");
        console.log("Run the following commands to verify contracts:");
        console.log(`npx hardhat verify --network ${networkName} ${logicV1Address}`);
        console.log(`npx hardhat verify --network ${networkName} ${proxyAdminAddress} ${deployer.address}`);
        console.log(`npx hardhat verify --network ${networkName} ${factoryAddress} ${logicV1Address} ${proxyAdminAddress}`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });