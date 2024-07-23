const { expect, assert } = require("chai");
const { developmentChains, testURI } = require("../../helper-hardhat.confg");
const { network, getNamedAccounts, ethers, deployments } = require("hardhat");


!developmentChains.includes(network.name) ? describe.skip :
    describe("Bbl721 unit tests", () => {
        let bbl721, deployer, user;
        const chainId = network.config.chainId;
        beforeEach(async function () {
            deployer = (await getNamedAccounts()).deployer;
            user = (await getNamedAccounts()).user;
            await deployments.fixture(["all"]);
            bbl721 = await ethers.getContract("Bbl721", deployer);
        });

        describe("addListing function", function () {
            it("Should increase the tokenIdCount by one", async () => {
                const tokenURI = testURI;
                const price = 500000;
                const tokenIdCount = 0;
                const tx = await bbl721.addListing(testURI, price);
                await tx.wait(1);

                const updatedTokeIdCount = await bbl721.getTokenCounter();

                assert(updatedTokeIdCount > tokenIdCount);
            });
            it("Should update the property data", async () => {

            });
        });

    });