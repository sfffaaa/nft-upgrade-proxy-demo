const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");
const { Keyring } = require("@polkadot/keyring");
const { cryptoWaitReady } = require("@polkadot/util-crypto");
const { ApiPromise, WsProvider } = require("@polkadot/api");

const execAsync = promisify(exec);

async function main() {
    console.log("🚀 Starting Complete Fresh Deployment Workflow");
    console.log("===============================================\n");

    // Step 1: Clean up previous deployments
    console.log("1. 🧹 Cleaning up previous deployment artifacts...");
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (fs.existsSync(deploymentsDir)) {
        const files = fs.readdirSync(deploymentsDir);
        for (const file of files) {
            fs.unlinkSync(path.join(deploymentsDir, file));
            console.log(`   ✅ Removed ${file}`);
        }
    } else {
        fs.mkdirSync(deploymentsDir);
    }
    console.log("   ✅ Deployment artifacts cleaned\n");

    // Step 2: Transfer tokens from //Alice to three accounts  
    console.log("2. 💰 Transferring 100 ETH from //Alice to three accounts...");
    
    // Initialize crypto and create substrate //Alice keypair (matching peaq-bc-test pattern)
    console.log("   🔧 Initializing Polkadot.js crypto...");
    await cryptoWaitReady();
    
    const keyring = new Keyring({ type: 'sr25519' });
    const aliceKeypair = keyring.addFromUri('//Alice');
    
    console.log(`   🔑 Substrate //Alice address: ${aliceKeypair.address}`);
    
    // Get hardhat signers for recipient accounts
    const signers = await ethers.getSigners();
    
    // Get the three recipient ETH addresses (the configured test accounts)
    const recipients = [
        { name: "Owner/Deployer", address: signers[0].address },  // Will be used as deployer in scripts  
        { name: "Charlie", address: signers[1].address },         // Test user Charlie
        { name: "Diana", address: signers[2] ? signers[2].address : signers[1].address }  // Test user Diana
    ];

    // For localhost Hardhat network, we'll simulate the substrate transfer pattern
    // In a real Peaq network, this would use substrate.tx.balances.transfer
    console.log("   🚀 Using //Alice as funder (simulated substrate pattern)...");
    
    // Connect to substrate API (for localhost, we'll use a fallback simulation)
    let api;
    try {
        // Try to connect to local substrate node
        const provider = new WsProvider('ws://127.0.0.1:10044');
        api = await ApiPromise.create({ provider });
        console.log("   ✅ Connected to substrate node");
    } catch (error) {
        console.log("   ⚠️  No substrate node available, using ethers simulation");
        api = null;
    }

    const transferAmount = ethers.parseEther("100"); // 100 ETH per recipient
    
    if (api && api.tx && api.tx.balances && api.tx.balances.transfer) {
        // Real substrate transfer (like peaq-bc-test)
        console.log("   📤 Executing substrate transfers from //Alice...");
        
        for (let i = 0; i < recipients.length; i++) {
            const recipient = recipients[i];
            console.log(`   Transferring 100 ETH to ${recipient.name} (${recipient.address})...`);
            
            // Calculate EVM account from recipient address (peaq pattern)
            const transfer = api.tx.balances.transfer(recipient.address, transferAmount);
            const hash = await transfer.signAndSend(aliceKeypair);
            
            console.log(`   📋 Transfer hash: ${hash.toHex()}`);
            console.log(`   ✅ ${recipient.name} transfer submitted`);
        }
        
        await api.disconnect();
        
    } else {
        if (api) {
            console.log("   ⚠️  Connected node doesn't have balances pallet, using ethers simulation");
            await api.disconnect();
        }
        // Fallback: Use ethers with //Alice derived private key  
        console.log("   📤 Executing ethers transfers from derived //Alice...");
        
        // Convert substrate keypair to EVM private key
        const substrateAliceBytes = aliceKeypair.publicKey;
        const alicePrivateKey = "0x" + Buffer.from(substrateAliceBytes.slice(0, 32)).toString('hex').padStart(64, '0');
        
        // Create ethers wallet from derived private key
        const aliceWallet = new ethers.Wallet(alicePrivateKey, ethers.provider);
        console.log(`   💰 Derived EVM //Alice address: ${aliceWallet.address}`);
        
        // Fund //Alice first from hardhat account
        const funder = signers[0];
        const funderBalance = await ethers.provider.getBalance(funder.address);
        console.log(`   💸 Funding //Alice from ${funder.address} (balance: ${ethers.formatEther(funderBalance)} ETH)...`);
        
        // Use a reasonable funding amount (leave room for gas) 
        const availableForFunding = funderBalance - ethers.parseEther("50"); // Leave 50 ETH for gas
        const fundingAmount = availableForFunding > ethers.parseEther("100") ? ethers.parseEther("100") : availableForFunding;
        const fundTx = await funder.sendTransaction({
            to: aliceWallet.address,
            value: fundingAmount,
            gasLimit: 21000
        });
        await fundTx.wait();
        
        const aliceBalance = await ethers.provider.getBalance(aliceWallet.address);
        console.log(`   💳 //Alice balance: ${ethers.formatEther(aliceBalance)} ETH`);
        
        // Now transfer from //Alice to recipients
        for (let i = 0; i < recipients.length; i++) {
            const recipient = recipients[i];
            console.log(`   Transferring 100 ETH to ${recipient.name} (${recipient.address})...`);
            
            const tx = await aliceWallet.sendTransaction({
                to: recipient.address,
                value: transferAmount,
                gasLimit: 21000
            });
            
            await tx.wait();
            const balance = await ethers.provider.getBalance(recipient.address);
            console.log(`   ✅ ${recipient.name} balance: ${ethers.formatEther(balance)} ETH`);
        }
        
        const aliceFinalBalance = await ethers.provider.getBalance(aliceWallet.address);
        console.log(`   💳 //Alice final balance: ${ethers.formatEther(aliceFinalBalance)} ETH`);
    }
    
    console.log("   ✅ All transfers completed\n");

    // Step 3: Run scripts in sequence
    const scripts = [
        { number: "01", name: "deploy-infrastructure", description: "Deploy core infrastructure" },
        { number: "02", name: "create-nft-collections", description: "Create NFT collections" },
        { number: "03", name: "upgrade-collections-to-v2-safe", description: "Upgrade to V2Fixed" },
        { number: "04", name: "advanced-v2-operations", description: "Test V2 features" }
    ];

    for (let i = 0; i < scripts.length; i++) {
        const script = scripts[i];
        console.log(`${parseInt(script.number) + 2}. 📜 Running Script ${script.number}: ${script.description}...`);
        console.log("═".repeat(80));
        
        try {
            const { stdout, stderr } = await execAsync(`npx hardhat run scripts/${script.number}-${script.name}.js --network localhost`);
            
            if (stderr && !stderr.includes("Warning")) {
                console.log("⚠️  Script warnings:", stderr);
            }
            
            console.log(stdout);
            console.log(`✅ Script ${script.number} completed successfully\n`);
            
        } catch (error) {
            console.error(`❌ Script ${script.number} failed:`, error.message);
            console.log("📊 Error details:", error.stdout || error.stderr);
            process.exit(1);
        }
    }

    // Step 4: Show final summary
    console.log("🎉 Complete Fresh Deployment Workflow Finished!");
    console.log("===============================================");
    console.log("✅ All scripts executed successfully:");
    console.log("   • Infrastructure deployed (ERC721LogicV1, ProxyAdmin, NFTFactory)");
    console.log("   • NFT collections created and tested"); 
    console.log("   • Collections upgraded to V2Fixed");
    console.log("   • V2 features tested (batch mint, reveal, royalties, etc.)");
    console.log("\n🔍 Check the deployments/ directory for deployment artifacts");
    console.log("📋 Review the test results for detailed operation logs");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Complete deployment workflow failed:", error);
        process.exit(1);
    });