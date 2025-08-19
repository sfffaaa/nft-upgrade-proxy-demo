const { ethers } = require("hardhat");

async function main() {
    const proxyAddresses = [
        "0xB955b6c65Ff69bfe07A557aa385055282b8a5eA3",
        "0xBf5A316F4303e13aE92c56D2D8C9F7629bEF5c6e"
    ];

    const mainProxyAdmin = "0x1613beB3B2C4f22Ee086B2b38C1476A3cE7f78E8";
    
    for (let i = 0; i < proxyAddresses.length; i++) {
        console.log(`\n=== Proxy ${i + 1}: ${proxyAddresses[i]} ===`);
        
        try {
            const proxyAdmin = await ethers.getContractAt("ProxyAdmin", mainProxyAdmin);
            
            // Use ERC1967 storage slots to get implementation
            const implementationSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
            const adminSlot = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
            
            const implData = await ethers.provider.getStorage(proxyAddresses[i], implementationSlot);
            const implementation = "0x" + implData.slice(-40);
            console.log(`Implementation: ${implementation}`);
            
            const adminData = await ethers.provider.getStorage(proxyAddresses[i], adminSlot);
            const admin = "0x" + adminData.slice(-40);
            console.log(`Admin: ${admin}`);
            
            // Try to call the proxy directly using low-level calls
            const getVersionSelector = "0x0d8e6e2c"; // getVersion()
            
            try {
                const result = await ethers.provider.call({
                    to: proxyAddresses[i],
                    data: getVersionSelector
                });
                console.log(`Raw getVersion result: ${result}`);
                
                if (result !== "0x") {
                    // Decode the result
                    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["string"], result);
                    console.log(`Decoded version: ${decoded[0]}`);
                } else {
                    console.log("Empty result - function may not exist");
                }
            } catch (error) {
                console.log(`Low-level call failed: ${error.message}`);
            }
            
        } catch (error) {
            console.log(`Error: ${error.message}`);
        }
    }
}

main().catch(console.error);