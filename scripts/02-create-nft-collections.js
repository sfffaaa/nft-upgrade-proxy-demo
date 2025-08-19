const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🎨 Starting NFT collections creation...\n");

    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log("Creating collections with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

    // Load infrastructure deployment data
    const deploymentFile = path.join(__dirname, `../deployments/${network.name}-infrastructure.json`);
    if (!fs.existsSync(deploymentFile)) {
        throw new Error(`Infrastructure not deployed! Run 01-deploy-infrastructure.js first.`);
    }

    const infrastructureData = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
    const factoryAddress = infrastructureData.contracts.NFTFactory;

    // Connect to the factory contract
    const factory = await ethers.getContractAt("NFTFactory", factoryAddress);
    console.log("Connected to NFTFactory at:", factoryAddress);

    // Define collections to create
    const collections = [
        {
            name: "Peaq Genesis Collection",
            symbol: "PGC",
            maxSupply: 10000,
            mintPrice: ethers.parseEther("0.01")
        },
        {
            name: "Peaq Art Gallery",
            symbol: "PAG",
            maxSupply: 5000,
            mintPrice: ethers.parseEther("0.05")
        },
        {
            name: "Peaq Exclusive Pass",
            symbol: "PEP",
            maxSupply: 1000,
            mintPrice: ethers.parseEther("0.1")
        }
    ];

    const deployedCollections = [];

    console.log("\n📦 Creating NFT Collections:");
    console.log("=============================");

    for (let i = 0; i < collections.length; i++) {
        const collection = collections[i];
        console.log(`\n${i + 1}. Creating "${collection.name}" (${collection.symbol})...`);
        console.log(`   Max Supply: ${collection.maxSupply}`);
        console.log(`   Mint Price: ${ethers.formatEther(collection.mintPrice)} ETH`);

        const tx = await factory.createNFTCollection(
            collection.name,
            collection.symbol,
            collection.maxSupply,
            collection.mintPrice
        );

        const receipt = await tx.wait();
        
        // Get the deployed proxy address from events
        const event = receipt.logs.find(
            log => log.topics[0] === ethers.id("NFTCollectionDeployed(address,string,string,address,uint256,uint256)")
        );
        
        const proxyAddress = ethers.getAddress("0x" + event.topics[1].slice(26));
        
        console.log(`   ✅ Deployed to: ${proxyAddress}`);
        console.log(`   Gas used: ${receipt.gasUsed.toString()}`);

        deployedCollections.push({
            ...collection,
            proxyAddress,
            transactionHash: receipt.hash,
            blockNumber: receipt.blockNumber
        });
    }

    // Get all collections from factory
    const allCollections = await factory.getDeployedCollections();
    console.log(`\n📊 Total collections in factory: ${allCollections.length}`);

    // Save collection deployment data
    const collectionsData = {
        network: network.name,
        deploymentTime: new Date().toISOString(),
        deployer: deployer.address,
        factoryAddress: factoryAddress,
        collections: deployedCollections,
        allFactoryCollections: allCollections
    };

    const collectionsFile = path.join(__dirname, `../deployments/${network.name}-collections.json`);
    // Convert BigInt values to strings for JSON serialization
    const jsonData = JSON.stringify(collectionsData, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value, 2);
    fs.writeFileSync(collectionsFile, jsonData);

    console.log("\n📄 Deployment Summary:");
    console.log("========================");
    for (const collection of deployedCollections) {
        console.log(`\n${collection.name} (${collection.symbol})`);
        console.log(`  Address: ${collection.proxyAddress}`);
        console.log(`  Max Supply: ${collection.maxSupply}`);
        console.log(`  Mint Price: ${ethers.formatEther(collection.mintPrice)} ETH`);
    }
    console.log("========================");
    console.log(`\n✅ ${deployedCollections.length} NFT collections created successfully!`);
    console.log(`Deployment data saved to: ${collectionsFile}`);

    // Test minting on the first collection
    console.log("\n🧪 Testing mint function on first collection...");
    const firstCollection = await ethers.getContractAt("ERC721LogicV1", deployedCollections[0].proxyAddress);
    
    // Check version
    const version = await firstCollection.getVersion();
    console.log(`Collection version: ${version}`);
    
    // Mint a test NFT
    const mintTx = await firstCollection.mint(deployer.address, { value: deployedCollections[0].mintPrice });
    await mintTx.wait();
    
    const balance = await firstCollection.balanceOf(deployer.address);
    console.log(`✅ Test mint successful! Balance: ${balance} NFT(s)`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Collection creation failed:", error);
        process.exit(1);
    });