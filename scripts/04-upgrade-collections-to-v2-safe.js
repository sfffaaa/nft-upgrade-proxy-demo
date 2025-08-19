const { ethers } = require("hardhat");
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Safe V2 Upgrade (skips already upgraded collections)...");

    const [deployer] = await ethers.getSigners();
    console.log("Upgrader:", deployer.address);

    // Detect network from Hardhat runtime environment
    const networkName = hre.network.name;
    console.log(`Network: ${networkName}`);

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

    // Deploy ERC721LogicV2Fixed
    console.log("\n1. Deploying ERC721LogicV2Fixed implementation...");
    const ERC721LogicV2Fixed = await ethers.getContractFactory("ERC721LogicV2Fixed");
    const logicV2Fixed = await ERC721LogicV2Fixed.deploy();
    await logicV2Fixed.waitForDeployment();
    const logicV2FixedAddress = await logicV2Fixed.getAddress();
    console.log("✅ ERC721LogicV2Fixed deployed to:", logicV2FixedAddress);

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
                
                // For V2Fixed, we just upgrade without initialization since it doesn't have reinitializer
                // The V2Fixed initialization will be done after upgrade
                const initData = "0x";

                const upgradeTx = await mainProxyAdmin.upgradeAndCall(
                    collection.proxyAddress,
                    logicV2FixedAddress,
                    initData
                );
                await upgradeTx.wait();
                console.log(`   ✅ Upgraded to V2Fixed!`);

                // Initialize V2Fixed features
                console.log(`   Initializing V2Fixed features...`);
                const upgradedContract = await ethers.getContractAt("ERC721LogicV2Fixed", collection.proxyAddress);
                
                const initTx = await upgradedContract.initializeV2Features(
                    `https://metadata.peaq.network/${collection.symbol.toLowerCase()}/`,
                    `https://metadata.peaq.network/${collection.symbol.toLowerCase()}/hidden.json`,
                    deployer.address, // Royalty receiver
                    250 // 2.5% royalty (250 basis points)
                );
                await initTx.wait();
                console.log(`   ✅ V2Fixed features initialized!`);

                // Verify upgrade
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