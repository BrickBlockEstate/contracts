const { expect, assert } = require("chai");
const { developmentChains, testURI } = require("../../helper-hardhat.confg");
const { network, getNamedAccounts, ethers, deployments } = require("hardhat");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("FractionalOwnership unit tests", () => {
      let fractionalOwnership, deployer, user;
      const chainId = network.config.chainId;
      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;
        user = (await getNamedAccounts()).user;
        await deployments.fixture(["all"]);
        fractionalOwnership = await ethers.getContract(
          "FractionalOwnership",
          deployer
        );
      });

      describe("addListing function", function () {
        it("Should increase the tokenIdCount by one", async () => {
          const tokenURI = testURI;
          const price = 500000;
          const tokenIdCount = 0;
          const tx = await fractionalOwnership.addListing(testURI, price);
          await tx.wait(1);

          const updatedTokeIdCount =
            await fractionalOwnership.getTokenCounter();

          assert(updatedTokeIdCount > tokenIdCount);
        });
        it("Should update the property data", async () => {});
      });
    });
