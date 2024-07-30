const { expect, assert } = require("chai");
const {
  developmentChains,
  testURI,
  networkConfig,
} = require("../../helper-hardhat.confg");
const { network, getNamedAccounts, ethers, deployments } = require("hardhat");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("rental unit tests", () => {
      let rental,
        deployer,
        user,
        user2,
        userSigner,
        user2Signer,
        signer,
        routerV2,
        usdt,
        deployerSigner;
      const chainId = network.config.chainId;
      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;
        user = (await getNamedAccounts()).user;
        user2 = (await getNamedAccounts()).user2;
        signer = await ethers.provider.getSigner();
        userSigner = await ethers.getSigner(user);
        deployerSigner = await ethers.getSigner(deployer);
        user2Signer = await ethers.getSigner(user2);
        await deployments.fixture(["all"]);
        rental = await ethers.getContract("Rental", deployer);
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
      describe("addProperty function", function () {
        it("Should revert if the passed URI is invalid", async () => {
          const testingUri = "Brick Block add";
          const price = BigInt(100000);
          const seed = Math.floor(Math.random() * 767);

          await expect(
            rental.addProperty(testingUri, price, seed)
          ).to.be.revertedWith("Please place a valid URI");
        });

        it("Should revert if appropriate values are not passed", async () => {
          const price = 0;
          const seed = 0;
          await expect(
            rental.addProperty(testURI, price, seed)
          ).to.be.revertedWith("Please enter appropriate values");
        });
        it("Should update the token ID upon call", async () => {
          const currentTokenId = await rental.getTokenId();
          const price = BigInt(50000);
          const seed = Math.floor(Math.random() * 7652);

          const tx = await rental.addProperty(testURI, price, seed);
          await tx.wait(1);

          const newTokenId = await rental.getTokenId();
          assert(newTokenId > currentTokenId);
        });
        it("Should return the property listing added", async () => {
          const price = BigInt(50000);
          const seed = Math.floor(Math.random() * 7652);

          const tx = await rental.addProperty(testURI, price, seed);
          await tx.wait(1);

          const newTokenId = await rental.getTokenId();

          const propertyListing = await rental.getProperties(newTokenId);

          expect(BigInt(newTokenId)).to.equal(BigInt(propertyListing[0]));
        });
        it("Should updated the price decimals adjusted", async () => {
          const price = BigInt(50000);
          const seed = Math.floor(Math.random() * 7652);

          const tx = await rental.addProperty(testURI, price, seed);
          await tx.wait(1);

          const newTokenId = await rental.getTokenId();

          const propertyListing = await rental.getProperties(newTokenId);

          expect(price * BigInt(1e6)).to.equal(propertyListing[1]);
        });
        it("Should update the token Uri against the tokenId", async () => {
          const price = BigInt(50000);
          const seed = Math.floor(Math.random() * 7652);

          const tx = await rental.addProperty(testURI, price, seed);
          await tx.wait(1);

          const newTokenId = await rental.getTokenId();

          const uri = await rental.uri(newTokenId);

          assert.equal(testURI.toLowerCase(), uri.toLowerCase());
        });
      });
      describe("mint function", function () {
        let tokenId, amountToSubmit, price;
        it("Should mint the shares for properties", async () => {
          price = BigInt(500000);
          const seed = Math.floor(Math.random() * 11235);
          await rental.addProperty(testURI, price, seed);
          tokenId = await rental.getTokenId();

          // Buying usdt
          const amountOutMin = 50000000000n;
          const path = [
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", //weth
            "0xdac17f958d2ee523a2206206994597c13d831ec7", //usdt
          ];

          const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
          const transactionResponse = await routerV2.swapExactETHForTokens(
            amountOutMin,
            path,
            deployer,
            deadline,
            {
              value: ethers.parseEther("15"),
            }
          );
          await transactionResponse.wait(1);
          amountToSubmit = await usdt.balanceOf(deployer);

          const amountToOwn = BigInt(10);
          const contractUsdtBalanceBefore = await usdt.balanceOf(rental);
          const approvalAmount = (price * amountToOwn) / BigInt(100);

          await usdt.approve(rental.target, approvalAmount * BigInt(1e6));
          const tx = await rental.mint(tokenId, amountToOwn);
          await tx.wait(1);

          const contractUsdtBalanceAfter = await usdt.balanceOf(rental);

          expect(contractUsdtBalanceAfter).to.be.greaterThan(
            contractUsdtBalanceBefore
          );
        });
        beforeEach(async () => {
          price = BigInt(20000);
          const seed = Math.floor(Math.random() * 7895);
          await rental.addProperty(testURI, price, seed);
          tokenId = await rental.getTokenId();

          //Buying USDT from Uniswap
          const amountOutMin = 30000000000n;
          const path = [
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", //weth
            "0xdac17f958d2ee523a2206206994597c13d831ec7", //usdt
          ];

          const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
          const transactionResponse = await routerV2.swapExactETHForTokens(
            amountOutMin,
            path,
            deployer,
            deadline,
            {
              value: ethers.parseEther("10"),
            }
          );
          await transactionResponse.wait(1);
          amountToSubmit = await usdt.balanceOf(deployer);
        });
        it("Should revert if the min amount is less than 1", async () => {
          const amountToOwn = 0n;
          await expect(rental.mint(tokenId, amountToOwn)).to.be.revertedWith(
            "Min investment 1%"
          );
        });
        it("Should revert if no supply left", async () => {
          const amountToOwn = 101n;
          await expect(rental.mint(tokenId, amountToOwn)).to.be.revertedWith(
            "Not enough supply left"
          );
        });
        it("Should revert if balance is not enough", async () => {
          const amountToOwn = 12n;
          await expect(
            rental.connect(userSigner).mint(tokenId, amountToOwn)
          ).to.be.revertedWith("Not enough balance");
        });
        it("Should revert if minting is paused", async () => {
          const amountToOwn = 5n;
          const paused = true;
          await rental.pause(paused);

          await expect(
            rental.connect(userSigner).mint(tokenId, amountToOwn)
          ).to.be.revertedWith("Minting Paused");
        });

        it("Should transfer funds from investor to the contract", async () => {
          const amountToOwn = BigInt(10);
          const contractUsdtBalanceBefore = await usdt.balanceOf(rental);
          const approvalAmount = (price * amountToOwn) / BigInt(100);

          await usdt.approve(rental.target, approvalAmount * BigInt(1e6));
          const tx = await rental.mint(tokenId, amountToOwn);

          const contractUsdtBalanceAfter = await usdt.balanceOf(rental);

          expect(contractUsdtBalanceAfter).to.be.greaterThan(
            contractUsdtBalanceBefore
          );
        });
        it("Should update the property listings", async () => {
          const amountToOwn = BigInt(5);
          const approvalAmount = (price * amountToOwn) / BigInt(100);

          await usdt.approve(rental.target, approvalAmount * BigInt(1e6));
          const tx = await rental.mint(tokenId, amountToOwn);

          const propertyListing = await rental.getProperties(tokenId);

          const amountGenerated = propertyListing.amountGenerated;
          const amountMinted = propertyListing.amountMinted;

          assert.equal(amountGenerated, approvalAmount * BigInt(1e6));
          assert.equal(amountMinted, amountToOwn);
        });
        it("Should update the data structure for investors", async function () {
          const amountToOwn = BigInt(5);
          const approvalAmount = (price * amountToOwn) / BigInt(100);

          await usdt.approve(rental.target, approvalAmount * BigInt(1e6));
          const tx = await rental.mint(tokenId, amountToOwn);
          await tx.wait(1);

          const investorListing = await rental.getInvestments(
            deployer,
            tokenId
          );

          assert.equal(investorListing, amountToOwn);
        });
        it("Should add the investor in the data structure if not already present", async () => {
          const amountToOwn = BigInt(5);
          const approvalAmount = (price * amountToOwn) / BigInt(100);

          await usdt.approve(rental.target, approvalAmount * BigInt(1e6));
          const tx = await rental.mint(tokenId, amountToOwn);

          const investorsList = await rental.getInvestors(tokenId);
          assert.equal(investorsList[0], deployer);
        });
        it("Should mint the shares to the investor", async () => {
          const amountToOwn = BigInt(5);
          const approvalAmount = (price * amountToOwn) / BigInt(100);

          await usdt.approve(rental.target, approvalAmount * BigInt(1e6));
          const tx = await rental.mint(tokenId, amountToOwn);

          const investorBalance = await rental.balanceOf(deployer, tokenId);

          assert.equal(investorBalance, amountToOwn);
        });
      });
      describe("submitRent function", function () {
        let tokenId, amountToSubmit;
        beforeEach(async () => {
          const price = BigInt(200000);
          const seed = Math.floor(Math.random() * 7895);
          await rental.addProperty(testURI, price, seed);
          tokenId = await rental.getTokenId();

          //Buying USDT from Uniswap
          const amountOutMin = 100000000n;
          const path = [
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", //weth
            "0xdac17f958d2ee523a2206206994597c13d831ec7", //usdt
          ];

          const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
          const transactionResponse = await routerV2.swapExactETHForTokens(
            amountOutMin,
            path,
            deployer,
            deadline,
            {
              value: ethers.parseEther("1"),
            }
          );
          await transactionResponse.wait(1);
          amountToSubmit = await usdt.balanceOf(deployer);
          await usdt.approve(rental.target, amountToSubmit);
        });
        it("Should revert if the user balance isn't enough", async () => {
          const depositAmount = (await usdt.balanceOf(deployer)) + 10n;
          await expect(
            rental.submitRent(depositAmount, tokenId)
          ).to.be.revertedWith("Not enough Balance");
        });
        it("Should revert if the tokenId is not found", async () => {
          await expect(
            rental.submitRent(amountToSubmit, 323)
          ).to.be.revertedWith("Property not found");
        });
        it("Should transfer funds from the owner to the contract", async () => {
          await rental.submitRent(amountToSubmit, tokenId);
          const contractUsdtBalance = await usdt.balanceOf(rental.target);

          assert.equal(contractUsdtBalance, amountToSubmit);
        });
      });
      describe("distributeRent function", () => {
        /**
         * 1. We need an owner to add a property
         * 2. We need an investor (user) to buy some usdt from uniswap
         * 3. We need that investor to buy shares in the listed property
         * 4. We need the owner to collect rent (buy some usdt from uniswap)
         * 5. We need the owner to SUBMIT that rent
         */
        it("Should revert if there is no rent generated", async () => {
          await expect(rental.distributeRent(2323n)).to.be.revertedWith(
            "Rent not generated"
          );
        });

        let tokenId;
        beforeEach(async () => {
          // Owner adds a property
          const price = BigInt(34000);
          const seed = Math.floor(Math.random() * 9864);
          await rental.addProperty(testURI, price, seed);
          const newTokenId = await rental.getTokenId();
          tokenId = newTokenId;

          const propertyListing = await rental.getProperties(newTokenId);

          // Investor buys some usdt
          const amountOutMin = 30000000000n;
          const path = [
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", //weth
            "0xdac17f958d2ee523a2206206994597c13d831ec7", //usdt
          ];

          const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
          const transactionResponse = await routerV2
            .connect(userSigner)
            .swapExactETHForTokens(amountOutMin, path, user, deadline, {
              value: ethers.parseEther("50"),
            });
          await transactionResponse.wait(1);
          amountToSubmit = await usdt.balanceOf(user);

          // Investor buys shares in the property
          const amountToOwn = BigInt(5);
          const approvalAmount = (price * amountToOwn) / BigInt(100);

          await usdt
            .connect(userSigner)
            .approve(rental.target, approvalAmount * BigInt(1e6));
          const tx = await rental
            .connect(userSigner)
            .mint(newTokenId, amountToOwn);
          await tx.wait(1);
          const investorListing = await rental.getInvestments(user, newTokenId);

          // Mimicing rent collection
          const amountOutMinOwner = 58000000000n;
          const pathOwner = [
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", //weth
            "0xdac17f958d2ee523a2206206994597c13d831ec7", //usdt
          ];

          const deadlineOwner = Math.floor(Date.now() / 1000) + 60 * 10;
          const transactionResponseOwner = await routerV2.swapExactETHForTokens(
            amountOutMinOwner,
            pathOwner,
            deployer,
            deadlineOwner,
            {
              value: ethers.parseEther("20"),
            }
          );
          await transactionResponseOwner.wait(1);
          amountToSubmit = await usdt.balanceOf(deployer);

          //Rent submission
          await usdt.approve(rental.target, amountToSubmit);
          await rental.submitRent(amountToSubmit, newTokenId);
        });
        it("Should distribute rent to the investors", async () => {
          const userBal = await usdt.connect(userSigner).balanceOf(user);
          const tx = await rental.distributeRent(tokenId);
          await tx.wait(1);

          const userBalAfter = await usdt.connect(userSigner).balanceOf(user);

          assert(userBalAfter > userBal);
        });
      });
    });
