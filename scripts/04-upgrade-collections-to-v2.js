const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Upgrading collections via individual proxy admins...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Upgrader:", deployer.address);
    
    // Load deployment data
    const infrastructureFile = path.join(__dirname, "../deployments/localhost-infrastructure.json");
    const collectionsFile = path.join(__dirname, "../deployments/localhost-collections.json");
    
    const infrastructureData = JSON.parse(fs.readFileSync(infrastructureFile, 'utf8'));
    const collectionsData = JSON.parse(fs.readFileSync(collectionsFile, 'utf8'));

    const mainProxyAdminAddress = infrastructureData.contracts.ProxyAdmin;
    console.log("Main ProxyAdmin:", mainProxyAdminAddress);

    // Deploy V2Fixed implementation
    console.log("1. Deploying ERC721LogicV2 implementation...");
    const ERC721LogicV2 = await ethers.getContractFactory("ERC721LogicV2");
    const logicV2 = await ERC721LogicV2.deploy();
    await logicV2.waitForDeployment();
    const logicV2Address = await logicV2.getAddress();
    console.log("✅ V2 deployed to:", logicV2Address);

    // Read proxy admin addresses from storage for each collection
    const adminSlot = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
    
    const collectionsToUpgrade = collectionsData.collections.slice(0, 2); // First 2 collections as per original request
    
    console.log(`\n2. Upgrading ${collectionsToUpgrade.length} collections...`);
    
    for (let i = 0; i < collectionsToUpgrade.length; i++) {
        const collection = collectionsToUpgrade[i];
        console.log(`\n${i + 1}. Upgrading "${collection.name}" (${collection.symbol})`);
        console.log(`   Proxy Address: ${collection.proxyAddress}`);
        
        // Get the actual proxy admin address from storage
        const adminInStorage = await ethers.provider.getStorage(collection.proxyAddress, adminSlot);
        const actualAdminAddress = "0x" + adminInStorage.slice(-40);
        console.log(`   Actual Admin: ${actualAdminAddress}`);
        
        try {
            // Check current version
            const currentContract = await ethers.getContractAt("ERC721LogicV1", collection.proxyAddress);
            const versionBefore = await currentContract.getVersion();
            console.log(`   Current Version: ${versionBefore}`);
            
            // Connect to the actual proxy admin  
            const actualProxyAdmin = await ethers.getContractAt("ProxyAdmin", actualAdminAddress);
            
            // Check the ownership chain
            const adminOwner = await actualProxyAdmin.owner();
            console.log(`   Individual Admin Owner: ${adminOwner}`);
            console.log(`   Main ProxyAdmin: ${mainProxyAdminAddress}`);
            
            // If the individual admin is owned by the main ProxyAdmin, 
            // we need to work through the ownership chain properly
            if (adminOwner.toLowerCase() === mainProxyAdminAddress.toLowerCase()) {
                console.log(`   Individual admin owned by main ProxyAdmin - checking main admin ownership...`);
                
                const mainProxyAdmin = await ethers.getContractAt("ProxyAdmin", mainProxyAdminAddress);
                const mainAdminOwner = await mainProxyAdmin.owner();
                console.log(`   Main ProxyAdmin Owner: ${mainAdminOwner}`);
                
                if (mainAdminOwner.toLowerCase() !== deployer.address.toLowerCase()) {
                    console.log(`   ❌ Cannot upgrade: Deployer doesn't own main ProxyAdmin`);
                    continue;
                }
                
                // Since we own the main ProxyAdmin, and main ProxyAdmin owns the individual admin,
                // we should be able to upgrade directly through the main ProxyAdmin
                console.log(`   Attempting upgrade via main ProxyAdmin...`);
                
                try {
                    // Try using main ProxyAdmin to upgrade the proxy directly
                    const upgradeTx = await mainProxyAdmin.upgradeAndCall(
                        collection.proxyAddress,
                        logicV2FixedAddress,
                        "0x"
                    );
                    await upgradeTx.wait();
                    console.log(`   ✅ Upgrade completed via main ProxyAdmin!`);
                } catch (mainError) {
                    console.log(`   Main ProxyAdmin upgrade failed: ${mainError.message}`);
                    console.log(`   Trying individual admin approach...`);
                    
                    // Fallback: Use individual admin but it needs the right owner
                    // The issue is that the main ProxyAdmin can't directly control individual admins
                    // Let's try a different approach - check if main ProxyAdmin can upgrade the proxy
                    
                    // For now, skip this collection
                    console.log(`   ❌ Cannot upgrade this collection with current ownership setup`);
                    continue;
                }
                
            } else if (adminOwner.toLowerCase() === deployer.address.toLowerCase()) {
                // Direct ownership by deployer - upgrade with V2 initialization
                console.log(`   Upgrading directly (deployer owns individual admin)...`);
                
                // Prepare V2 initialization data
                const initData = ERC721LogicV2.interface.encodeFunctionData("initializeV2", [
                    `https://metadata.peaq.network/${collection.symbol.toLowerCase()}/`,
                    `https://metadata.peaq.network/${collection.symbol.toLowerCase()}/hidden.json`,
                    deployer.address, // Royalty receiver
                    250 // 2.5% royalty (250 basis points)
                ]);
                
                const upgradeTx = await actualProxyAdmin.upgradeAndCall(
                    collection.proxyAddress,
                    logicV2Address,
                    initData
                );
                await upgradeTx.wait();
                console.log(`   ✅ Upgrade and V2 initialization completed!`);
                
            } else {
                console.log(`   ❌ Cannot upgrade: Complex ownership chain not supported`);
                console.log(`   Individual admin owner: ${adminOwner}`);
                console.log(`   Expected: ${deployer.address} or ${mainProxyAdminAddress}`);
                continue;
            }
            
            // Verify the upgrade
            const upgradedContract = await ethers.getContractAt("ERC721LogicV2", collection.proxyAddress);
            const versionAfter = await upgradedContract.getVersion();
            console.log(`   New Version: ${versionAfter}`);
            
            // Test that existing functionality works
            const name = await upgradedContract.name();
            const symbol = await upgradedContract.symbol();
            console.log(`   ✅ Name: ${name}`);
            console.log(`   ✅ Symbol: ${symbol}`);
            
            // V2 features already initialized during upgrade
            
            // Test V2 features
            console.log(`   Testing V2 features...`);
            const baseURI = await upgradedContract.baseURI();
            const revealed = await upgradedContract.revealed();
            const royaltyReceiver = await upgradedContract.royaltyReceiver();
            const royaltyFee = await upgradedContract.royaltyFeeNumerator();
            
            console.log(`   ✅ Base URI: ${baseURI}`);
            console.log(`   ✅ Revealed: ${revealed}`);
            console.log(`   ✅ Royalty Receiver: ${royaltyReceiver}`);
            console.log(`   ✅ Royalty Fee: ${royaltyFee.toString()} basis points`);
            
            // Test royalty calculation
            const [receiver, royaltyAmount] = await upgradedContract.royaltyInfo(1, ethers.parseEther("1"));
            console.log(`   ✅ Royalty for 1 ETH: ${ethers.formatEther(royaltyAmount)} ETH to ${receiver}`);
            
        } catch (error) {
            console.log(`   ❌ Upgrade failed: ${error.message}`);
        }
    }

    console.log("\n🎉 Upgrade process completed!");
    
    // Save upgrade data
    const upgradeData = {
        network: "localhost",
        upgradeTime: new Date().toISOString(),
        upgrader: deployer.address,
        newImplementation: logicV2Address,
        upgradedCollections: collectionsToUpgrade.map(c => ({
            name: c.name,
            symbol: c.symbol,
            proxyAddress: c.proxyAddress
        }))
    };
    
    const upgradeFile = path.join(__dirname, `../deployments/localhost-upgrades.json`);
    fs.writeFileSync(upgradeFile, JSON.stringify(upgradeData, null, 2));
    console.log(`📁 Upgrade data saved to: ${upgradeFile}`);
}

main().catch(console.error);