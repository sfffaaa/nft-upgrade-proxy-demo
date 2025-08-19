const { ethers } = require("hardhat");

async function main() {
    const collections = [
        "0xB955b6c65Ff69bfe07A557aa385055282b8a5eA3",
        "0xBf5A316F4303e13aE92c56D2D8C9F7629bEF5c6e"
    ];

    for (let i = 0; i < collections.length; i++) {
        console.log(`\n=== Collection ${i + 1}: ${collections[i]} ===`);
        
        try {
            // Try V2 contract
            const v2Contract = await ethers.getContractAt("ERC721LogicV2", collections[i]);
            const version = await v2Contract.getVersion();
            const name = await v2Contract.name();
            const totalSupply = await v2Contract.totalSupply();
            
            console.log(`Version: ${version}`);
            console.log(`Name: ${name}`);
            console.log(`Total Supply: ${totalSupply}`);
            
            // Test if V2 functions exist
            try {
                const baseURI = await v2Contract.baseURI();
                console.log(`Base URI: ${baseURI}`);
                console.log("✅ V2 functions working");
                
                // Try calling batchMint to see the error
                console.log("Testing batchMint...");
                const [owner] = await ethers.getSigners();
                
                // Check current supply and max supply
                const maxSupply = await v2Contract.maxSupply();
                console.log(`Max Supply: ${maxSupply}`);
                console.log(`Current Supply: ${totalSupply}`);
                
                if (totalSupply < maxSupply) {
                    try {
                        const tx = await v2Contract.batchMint(owner.address, 1);
                        await tx.wait();
                        console.log("✅ batchMint works");
                    } catch (error) {
                        console.log(`❌ batchMint failed: ${error.message}`);
                        
                        // Try regular mint
                        try {
                            const mintTx = await v2Contract.mint(owner.address, {
                                value: ethers.parseEther("0.01")
                            });
                            await mintTx.wait();
                            console.log("✅ Regular mint works");
                        } catch (mintError) {
                            console.log(`❌ Regular mint failed: ${mintError.message}`);
                        }
                    }
                } else {
                    console.log("Collection is at max supply");
                }
                
            } catch (v2Error) {
                console.log(`❌ V2 functions failed: ${v2Error.message}`);
            }
            
        } catch (error) {
            console.log(`❌ Failed to connect as V2: ${error.message}`);
        }
    }
}

main().catch(console.error);