const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("NFT Upgrade System", function () {
    async function deployFixture() {
        const [owner, user1, user2] = await ethers.getSigners();

        // Deploy ERC721LogicV1
        const ERC721LogicV1 = await ethers.getContractFactory("ERC721LogicV1");
        const logicV1 = await ERC721LogicV1.deploy();
        await logicV1.waitForDeployment();

        // Deploy ProxyAdmin
        const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
        const proxyAdmin = await ProxyAdmin.deploy(owner.address);
        await proxyAdmin.waitForDeployment();

        // Deploy NFTFactory
        const NFTFactory = await ethers.getContractFactory("NFTFactory");
        const factory = await NFTFactory.deploy(
            await logicV1.getAddress(),
            await proxyAdmin.getAddress()
        );
        await factory.waitForDeployment();

        return { logicV1, proxyAdmin, factory, owner, user1, user2 };
    }

    describe("Infrastructure Deployment", function () {
        it("Should deploy all infrastructure contracts correctly", async function () {
            const { logicV1, proxyAdmin, factory, owner } = await loadFixture(deployFixture);

            expect(await logicV1.getAddress()).to.be.properAddress;
            expect(await proxyAdmin.getAddress()).to.be.properAddress;
            expect(await factory.getAddress()).to.be.properAddress;
            
            expect(await proxyAdmin.owner()).to.equal(owner.address);
            expect(await factory.owner()).to.equal(owner.address);
        });

        it("Should have correct logic contract and proxy admin in factory", async function () {
            const { logicV1, proxyAdmin, factory } = await loadFixture(deployFixture);

            expect(await factory.logicContract()).to.equal(await logicV1.getAddress());
            expect(await factory.proxyAdmin()).to.equal(await proxyAdmin.getAddress());
        });
    });

    describe("NFT Collection Creation", function () {
        it("Should create NFT collections through factory", async function () {
            const { factory } = await loadFixture(deployFixture);

            const tx = await factory.createNFTCollection(
                "Test Collection",
                "TEST",
                1000,
                ethers.parseEther("0.1")
            );

            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);

            const collections = await factory.getDeployedCollections();
            expect(collections.length).to.equal(1);
        });

        it("Should initialize collections with correct parameters", async function () {
            const { factory } = await loadFixture(deployFixture);

            await factory.createNFTCollection(
                "Test Collection",
                "TEST",
                1000,
                ethers.parseEther("0.1")
            );

            const collections = await factory.getDeployedCollections();
            const nftContract = await ethers.getContractAt("ERC721LogicV1", collections[0]);

            expect(await nftContract.name()).to.equal("Test Collection");
            expect(await nftContract.symbol()).to.equal("TEST");
            expect(await nftContract.maxSupply()).to.equal(1000);
            expect(await nftContract.mintPrice()).to.equal(ethers.parseEther("0.1"));
        });

        it("Should track collection metadata", async function () {
            const { factory, owner } = await loadFixture(deployFixture);

            await factory.createNFTCollection(
                "Test Collection",
                "TEST",
                1000,
                ethers.parseEther("0.1")
            );

            const collections = await factory.getDeployedCollections();
            const info = await factory.collectionInfo(collections[0]);

            expect(info.name).to.equal("Test Collection");
            expect(info.symbol).to.equal("TEST");
            expect(info.deployer).to.equal(owner.address);
            expect(info.maxSupply).to.equal(1000);
            expect(info.mintPrice).to.equal(ethers.parseEther("0.1"));
        });
    });

    describe("V1 Functionality", function () {
        it("Should mint NFTs correctly", async function () {
            const { factory, user1 } = await loadFixture(deployFixture);

            await factory.createNFTCollection(
                "Test Collection",
                "TEST",
                1000,
                ethers.parseEther("0.1")
            );

            const collections = await factory.getDeployedCollections();
            const nftContract = await ethers.getContractAt("ERC721LogicV1", collections[0]);

            await nftContract.connect(user1).mint(user1.address, { 
                value: ethers.parseEther("0.1") 
            });

            expect(await nftContract.balanceOf(user1.address)).to.equal(1);
            expect(await nftContract.ownerOf(1)).to.equal(user1.address);
        });

        it("Should enforce max supply", async function () {
            const { factory, user1 } = await loadFixture(deployFixture);

            await factory.createNFTCollection(
                "Test Collection",
                "TEST",
                2, // Max supply of 2
                ethers.parseEther("0.1")
            );

            const collections = await factory.getDeployedCollections();
            const nftContract = await ethers.getContractAt("ERC721LogicV1", collections[0]);

            await nftContract.mint(user1.address, { value: ethers.parseEther("0.1") });
            await nftContract.mint(user1.address, { value: ethers.parseEther("0.1") });

            await expect(
                nftContract.mint(user1.address, { value: ethers.parseEther("0.1") })
            ).to.be.revertedWith("Max supply reached");
        });

        it("Should return correct version", async function () {
            const { factory } = await loadFixture(deployFixture);

            await factory.createNFTCollection(
                "Test Collection",
                "TEST",
                1000,
                ethers.parseEther("0.1")
            );

            const collections = await factory.getDeployedCollections();
            const nftContract = await ethers.getContractAt("ERC721LogicV1", collections[0]);

            expect(await nftContract.getVersion()).to.equal("1.0.0");
        });
    });

    describe("Upgrade to V2", function () {
        it("Should upgrade collections to V2", async function () {
            const { factory, proxyAdmin } = await loadFixture(deployFixture);

            // Create a collection
            await factory.createNFTCollection(
                "Test Collection",
                "TEST",
                1000,
                ethers.parseEther("0.1")
            );

            const collections = await factory.getDeployedCollections();
            const proxyAddress = collections[0];

            // Deploy V2 logic
            const ERC721LogicV2 = await ethers.getContractFactory("ERC721LogicV2");
            const logicV2 = await ERC721LogicV2.deploy();
            await logicV2.waitForDeployment();

            // Upgrade the proxy
            await proxyAdmin.upgradeAndCall(
                proxyAddress,
                await logicV2.getAddress(),
                "0x"
            );

            // Initialize V2 features
            const nftV2 = await ethers.getContractAt("ERC721LogicV2", proxyAddress);
            await nftV2.initializeV2(
                "https://metadata.example.com/",
                "https://metadata.example.com/hidden.json",
                await proxyAdmin.owner(),
                250 // 2.5% royalty
            );

            expect(await nftV2.getVersion()).to.equal("2.0.0");
        });

        it("Should retain state after upgrade", async function () {
            const { factory, proxyAdmin, user1 } = await loadFixture(deployFixture);

            // Create collection and mint
            await factory.createNFTCollection(
                "Test Collection",
                "TEST",
                1000,
                ethers.parseEther("0.1")
            );

            const collections = await factory.getDeployedCollections();
            const proxyAddress = collections[0];
            const nftV1 = await ethers.getContractAt("ERC721LogicV1", proxyAddress);

            await nftV1.mint(user1.address, { value: ethers.parseEther("0.1") });
            const balanceBefore = await nftV1.balanceOf(user1.address);

            // Deploy and upgrade to V2
            const ERC721LogicV2 = await ethers.getContractFactory("ERC721LogicV2");
            const logicV2 = await ERC721LogicV2.deploy();
            await logicV2.waitForDeployment();

            await proxyAdmin.upgradeAndCall(
                proxyAddress,
                await logicV2.getAddress(),
                "0x"
            );

            const nftV2 = await ethers.getContractAt("ERC721LogicV2", proxyAddress);
            
            // Check state is retained
            expect(await nftV2.balanceOf(user1.address)).to.equal(balanceBefore);
            expect(await nftV2.ownerOf(1)).to.equal(user1.address);
            expect(await nftV2.name()).to.equal("Test Collection");
            expect(await nftV2.symbol()).to.equal("TEST");
        });

        it("Should have new V2 features after upgrade", async function () {
            const { factory, proxyAdmin, owner } = await loadFixture(deployFixture);

            // Create and upgrade collection
            await factory.createNFTCollection(
                "Test Collection",
                "TEST",
                1000,
                ethers.parseEther("0.1")
            );

            const collections = await factory.getDeployedCollections();
            const proxyAddress = collections[0];

            const ERC721LogicV2 = await ethers.getContractFactory("ERC721LogicV2");
            const logicV2 = await ERC721LogicV2.deploy();
            await logicV2.waitForDeployment();

            await proxyAdmin.upgradeAndCall(
                proxyAddress,
                await logicV2.getAddress(),
                "0x"
            );

            const nftV2 = await ethers.getContractAt("ERC721LogicV2", proxyAddress);
            await nftV2.initializeV2(
                "https://metadata.example.com/",
                "https://metadata.example.com/hidden.json",
                owner.address,
                250
            );

            // Test V2 features
            await nftV2.setWhitelistEnabled(true);
            expect(await nftV2.whitelistEnabled()).to.be.true;

            await nftV2.pause();
            await expect(
                nftV2.mint(owner.address, { value: ethers.parseEther("0.1") })
            ).to.be.revertedWithCustomError(nftV2, "EnforcedPause");

            await nftV2.unpause();
            
            // Check royalty info
            const [receiver, amount] = await nftV2.royaltyInfo(1, ethers.parseEther("1"));
            expect(receiver).to.equal(owner.address);
            expect(amount).to.equal(ethers.parseEther("0.025")); // 2.5%
        });
    });

    describe("Independent Upgradeability", function () {
        it("Should upgrade collections independently", async function () {
            const { factory, proxyAdmin } = await loadFixture(deployFixture);

            // Create two collections
            await factory.createNFTCollection("Collection 1", "COL1", 1000, ethers.parseEther("0.1"));
            await factory.createNFTCollection("Collection 2", "COL2", 1000, ethers.parseEther("0.1"));

            const collections = await factory.getDeployedCollections();
            const proxy1 = collections[0];
            const proxy2 = collections[1];

            // Deploy V2 logic
            const ERC721LogicV2 = await ethers.getContractFactory("ERC721LogicV2");
            const logicV2 = await ERC721LogicV2.deploy();
            await logicV2.waitForDeployment();

            // Upgrade only the first collection
            await proxyAdmin.upgradeAndCall(proxy1, await logicV2.getAddress(), "0x");

            const nft1 = await ethers.getContractAt("ERC721LogicV2", proxy1);
            await nft1.initializeV2(
                "https://metadata.example.com/",
                "https://metadata.example.com/hidden.json",
                await proxyAdmin.owner(),
                250
            );

            const nft2 = await ethers.getContractAt("ERC721LogicV1", proxy2);

            // Verify versions
            expect(await nft1.getVersion()).to.equal("2.0.0");
            expect(await nft2.getVersion()).to.equal("1.0.0");
        });
    });
});