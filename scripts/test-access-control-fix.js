const { ethers } = require("hardhat");

async function main() {
    console.log("🔒 Testing Access Control Fix");
    console.log("═".repeat(50));

    // Get signers
    const [owner, alice] = await ethers.getSigners();
    console.log(`👑 Owner: ${owner.address}`);
    console.log(`👤 Alice (User): ${alice.address}`);

    // Deploy and test the fixed V2 contract
    console.log("\n1. 🚀 Deploying ERC721LogicV2Fixed...");
    const ERC721LogicV2Fixed = await ethers.getContractFactory("ERC721LogicV2Fixed");
    const logic = await ERC721LogicV2Fixed.deploy();
    await logic.waitForDeployment();
    const logicAddress = await logic.getAddress();
    console.log(`✅ Logic deployed at: ${logicAddress}`);

    // Deploy proxy admin
    console.log("\n2. 🛡️ Deploying ProxyAdmin...");
    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    const proxyAdmin = await ProxyAdmin.deploy(owner.address);
    await proxyAdmin.waitForDeployment();
    const proxyAdminAddress = await proxyAdmin.getAddress();
    console.log(`✅ ProxyAdmin deployed at: ${proxyAdminAddress}`);

    // Deploy transparent proxy
    console.log("\n3. 🏭 Deploying Custom Transparent Proxy...");
    const CustomTransparentProxy = await ethers.getContractFactory("CustomTransparentProxy");
    
    // Encode initialization data
    const initData = ERC721LogicV2Fixed.interface.encodeFunctionData("initialize", [
        "Test Collection",
        "TEST",
        1000, // maxSupply
        ethers.parseEther("0.01") // mintPrice
    ]);

    const proxy = await CustomTransparentProxy.deploy(
        logicAddress,
        proxyAdminAddress,
        initData
    );
    await proxy.waitForDeployment();
    const proxyAddress = await proxy.getAddress();
    console.log(`✅ Proxy deployed at: ${proxyAddress}`);

    // Initialize V2 features
    console.log("\n4. 🔧 Initializing V2 features...");
    const proxyAsV2 = ERC721LogicV2Fixed.attach(proxyAddress);
    await proxyAsV2.initializeV2Features(
        "https://test.com/",
        "https://test.com/hidden.json",
        owner.address,
        250 // 2.5%
    );
    console.log(`✅ V2 features initialized`);

    // Test access control
    console.log("\n5. 🧪 Testing Access Control...");
    
    // Connect as Alice (non-owner)
    const proxyAsAlice = proxyAsV2.connect(alice);
    
    console.log("\n   Testing setBaseURI (should FAIL for Alice):");
    try {
        await proxyAsAlice.setBaseURI("https://malicious.com/");
        console.log("   ❌ SECURITY VULNERABILITY: Alice can call setBaseURI!");
    } catch (error) {
        console.log("   ✅ SECURE: Alice cannot call setBaseURI");
        console.log(`   📋 Error: ${error.message.split('(')[0]}`);
    }

    console.log("\n   Testing reveal (should FAIL for Alice):");
    try {
        await proxyAsAlice.reveal();
        console.log("   ❌ SECURITY VULNERABILITY: Alice can call reveal!");
    } catch (error) {
        console.log("   ✅ SECURE: Alice cannot call reveal");
        console.log(`   📋 Error: ${error.message.split('(')[0]}`);
    }

    console.log("\n   Testing setRoyalty (should FAIL for Alice):");
    try {
        await proxyAsAlice.setRoyalty(alice.address, 9000); // 90% royalty!
        console.log("   ❌ SECURITY VULNERABILITY: Alice can call setRoyalty!");
    } catch (error) {
        console.log("   ✅ SECURE: Alice cannot call setRoyalty");
        console.log(`   📋 Error: ${error.message.split('(')[0]}`);
    }

    console.log("\n   Testing setTokenURI (should FAIL for Alice):");
    try {
        await proxyAsAlice.setTokenURI(1, "https://fake.com/1.json");
        console.log("   ❌ SECURITY VULNERABILITY: Alice can call setTokenURI!");
    } catch (error) {
        console.log("   ✅ SECURE: Alice cannot call setTokenURI");
        console.log(`   📋 Error: ${error.message.split('(')[0]}`);
    }

    // Test that owner CAN call these functions
    console.log("\n6. 👑 Testing Owner Access (should SUCCEED):");
    
    console.log("\n   Testing owner calling setBaseURI:");
    try {
        await proxyAsV2.setBaseURI("https://legitimate.com/");
        console.log("   ✅ SUCCESS: Owner can call setBaseURI");
    } catch (error) {
        console.log(`   ❌ ERROR: Owner cannot call setBaseURI: ${error.message}`);
    }

    console.log("\n   Testing owner calling reveal:");
    try {
        await proxyAsV2.reveal();
        console.log("   ✅ SUCCESS: Owner can call reveal");
    } catch (error) {
        console.log(`   ❌ ERROR: Owner cannot call reveal: ${error.message}`);
    }

    console.log("\n   Testing owner calling setRoyalty:");
    try {
        await proxyAsV2.setRoyalty(owner.address, 500); // 5% royalty
        console.log("   ✅ SUCCESS: Owner can call setRoyalty");
    } catch (error) {
        console.log(`   ❌ ERROR: Owner cannot call setRoyalty: ${error.message}`);
    }

    console.log("\n🎉 Access Control Test Complete!");
    console.log("═".repeat(50));
}

main().catch(console.error).finally(() => {
    process.exit(0);
});