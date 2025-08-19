const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Upgrading collections to V2...");

    const [deployer] = await ethers.getSigners();
    console.log("Upgrader:", deployer.address);

    // Load infrastructure data
    const infraFile = path.join(__dirname, "../deployments/localhost-infrastructure.json");
    const infrastructureData = JSON.parse(fs.readFileSync(infraFile, "utf8"));
    const mainProxyAdminAddress = infrastructureData.contracts.ProxyAdmin;
    console.log("Main ProxyAdmin:", mainProxyAdminAddress);

    // Load collections data
    const collectionsFile = path.join(__dirname, "../deployments/localhost-collections.json");
    const collectionsData = JSON.parse(fs.readFileSync(collectionsFile, "utf8"));

    // Deploy ERC721LogicV2
    console.log("\n1. Deploying ERC721LogicV2 implementation...");
    const ERC721LogicV2 = await ethers.getContractFactory("ERC721LogicV2");
    const logicV2 = await ERC721LogicV2.deploy();
    await logicV2.waitForDeployment();
    const logicV2Address = await logicV2.getAddress();
    console.log("✅ ERC721LogicV2 deployed to:", logicV2Address);

    // Upgrade first 2 collections
    const collectionsToUpgrade = collectionsData.collections.slice(0, 2);
    console.log(`\n2. Upgrading ${collectionsToUpgrade.length} collections...`);

    const mainProxyAdmin = await ethers.getContractAt("ProxyAdmin", mainProxyAdminAddress);
    
    for (let i = 0; i < collectionsToUpgrade.length; i++) {
        const collection = collectionsToUpgrade[i];
        console.log(`\n${i + 1}. Upgrading "${collection.name}" (${collection.symbol})`);
        console.log(`   Proxy Address: ${collection.proxyAddress}`);

        try {
            // Check current version
            const currentContract = await ethers.getContractAt("ERC721LogicV1", collection.proxyAddress);
            const versionBefore = await currentContract.getVersion();
            console.log(`   Current Version: ${versionBefore}`);

            // Prepare V2 initialization data
            const initData = ERC721LogicV2.interface.encodeFunctionData("initializeV2", [
                `https://metadata.peaq.network/${collection.symbol.toLowerCase()}/`,
                `https://metadata.peaq.network/${collection.symbol.toLowerCase()}/hidden.json`,
                deployer.address, // Royalty receiver
                250 // 2.5% royalty (250 basis points)
            ]);

            // Upgrade with V2 initialization
            console.log(`   Upgrading with V2 initialization...`);
            const upgradeTx = await mainProxyAdmin.upgradeAndCall(
                collection.proxyAddress,
                logicV2Address,
                initData
            );
            await upgradeTx.wait();
            console.log(`   ✅ Upgrade and V2 initialization completed!`);

            // Verify the upgrade
            const upgradedContract = await ethers.getContractAt("ERC721LogicV2", collection.proxyAddress);
            const versionAfter = await upgradedContract.getVersion();
            console.log(`   New Version: ${versionAfter}`);

            // Test basic functionality
            const name = await upgradedContract.name();
            const symbol = await upgradedContract.symbol();
            console.log(`   ✅ Name: ${name}`);
            console.log(`   ✅ Symbol: ${symbol}`);

            // Test V2 features
            console.log(`   Testing V2 features...`);
            const baseURI = await upgradedContract.baseURI();
            const revealed = await upgradedContract.revealed();
            console.log(`   ✅ Base URI: ${baseURI}`);
            console.log(`   ✅ Revealed: ${revealed}`);

            // Test royalty info
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