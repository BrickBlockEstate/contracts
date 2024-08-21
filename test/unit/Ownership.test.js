const { expect, assert } = require("chai");
const { developmentChains, testURI } = require("../../helper-hardhat.confg");
const { network, getNamedAccounts, ethers, deployments } = require("hardhat");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("ownership unit tests", () => {
      let ownership, deployer, user, userSigner, usdt, signer, routerV2;
      const chainId = network.config.chainId;
      beforeEach(async function () {
        signer = await ethers.provider.getSigner();
        deployer = (await getNamedAccounts()).deployer;
        user = (await getNamedAccounts()).user;
        userSigner = await ethers.getSigner(user);
        await deployments.fixture(["all"]);
        ownership = await ethers.getContract("Ownership", deployer);
        usdt = await ethers.getContractAt(
          "IErc20",
          "0xdac17f958d2ee523a2206206994597c13d831ec7",
          signer
        );
        routerV2 = await ethers.getContractAt(
          "UniswapV2Router02",
          "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
          signer
        );
      });

      describe("addListing function", function () {
        it("Should increase the tokenIdCount by one", async () => {
          const tokenURI = testURI;
          const price = 500000;
          const tokenIdCount = 0;
          const tx = await ownership.addListing(testURI, price);
          await tx.wait(1);

          const updatedTokeIdCount = await ownership.getTokenCounter();

          assert(updatedTokeIdCount > tokenIdCount);
        });
        it("Should update the token URI for the token ID", async () => {
          const price = 500000n;
          const tx = await ownership.addListing(testURI, price);
          await tx.wait(1);
          const tokenId = await ownership.getTokenCounter();
          const uri = await ownership.tokenURI(Number(tokenId));

          assert.equal(testURI.toLowerCase(), uri.toLowerCase());
        });
        it("Should mint the token upon listing", async () => {
          const price = 500000n;
          const tx = await ownership.addListing(testURI, price);
          await tx.wait(1);
          const tokenId = await ownership.getTokenCounter();
          const nftOwner = await ownership.ownerOf(Number(tokenId));

          assert.equal(nftOwner, deployer);
        });
        it("Should update the property data", async () => {
          const price = 100000n;
          const transaction = await ownership.addListing(testURI, price);
          await transaction.wait(1);
          const tokenId = await ownership.getTokenCounter();
          const propertyData = await ownership.getPropertyData(Number(tokenId));

          const propertyPriceFromCall = propertyData.price;
          assert.equal(price, Number(propertyPriceFromCall) / Number(1e6));
        });
      });
      describe("buyOwnership function", () => {
        let tokenId, price;
        beforeEach(async () => {
          price = 10000n;
          const transaction = await ownership.addListing(testURI, price);
          await transaction.wait(1);
          tokenId = await ownership.getTokenCounter();
        });
        it("Should revert if property doesn't exist", async () => {
          await expect(
            ownership.connect(userSigner).buyOwnership(33n)
          ).to.be.revertedWith("Property doesn't exist");
        });
        it("Should revert if the user doesn't have balance", async () => {
          await expect(
            ownership.connect(userSigner).buyOwnership(tokenId)
          ).to.be.revertedWithCustomError(
            ownership,
            "Ownership__Transfer_Failed_buyOwnership()"
          );
        });
        beforeEach(async () => {
          const amountOutMin = 10000000000n;
          const path = [
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", //weth
            "0xdac17f958d2ee523a2206206994597c13d831ec7", //usdt
          ];

          const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
          const transactionResponse = await routerV2.swapExactETHForTokens(
            amountOutMin,
            path,
            user,
            deadline,
            {
              value: ethers.parseEther("10"),
            }
          );
          await transactionResponse.wait(1);
        });
        it("Should transfer price from user to the contract", async () => {
          const contractBalanceBefore = await usdt.balanceOf(ownership.target);
          await usdt
            .connect(userSigner)
            .approve(ownership.target, price * BigInt(1e6));
          await ownership.connect(userSigner).buyOwnership(tokenId);
          const contractBalanceAfter = await usdt.balanceOf(ownership.target);

          assert(contractBalanceAfter > contractBalanceBefore);
        });
        it("Should transfer the ownership of NFT to the user", async () => {
          await usdt
            .connect(userSigner)
            .approve(ownership.target, price * BigInt(1e6));
          await ownership.connect(userSigner).buyOwnership(tokenId);

          const nftOwner = await ownership.ownerOf(tokenId);
          assert(nftOwner, user);
        });
      });
      describe("withdraw function", function () {
        beforeEach(async () => {
          const price = 10000n;
          const transaction = await ownership.addListing(testURI, price);
          await transaction.wait(1);
          const tokenId = await ownership.getTokenCounter();

          const amountOutMin = 10000000000n;
          const path = [
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", //weth
            "0xdac17f958d2ee523a2206206994597c13d831ec7", //usdt
          ];

          const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
          const transactionResponse = await routerV2.swapExactETHForTokens(
            amountOutMin,
            path,
            user,
            deadline,
            {
              value: ethers.parseEther("10"),
            }
          );
          await transactionResponse.wait(1);

          await usdt
            .connect(userSigner)
            .approve(ownership.target, price * BigInt(1e6));
          await ownership.connect(userSigner).buyOwnership(tokenId);
        });
        it("Should withdraw the contract funds to the deployer", async () => {
          const usdtDeployerBalance = await usdt.balanceOf(deployer);

          await ownership.withdraw();
          const usdtDeployerBalanceAfter = await usdt.balanceOf(deployer);
          assert(usdtDeployerBalanceAfter > usdtDeployerBalance);
        });
      });
    });
