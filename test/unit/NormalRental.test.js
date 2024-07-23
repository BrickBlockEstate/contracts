const { expect, assert } = require("chai");
const {
  developmentChains,
  testURI,
  networkConfig,
} = require("../../helper-hardhat.confg");
const { network, getNamedAccounts, ethers, deployments } = require("hardhat");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("NormalRental unit tests", () => {
      let normalRental, deployer, user, userSigner, signer, routerV2, usdt;
      const chainId = network.config.chainId;
      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;
        user = (await getNamedAccounts()).user;
        signer = await ethers.provider.getSigner();
        userSigner = await ethers.getSigner(user);
        await deployments.fixture(["all"]);
        normalRental = await ethers.getContract("NormalRental", deployer);
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
      describe("constructor", function () {
        it("Should initialize the usdt address correctly", async () => {
          const usdt = networkConfig[chainId].usdt;
          const addressFromCall = await normalRental.getUsdtAddress();
          assert.equal(usdt, addressFromCall);
        });
        it("Should initialize the current Token Id correctly", async () => {
          const curTokenId = await normalRental.getTokenId();
          assert.equal(curTokenId, 0);
        });
      });
      describe("addProperty function", function () {
        it("Should revert if the passed URI is invalid", async () => {
          const testingUri = "Brick Block add";
          const price = BigInt(100000);
          const seed = Math.floor(Math.random() * 767);
          const isOffplan = false;

          await expect(
            normalRental.addProperty(testingUri, price, seed, isOffplan)
          ).to.be.revertedWith("Please place a valid URI");
        });

        it("Should revert if appropriate values are not passed", async () => {
          const price = 0;
          const seed = 0;
          const isOffplan = true;

          await expect(
            normalRental.addProperty(testURI, price, seed, isOffplan)
          ).to.be.revertedWith("Please enter appropriate values");
        });
        it("Should update the token ID upon call", async () => {
          const currentTokenId = await normalRental.getTokenId();
          const price = BigInt(50000);
          const seed = Math.floor(Math.random() * 7652);
          const isOffplan = true;

          const tx = await normalRental.addProperty(
            testURI,
            price,
            seed,
            isOffplan
          );
          await tx.wait(1);

          const newTokenId = await normalRental.getTokenId();
          assert(newTokenId > currentTokenId);
        });
        it("Should update the relavent tokenIds depending on offplan", async () => {
          const currentTokenId = await normalRental.getTokenId();
          const price = BigInt(700000);
          const seed = Math.floor(Math.random() * 1234);
          const isOffplan = false;

          const tx = await normalRental.addProperty(
            testURI,
            price,
            seed,
            isOffplan
          );
          await tx.wait(1);
          const tokenIds = await normalRental.getNormalTokenIds();
          assert(tokenIds[0] > currentTokenId);
        });
        it("Should return the property listing added", async () => {
          const price = BigInt(50000);
          const seed = Math.floor(Math.random() * 7652);
          const isOffplan = true;

          const tx = await normalRental.addProperty(
            testURI,
            price,
            seed,
            isOffplan
          );
          await tx.wait(1);

          const newTokenId = await normalRental.getOffplanTokenIds();

          const propertyListing = await normalRental.getProperties(
            newTokenId[0]
          );

          expect(BigInt(newTokenId[0])).to.equal(BigInt(propertyListing[0]));
        });
        it("Should return the normal property listing addded", async () => {
          const price = BigInt(300000);
          const seed = Math.floor(Math.random() * 8765);
          const isOffplan = false;

          const tx = await normalRental.addProperty(
            testURI,
            price,
            seed,
            isOffplan
          );
          await tx.wait(1);

          const newTokenId = await normalRental.getNormalTokenIds();
          const propertyListing = await normalRental.getProperties(
            newTokenId[0]
          );

          assert.equal(BigInt(newTokenId[0]), BigInt(propertyListing[0]));
        });
        it("Should updated the price decimals adjusted", async () => {
          const price = BigInt(50000);
          const seed = Math.floor(Math.random() * 7652);
          const isOffplan = false;

          const tx = await normalRental.addProperty(
            testURI,
            price,
            seed,
            isOffplan
          );
          await tx.wait(1);

          const newTokenId = await normalRental.getTokenId();

          const propertyListing = await normalRental.getProperties(newTokenId);

          expect(price * BigInt(1e6)).to.equal(propertyListing[1]);
        });
        it("Should update the token Uri against the tokenId", async () => {
          const price = BigInt(50000);
          const seed = Math.floor(Math.random() * 7652);
          const isOffplan = false;

          const tx = await normalRental.addProperty(
            testURI,
            price,
            seed,
            isOffplan
          );
          await tx.wait(1);

          const newTokenId = await normalRental.getTokenId();

          const uri = await normalRental.uri(newTokenId);

          assert.equal(testURI.toLowerCase(), uri.toLowerCase());
        });
        it("Should update the token URI against offplan tokenId", async () => {
          const price = BigInt(1000000);
          const seed = Math.floor(Math.random() * 4336);
          const isOffplan = true;

          const tx = await normalRental.addProperty(
            testURI,
            price,
            seed,
            isOffplan
          );
          await tx.wait(1);
          const tokenIds = await normalRental.getOffplanTokenIds();
          const tokenId = tokenIds[0];
          const uri = await normalRental.offplanUri(tokenId);
          assert.equal(testURI.toLowerCase(), uri.toLowerCase());
        });
        it("Should emit an event when adding normal rental properties", async () => {
          const price = BigInt(1000000);
          const seed = Math.floor(Math.random() * 1123);
          const isOffplan = false;

          await expect(
            normalRental.addProperty(testURI, price, seed, isOffplan)
          ).to.emit(normalRental, "PropertyMinted");
        });
        it("Should emit an event when adding offplan properties", async () => {
          const price = BigInt(300000);
          const seed = Math.floor(Math.random() * 999);
          const isOffplan = true;

          await expect(
            normalRental.addProperty(testURI, price, seed, isOffplan)
          ).to.emit(normalRental, "OffplanPropertyMinted");
        });
      });

      describe("submitRent function", function () {
        let tokenId, amountToSubmit;
        beforeEach(async () => {
          const price = BigInt(200000);
          const seed = Math.floor(Math.random() * 7895);
          const isOffplan = false;
          await normalRental.addProperty(testURI, price, seed, isOffplan);
          tokenId = await normalRental.getTokenId();

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
          await usdt.approve(normalRental.target, amountToSubmit);
        });
        it("Should revert if the user balance isn't enough", async () => {
          const depositAmount = (await usdt.balanceOf(deployer)) + 10n;
          await expect(
            normalRental.submitRent(depositAmount, tokenId)
          ).to.be.revertedWith("Not enough Balance");
        });
        it("Should revert if the tokenId is not found", async () => {
          await expect(
            normalRental.submitRent(amountToSubmit, 323)
          ).to.be.revertedWith("Property not found");
        });
        it("Should transfer funds from the owner to the contract", async () => {
          await normalRental.submitRent(amountToSubmit, tokenId);
          const contractUsdtBalance = await usdt.balanceOf(normalRental.target);

          assert.equal(contractUsdtBalance, amountToSubmit);
        });
      });

      describe("mint function", function () {
        let tokenId, amountToSubmit, price;
        it("Should mint the shares for offplan properties", async () => {
          price = BigInt(500000);
          const seed = Math.floor(Math.random() * 11235);
          const isOffplan = true;
          await normalRental.addProperty(testURI, price, seed, isOffplan);
          const tokenIds = await normalRental.getOffplanTokenIds();
          tokenId = tokenIds[0];

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
          const contractUsdtBalanceBefore = await usdt.balanceOf(normalRental);
          const approvalAmount = (price * amountToOwn) / BigInt(100);

          await usdt.approve(normalRental.target, approvalAmount * BigInt(1e6));
          const tx = await normalRental.mint(tokenId, amountToOwn);
          await tx.wait(1);

          const contractUsdtBalanceAfter = await usdt.balanceOf(normalRental);

          expect(contractUsdtBalanceAfter).to.be.greaterThan(
            contractUsdtBalanceBefore
          );
        });
        beforeEach(async () => {
          price = BigInt(20000);
          const seed = Math.floor(Math.random() * 7895);
          const isOffplan = false;
          await normalRental.addProperty(testURI, price, seed, isOffplan);
          const tokenIds = await normalRental.getNormalTokenIds();
          tokenId = tokenIds[0];

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
          await expect(
            normalRental.mint(tokenId, amountToOwn)
          ).to.be.revertedWith("Min investment 1%");
        });
        it("Should revert if no supply left", async () => {
          const amountToOwn = 101n;
          await expect(
            normalRental.mint(tokenId, amountToOwn)
          ).to.be.revertedWith("Not enough supply left");
        });
        it("Should revert if balance is not enough", async () => {
          const amountToOwn = 12n;
          await expect(
            normalRental.connect(userSigner).mint(tokenId, amountToOwn)
          ).to.be.revertedWith("Not enough balance");
        });
        it("Should revert if minting is paused", async () => {
          const amountToOwn = 5n;
          const paused = true;
          await normalRental.pause(paused);

          await expect(
            normalRental.connect(userSigner).mint(tokenId, amountToOwn)
          ).to.be.revertedWith("Minting Paused");
        });

        it("Should transfer funds from investor to the contract", async () => {
          const amountToOwn = BigInt(10);
          const contractUsdtBalanceBefore = await usdt.balanceOf(normalRental);
          const approvalAmount = (price * amountToOwn) / BigInt(100);

          await usdt.approve(normalRental.target, approvalAmount * BigInt(1e6));
          const tx = await normalRental.mint(tokenId, amountToOwn);

          const contractUsdtBalanceAfter = await usdt.balanceOf(normalRental);

          expect(contractUsdtBalanceAfter).to.be.greaterThan(
            contractUsdtBalanceBefore
          );
        });
        it("Should update the property listings", async () => {
          const amountToOwn = BigInt(5);
          const approvalAmount = (price * amountToOwn) / BigInt(100);

          await usdt.approve(normalRental.target, approvalAmount * BigInt(1e6));
          const tx = await normalRental.mint(tokenId, amountToOwn);

          const propertyListing = await normalRental.getProperties(tokenId);

          const amountGenerated = propertyListing.amountGenerated;
          const amountMinted = propertyListing.amountMinted;

          assert.equal(amountGenerated, approvalAmount * BigInt(1e6));
          assert.equal(amountMinted, amountToOwn);
        });
        it("Should update the data structure for investors", async function () {
          const amountToOwn = BigInt(5);
          const approvalAmount = (price * amountToOwn) / BigInt(100);

          await usdt.approve(normalRental.target, approvalAmount * BigInt(1e6));
          const tx = await normalRental.mint(tokenId, amountToOwn);

          const investorListing = await normalRental.getInvestments(
            deployer,
            tokenId
          );

          assert.equal(investorListing, amountToOwn);
        });
        it("Should add the investor in the data structure if not already present", async () => {
          const amountToOwn = BigInt(5);
          const approvalAmount = (price * amountToOwn) / BigInt(100);

          await usdt.approve(normalRental.target, approvalAmount * BigInt(1e6));
          const tx = await normalRental.mint(tokenId, amountToOwn);

          const investorsList = await normalRental.getInvestors(tokenId);
          assert.equal(investorsList[0], deployer);
        });
        it("Should mint the shares to the investor", async () => {
          const amountToOwn = BigInt(5);
          const approvalAmount = (price * amountToOwn) / BigInt(100);

          await usdt.approve(normalRental.target, approvalAmount * BigInt(1e6));
          const tx = await normalRental.mint(tokenId, amountToOwn);

          const investorBalance = await normalRental.balanceOf(
            deployer,
            tokenId
          );

          assert.equal(investorBalance, amountToOwn);
        });
      });

      describe("mintOffplanInstallments function", async () => {
        let tokenId, deployerBalance, price, isOffplan;
        beforeEach(async () => {
          price = BigInt(200000);
          const seed = Math.floor(Math.random() * 7895);
          isOffplan = true;
          await normalRental.addProperty(testURI, price, seed, isOffplan);
          const tokenIds = await normalRental.getOffplanTokenIds();
          tokenId = tokenIds[0];

          //Buying USDT from Uniswap for testing
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
          deployerBalance = await usdt.balanceOf(deployer);
        });
        it("Should revert if the property is not offplan", async () => {
          const tokenIdTest = 76543172123;
          const amountToOwn = 10n;

          await usdt.approve(normalRental.target, BigInt(20000 * 1e6));
          await expect(
            normalRental.mintOffplanInstallments(
              tokenIdTest,
              amountToOwn,
              20000n
            )
          ).to.be.revertedWith("Property not found");
        });
        it("Should revert if the minting is paused", async () => {
          const amountToOwn = 10n;
          const paused = true;
          await normalRental.pause(paused);
          await usdt
            .connect(userSigner)
            .approve(normalRental.target, BigInt(20000 * 1e6));

          await expect(
            normalRental.mintOffplanInstallments(tokenId, amountToOwn, 20000n)
          ).to.be.revertedWith("Minting Paused");
        });
        it("Should revert if min amount is less than 1%", async () => {
          const amountToOwn = 0n;
          await usdt.approve(normalRental.target, BigInt(20000 * 1e6));

          await expect(
            normalRental.mintOffplanInstallments(tokenId, amountToOwn, 20000n)
          ).to.be.revertedWith("Max investment 1%");
        });
        it("Should revert if the investor already has pending instalments", async () => {
          const amountToOwn = 10n;
          await usdt.approve(normalRental.target, BigInt(10000 * 1e6));

          const tx = await normalRental.mintOffplanInstallments(
            tokenId,
            amountToOwn,
            10000n
          );
          await tx.wait(1);

          await usdt.approve(normalRental.target, BigInt(10000 * 1e6));
          await expect(
            normalRental.mintOffplanInstallments(tokenId, amountToOwn, 10000n)
          ).to.be.revertedWithCustomError(
            normalRental,
            "NormalRental__ALREADY_HAVE_INSTALLMENTS_REMAINING()"
          );
        });
        it("Should revert if amount to own is more than remaining supply", async () => {
          const amountToOwn = 110n;
          await usdt.approve(normalRental.target, BigInt(10000 * 1e6));

          await expect(
            normalRental.mintOffplanInstallments(tokenId, amountToOwn, 10000n)
          ).to.be.revertedWith("Not enough supply");
        });
        it("Should revert if the user balance is less than required", async () => {
          const amountToOwn = 10n;
          await usdt
            .connect(userSigner)
            .approve(normalRental.target, BigInt(10000 * 1e6));
          await expect(
            normalRental
              .connect(userSigner)
              .mintOffplanInstallments(tokenId, amountToOwn, 10000n)
          ).to.be.revertedWith("Not enough balance");
        });
        it("Should update the contract balance after transfer", async () => {
          const amountToOwn = 10n;
          const contractBalanceBefore = await usdt.balanceOf(
            normalRental.target
          );
          await usdt.approve(normalRental.target, BigInt(10000 * 1e6));

          const tx = await normalRental.mintOffplanInstallments(
            tokenId,
            amountToOwn,
            10000n
          );
          await tx.wait(1);

          const contractBalanceAfter = await usdt.balanceOf(
            normalRental.target
          );

          assert(contractBalanceAfter > contractBalanceBefore);
        });
        it("Should update the offplan property amount generated", async () => {
          const amountToOwn = 5n;
          await usdt.approve(normalRental.target, BigInt(2000 * 1e6));

          const tx = await normalRental.mintOffplanInstallments(
            tokenId,
            amountToOwn,
            2000n
          );
          await tx.wait(1);

          const offplanPropery = await normalRental.getProperties(tokenId);

          assert.equal(
            BigInt(offplanPropery.amountGenerated),
            BigInt(2000 * 1e6)
          );
        });
        it("Should update the amount minted for the offplan property", async () => {
          const amountToOwn = 5n;
          await usdt.approve(normalRental.target, BigInt(2000 * 1e6));
          const tx = await normalRental.mintOffplanInstallments(
            tokenId,
            amountToOwn,
            2000n
          );
          await tx.wait(1);

          const offplanPropery = await normalRental.getProperties(tokenId);

          assert.equal(offplanPropery.amountMinted, amountToOwn);
        });
        it("Should push the offplan investor's info", async () => {
          const amountToOwn = 10n;
          const firstInstallment = 2000;
          await usdt.approve(normalRental.target, firstInstallment * 1e6);

          const tx = await normalRental.mintOffplanInstallments(
            tokenId,
            amountToOwn,
            firstInstallment
          );

          await tx.wait(1);

          const investorInfoArray = await normalRental.getInstallments(tokenId);
          const investorRemainingAmountToPay =
            investorInfoArray[0].remainingInstalmentsAmount;
          const offplanProperty = await normalRental.getProperties(tokenId);
          const offplanPropertyPrice = offplanProperty.price;
          const investorSharePrice =
            (BigInt(offplanPropertyPrice) * BigInt(amountToOwn)) / BigInt(100);
          assert.equal(
            BigInt(investorSharePrice) - BigInt(investorRemainingAmountToPay),
            BigInt(firstInstallment * 1e6)
          );
        });
        it("Should push the investor Info in the array of mapping s_tokenIdToInvestors", async () => {
          const amountToOwn = 5n;
          await usdt.approve(normalRental.target, BigInt(2000 * 1e6));

          const tx = await normalRental.mintOffplanInstallments(
            tokenId,
            amountToOwn,
            2000
          );
          await tx.wait(1);

          const investorsInfo = await normalRental.getInvestors(tokenId);
          const investor = investorsInfo[0];
          assert.equal(investor.toString(), deployer.toString());
        });
        it("Should mint the shares to the investor", async () => {
          const amountToOwn = 10n;
          await usdt.approve(normalRental.target, BigInt(10000 * 1e6));

          const tx = await normalRental.mintOffplanInstallments(
            tokenId,
            amountToOwn,
            10000
          );
          await tx.wait(1);

          const investorShares = await normalRental.balanceOf(
            deployer,
            tokenId
          );
          assert.equal(investorShares, amountToOwn);
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
          await expect(normalRental.distributeRent(2323n)).to.be.revertedWith(
            "Rent not generated"
          );
        });

        let tokenId;
        beforeEach(async () => {
          // Owner adds a property
          const price = BigInt(34000);
          const seed = Math.floor(Math.random() * 9864);
          const isOffplan = false;

          await normalRental.addProperty(testURI, price, seed, isOffplan);
          const newTokenId = await normalRental.getTokenId();
          tokenId = newTokenId;

          const propertyListing = await normalRental.getProperties(newTokenId);

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
            .approve(normalRental.target, approvalAmount * BigInt(1e6));
          const tx = await normalRental
            .connect(userSigner)
            .mint(newTokenId, amountToOwn);
          await tx.wait(1);
          const investorListing = await normalRental.getInvestments(
            user,
            newTokenId
          );

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
          await usdt.approve(normalRental.target, amountToSubmit);
          await normalRental.submitRent(amountToSubmit, newTokenId);
        });
        it("Should distribute rent to the investors", async () => {
          const userBal = await usdt.connect(userSigner).balanceOf(user);
          const tx = await normalRental.distributeRent(tokenId);
          await tx.wait(1);

          const userBalAfter = await usdt.connect(userSigner).balanceOf(user);

          assert(userBalAfter > userBal);
        });
      });
      describe("payInstallments function", function () {
        let tokenId, userBalance, installments;
        /**
         * We first need an admin to add an offplan property
         * We then need a user to buy usdt from uniswap
         * THe user will then mint the property's shares
         * The user will then pay installments
         */
        beforeEach(async () => {
          // Admin adds a property
          const price = BigInt(500000);
          const seed = Math.floor(Math.random() * 5561234);
          const isOffplan = true;

          const tx = await normalRental.addProperty(
            testURI,
            price,
            seed,
            isOffplan
          );
          await tx.wait(1);

          const tokenIds = await normalRental.getOffplanTokenIds();
          tokenId = tokenIds[0];

          // Investor/user buys some usdt
          const amountOutMin = 145000000000n;
          const path = [
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", //weth
            "0xdac17f958d2ee523a2206206994597c13d831ec7", //usdt
          ];

          const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
          const transactionResponse = await routerV2
            .connect(userSigner)
            .swapExactETHForTokens(amountOutMin, path, user, deadline, {
              value: ethers.parseEther("43"),
            });
          await transactionResponse.wait(1);
          userBalance = await usdt.balanceOf(user);

          // The investor/user mints an offplan property with installments
          const amountToOwn = 20n;
          const firstInstallment = BigInt(30000);
          await usdt
            .connect(userSigner)
            .approve(normalRental.target, firstInstallment * BigInt(1e6));
          const tx2 = await normalRental
            .connect(userSigner)
            .mintOffplanInstallments(tokenId, amountToOwn, firstInstallment);
          await tx2.wait(1);

          installments = await normalRental.getInstallments(tokenId);
        });
        it("Should revert if not in installments", async () => {
          await expect(
            normalRental.payInstallments(tokenId)
          ).to.be.revertedWithCustomError(
            normalRental,
            "NormalRental__NOT_IN_INSTALLMENTS()"
          );
        });
        it("Should transfer the monthly rent to the contract", async () => {
          const monthlyPayment =
            BigInt(installments[0].remainingInstalmentsAmount) / BigInt(6);
          const contractBalanceBefore = await usdt.balanceOf(
            normalRental.target
          );
          const investorBalanceBefore = await usdt.balanceOf(user);

          await usdt
            .connect(userSigner)
            .approve(normalRental.target, monthlyPayment);
          const tx = await normalRental
            .connect(userSigner)
            .payInstallments(tokenId);
          await tx.wait(1);

          const investorBalanceAfter = await usdt.balanceOf(user);
          const contractBalanceAfter = await usdt.balanceOf(
            normalRental.target
          );
          assert(
            BigInt(investorBalanceBefore) - BigInt(monthlyPayment),
            BigInt(investorBalanceAfter)
          );
          assert(
            BigInt(contractBalanceBefore) + BigInt(monthlyPayment),
            BigInt(contractBalanceAfter)
          );
        });
        it("Should update the contract information for installments", async () => {
          const monthlyPayment =
            BigInt(installments[0].remainingInstalmentsAmount) / BigInt(6);
          const installmentAmountBefore =
            installments[0].remainingInstalmentsAmount;

          await usdt
            .connect(userSigner)
            .approve(normalRental.target, monthlyPayment);
          const tx = await normalRental
            .connect(userSigner)
            .payInstallments(tokenId);
          await tx.wait(1);

          const remainingInstallmentsAfter = await normalRental.getInstallments(
            tokenId
          );
          const installmentAmountAfter =
            remainingInstallmentsAfter[0].remainingInstalmentsAmount;

          assert(
            BigInt(installmentAmountBefore) - BigInt(monthlyPayment),
            BigInt(installmentAmountAfter)
          );
        });
      });
      //////////////////////////////////////////////
      //        View and Pure func Testing        //
      //////////////////////////////////////////////

      /**
       * Make the _isValidUri() function public and uncomment the following lines to run the test
       */
      // describe( "_isValidUri function", function ()
      // {
      //     it( "Should return true for a valid Uri", async () =>
      //     {
      //         const isValid = true;
      //         //Make this function public in contract
      //         const returnedValue = await normalRental._isValidUri( testURI );
      //         assert.equal( isValid, returnedValue );
      //     } );
      // } );
    });
