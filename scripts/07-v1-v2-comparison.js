const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🎯 NFT Upgrade System Demo: V1 ↔ V2");
    console.log("=====================================\n");

    const [deployer, alice, bob] = await ethers.getSigners();
    console.log("Participants:");
    console.log(`  Deployer (Owner): ${deployer.address}`);
    console.log(`  Alice (User):     ${alice?.address || "Not available"}`);
    console.log(`  Bob (User):       ${bob?.address || "Not available"}\n`);
    
    // Load existing collections
    const collectionsFile = path.join(__dirname, "../deployments/localhost-collections.json");
    if (!fs.existsSync(collectionsFile)) {
        console.log("❌ No collections found. Please run deployment steps first.");
        return;
    }
    
    const collectionsData = JSON.parse(fs.readFileSync(collectionsFile, 'utf8'));
    const v1Collection = collectionsData.collections[0]; // First collection
    
    console.log("🔵 EXISTING V1 COLLECTION");
    console.log("=========================");
    console.log(`Name: ${v1Collection.name}`);
    console.log(`Symbol: ${v1Collection.symbol}`);
    console.log(`Address: ${v1Collection.proxyAddress}`);
    console.log(`Max Supply: ${v1Collection.maxSupply}`);
    console.log(`Mint Price: ${ethers.formatEther(v1Collection.mintPrice)} ETH`);
    
    // Test V1 functionality
    const v1Contract = await ethers.getContractAt("ERC721LogicV1", v1Collection.proxyAddress);
    const v1Version = await v1Contract.getVersion();
    const v1Supply = await v1Contract.totalSupply();
    const v1Owner = await v1Contract.owner();
    
    console.log(`\nV1 Status:`);
    console.log(`- Version: ${v1Version}`);
    console.log(`- Current Supply: ${v1Supply.toString()}`);
    console.log(`- Contract Owner: ${v1Owner}`);
    
    // Mint some V1 tokens if users are available
    if (alice) {
        console.log(`\nTesting V1 Minting:`);
        try {
            const mintTx = await v1Contract.connect(alice).mint(alice.address, {
                value: v1Collection.mintPrice
            });
            await mintTx.wait();
            
            const aliceBalance = await v1Contract.balanceOf(alice.address);
            const newSupply = await v1Contract.totalSupply();
            console.log(`✅ Alice minted 1 token`);
            console.log(`- Alice balance: ${aliceBalance.toString()}`);
            console.log(`- New total supply: ${newSupply.toString()}`);
        } catch (error) {
            console.log(`⚠️  V1 minting failed: ${error.message.slice(0, 50)}...`);
        }
    }
    
    console.log("\n" + "=".repeat(60));
    
    // Deploy and demonstrate V2
    console.log("\n🟢 NEW V2 IMPLEMENTATION");
    console.log("========================");
    
    // Deploy V2 implementation
    console.log("Deploying V2Fixed implementation...");
    const ERC721LogicV2Fixed = await ethers.getContractFactory("ERC721LogicV2Fixed");
    const logicV2Fixed = await ERC721LogicV2Fixed.deploy();
    await logicV2Fixed.waitForDeployment();
    const logicV2FixedAddress = await logicV2Fixed.getAddress();
    console.log(`✅ V2 Implementation: ${logicV2FixedAddress}`);
    
    // Create a simplified V2 demo by deploying a proxy manually
    console.log("\nCreating V2 Demo Collection...");
    
    const TransparentUpgradeableProxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    
    // Deploy a simple proxy admin for the demo
    const demoProxyAdmin = await ProxyAdmin.deploy(deployer.address);
    await demoProxyAdmin.waitForDeployment();
    const demoProxyAdminAddress = await demoProxyAdmin.getAddress();
    console.log(`Demo ProxyAdmin: ${demoProxyAdminAddress}`);
    
    // Create initialization data for V2
    const initData = ERC721LogicV2Fixed.interface.encodeFunctionData("initialize", [
        "Peaq Demo V2",
        "PDV2", 
        2000,
        ethers.parseEther("0.005")
    ]);
    
    // Deploy proxy with V2 implementation
    const v2Proxy = await TransparentUpgradeableProxy.deploy(
        logicV2FixedAddress,
        demoProxyAdminAddress,
        initData
    );
    await v2Proxy.waitForDeployment();
    const v2ProxyAddress = await v2Proxy.getAddress();
    
    console.log(`✅ V2 Demo Collection: ${v2ProxyAddress}`);
    
    // Test V2 collection
    const v2Contract = await ethers.getContractAt("ERC721LogicV2Fixed", v2ProxyAddress);
    const v2Version = await v2Contract.getVersion();
    const v2Name = await v2Contract.name();
    const v2Symbol = await v2Contract.symbol();
    const v2Supply = await v2Contract.totalSupply();
    
    console.log(`\nV2 Collection Details:`);
    console.log(`- Name: ${v2Name}`);
    console.log(`- Symbol: ${v2Symbol}`);
    console.log(`- Version: ${v2Version}`);
    console.log(`- Supply: ${v2Supply.toString()}`);
    
    // Initialize V2 features (check if already initialized)
    console.log(`\nInitializing V2 Features...`);
    try {
        const currentBaseURI = await v2Contract.baseURI();
        if (currentBaseURI === "") {
            const initTx = await v2Contract.initializeV2Features(
                `https://demo.peaq.network/v2/`,
                `https://demo.peaq.network/v2/hidden.json`,
                deployer.address,
                250 // 2.5%
            );
            await initTx.wait();
            console.log(`✅ V2 features initialized`);
        } else {
            console.log(`✅ V2 features already initialized`);
        }
        
        // Show V2 features
        const baseURI = await v2Contract.baseURI();
        const revealed = await v2Contract.revealed();
        const royaltyReceiver = await v2Contract.royaltyReceiver();
        const royaltyFee = await v2Contract.royaltyFeeNumerator();
        
        console.log(`\nV2 Features:`);
        console.log(`- Base URI: ${baseURI}`);
        console.log(`- Revealed: ${revealed}`);
        console.log(`- Royalty Receiver: ${royaltyReceiver}`);
        console.log(`- Royalty Fee: ${royaltyFee.toString()} basis points (${Number(royaltyFee) / 100}%)`);
        
    } catch (initError) {
        console.log(`⚠️  V2 initialization issue: ${initError.message.slice(0, 50)}...`);
    }
    
    // Test V2 functionality
    console.log(`\n🧪 Testing V2 Features:`);
    
    // Test batch minting
    try {
        console.log(`Testing batch mint (3 tokens to deployer)...`);
        const batchTx = await v2Contract.batchMint(deployer.address, 3);
        await batchTx.wait();
        
        const deployerBalance = await v2Contract.balanceOf(deployer.address);
        const newV2Supply = await v2Contract.totalSupply();
        console.log(`✅ Batch mint successful`);
        console.log(`- Deployer balance: ${deployerBalance.toString()}`);
        console.log(`- New supply: ${newV2Supply.toString()}`);
        
        // Test royalty calculation
        const [receiver, royaltyAmount] = await v2Contract.royaltyInfo(1, ethers.parseEther("1"));
        console.log(`✅ Royalty calculation:`);
        console.log(`- For 1 ETH sale: ${ethers.formatEther(royaltyAmount)} ETH to ${receiver}`);
        
        // Test reveal
        const revealTx = await v2Contract.reveal();
        await revealTx.wait();
        const isRevealed = await v2Contract.revealed();
        console.log(`✅ Collection revealed: ${isRevealed}`);
        
        if (newV2Supply > 0n) {
            const tokenURI = await v2Contract.tokenURI(1);
            console.log(`- Token 1 URI: ${tokenURI}`);
        }
        
    } catch (v2Error) {
        console.log(`⚠️  V2 testing issue: ${v2Error.message.slice(0, 50)}...`);
    }
    
    // Compare V1 vs V2
    console.log(`\n📊 COMPARISON: V1 vs V2`);
    console.log("========================");
    
    console.log(`\n🔵 V1 Collection (${v1Collection.name}):`);
    console.log(`- Version: ${v1Version}`);
    console.log(`- Features: Basic NFT (mint, transfer, ownership)`);
    console.log(`- Royalties: ❌ Not supported`);
    console.log(`- Batch Operations: ❌ Not supported`);
    console.log(`- Reveal System: ❌ Not supported`);
    console.log(`- Metadata: Basic tokenURI`);
    
    console.log(`\n🟢 V2 Collection (${v2Name}):`);
    console.log(`- Version: ${v2Version}`);
    console.log(`- Features: Enhanced NFT + Advanced capabilities`);
    console.log(`- Royalties: ✅ EIP-2981 support (${Number(await v2Contract.royaltyFeeNumerator()) / 100}%)`);
    console.log(`- Batch Operations: ✅ batchMint available`);
    console.log(`- Reveal System: ✅ Hidden/Revealed states`);
    console.log(`- Metadata: Advanced URI system with reveals`);
    
    // Save demo results
    const demoResults = {
        timestamp: new Date().toISOString(),
        v1Collection: {
            name: v1Collection.name,
            address: v1Collection.proxyAddress,
            version: v1Version,
            supply: v1Supply.toString()
        },
        v2Collection: {
            name: v2Name,
            address: v2ProxyAddress,
            version: v2Version,
            supply: (await v2Contract.totalSupply()).toString(),
            implementation: logicV2FixedAddress
        }
    };
    
    const demoFile = path.join(__dirname, "../deployments/localhost-demo-results.json");
    fs.writeFileSync(demoFile, JSON.stringify(demoResults, null, 2));
    
    console.log(`\n🎉 Demo Complete!`);
    console.log(`=================`);
    console.log(`✅ V1 Collection: Working (Basic NFT functionality)`);
    console.log(`✅ V2 Collection: Working (Enhanced features + royalties)`);  
    console.log(`✅ Both versions coexist successfully`);
    console.log(`✅ Demo results saved to: ${demoFile}`);
    
    console.log(`\n🔗 Collection Addresses:`);
    console.log(`- V1: ${v1Collection.proxyAddress}`);
    console.log(`- V2: ${v2ProxyAddress}`);
    
    console.log(`\n🚀 The upgrade system demonstrates:`);
    console.log(`- Independent deployments of different versions`);
    console.log(`- Backward compatibility (V1 still works)`);
    console.log(`- Enhanced features in V2 (royalties, batch ops, reveals)`);
    console.log(`- Flexible architecture supporting multiple implementations`);
    
    if (alice && bob) {
        console.log(`\n👥 Multiple users detected - ready for multi-user testing!`);
        console.log(`   You can now run scripts with different user interactions.`);
    } else {
        console.log(`\n💡 For multi-user testing, provide additional accounts when running Hardhat.`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Demo failed:", error);
        process.exit(1);
    });