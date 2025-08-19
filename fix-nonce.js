const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    
    console.log("Checking account nonce...");
    console.log("Account:", deployer.address);
    
    const nonce = await deployer.getNonce();
    console.log("Current nonce:", nonce);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Balance:", ethers.formatEther(balance), "ETH");
    
    // Send a small transaction to bump the nonce if needed
    try {
        console.log("Sending small transaction to reset nonce...");
        const tx = await deployer.sendTransaction({
            to: deployer.address,
            value: 0,
            gasLimit: 21000
        });
        await tx.wait();
        console.log("✅ Nonce reset transaction completed");
        
        const newNonce = await deployer.getNonce();
        console.log("New nonce:", newNonce);
    } catch (error) {
        console.log("❌ Reset failed:", error.message);
    }
}

main().catch(console.error);