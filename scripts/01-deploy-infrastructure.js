const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Starting infrastructure deployment...\n");

    // Get the deployer account
    const signers = await ethers.getSigners();
    if (!signers || signers.length === 0) {
        throw new Error("No signers available. Make sure your local blockchain is running at http://127.0.0.1:10044");
    }
    
    const deployer = signers[0];
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

    // Step 1: Deploy ERC721LogicV1 (implementation contract)
    console.log("1. Deploying ERC721LogicV1...");
    const ERC721LogicV1 = await ethers.getContractFactory("ERC721LogicV1");
    const logicV1 = await ERC721LogicV1.deploy();
    await logicV1.waitForDeployment();
    const logicV1Address = await logicV1.getAddress();
    console.log("   ✅ ERC721LogicV1 deployed to:", logicV1Address);

    // Step 2: Deploy ProxyAdmin
    console.log("\n2. Deploying ProxyAdmin...");
    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    const proxyAdmin = await ProxyAdmin.deploy(deployer.address);
    await proxyAdmin.waitForDeployment();
    const proxyAdminAddress = await proxyAdmin.getAddress();
    console.log("   ✅ ProxyAdmin deployed to:", proxyAdminAddress);
    console.log("   ProxyAdmin owner:", deployer.address);

    // Step 3: Deploy NFTFactory
    console.log("\n3. Deploying NFTFactory...");
    const NFTFactory = await ethers.getContractFactory("NFTFactory");
    const factory = await NFTFactory.deploy(logicV1Address, proxyAdminAddress);
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log("   ✅ NFTFactory deployed to:", factoryAddress);

    // Save deployment addresses to a file for later use
    const deploymentData = {
        network: network.name,
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

    const deploymentFile = path.join(deploymentsDir, `${network.name}-infrastructure.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));

    console.log("\n📄 Deployment Summary:");
    console.log("========================");
    console.log(`Network: ${network.name}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`ERC721LogicV1: ${logicV1Address}`);
    console.log(`ProxyAdmin: ${proxyAdminAddress}`);
    console.log(`NFTFactory: ${factoryAddress}`);
    console.log("========================");
    console.log(`\n✅ Infrastructure deployment complete!`);
    console.log(`Deployment data saved to: ${deploymentFile}`);

    // Verify contracts on Etherscan (if not on localhost)
    if (network.name !== "localhost" && network.name !== "hardhat") {
        console.log("\n🔍 Preparing contract verification...");
        console.log("Run the following commands to verify contracts:");
        console.log(`npx hardhat verify --network ${network.name} ${logicV1Address}`);
        console.log(`npx hardhat verify --network ${network.name} ${proxyAdminAddress} ${deployer.address}`);
        console.log(`npx hardhat verify --network ${network.name} ${factoryAddress} ${logicV1Address} ${proxyAdminAddress}`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });