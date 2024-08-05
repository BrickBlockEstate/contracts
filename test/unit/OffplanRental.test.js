const { expect, assert } = require("chai");
const {
  developmentChains,
  testURI,
  networkConfig,
  upkeepInterval,
} = require("../../helper-hardhat.confg");
const { network, getNamedAccounts, ethers, deployments } = require("hardhat");
const { AbiCoder } = require("ethers");

/////////////////////////////////////////////////////////////
//                  Before running tests                   //
//      uncomment view functions in the OffplanRental      //
//                        contract                         //
/////////////////////////////////////////////////////////////

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("OffplanRental unit tests", function () {
      let offplanRental,
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
        offplanRental = await ethers.getContract("OffplanRental", deployer);
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
      describe("constructor offplanRental", function () {
        it("Should initialize the usdt address correctly", async () => {
          const usdt = networkConfig[chainId].usdt;
          const addressFromCall = await offplanRental.getUsdt();
          assert.equal(usdt, addressFromCall);
        });
        it("Should initialize the current Token Id correctly", async () => {
          const curTokenId = await offplanRental.getTokenId();
          assert.equal(curTokenId, 0);
        });
      });
      describe("addOffplanProperty function", async () => {
        it("Should revert if the passed URI is invalid", async () => {
          const testingUri = "Brick Block add";
          const price = BigInt(100000);
          const seed = Math.floor(Math.random() * 767);

          await expect(
            offplanRental.addOffplanProperty(testingUri, price, seed)
          ).to.be.revertedWith("Please place a valid URI");
        });

        it("Should revert if appropriate values are not passed", async () => {
          const price = 0;
          const seed = 0;

          await expect(
            offplanRental.addOffplanProperty(testURI, price, seed)
          ).to.be.revertedWith("Please enter appropriate values");
        });
        it("Should update the token ID upon call", async () => {
          const currentTokenId = await offplanRental.getTokenId();
          const price = BigInt(50000);
          const seed = Math.floor(Math.random() * 7652);

          const tx = await offplanRental.addOffplanProperty(
            testURI,
            price,
            seed
          );
          await tx.wait(1);

          const newTokenId = await offplanRental.getTokenId();
          assert(newTokenId > currentTokenId);
        });
        it("Should return the property listing added", async () => {
          const price = BigInt(50000);
          const seed = Math.floor(Math.random() * 7652);

          const tx = await offplanRental.addOffplanProperty(
            testURI,
            price,
            seed
          );
          await tx.wait(1);

          const newTokenId = await offplanRental.getTokenId();

          const propertyListing = await offplanRental.getProperties(newTokenId);

          expect(BigInt(newTokenId)).to.equal(BigInt(propertyListing[0]));
        });
        it("Should updated the price decimals adjusted", async () => {
          const price = BigInt(50000);
          const seed = Math.floor(Math.random() * 7652);

          const tx = await offplanRental.addOffplanProperty(
            testURI,
            price,
            seed
          );
          await tx.wait(1);

          const newTokenId = await offplanRental.getTokenId();

          const propertyListing = await offplanRental.getProperties(newTokenId);

          expect(price * BigInt(1e6)).to.equal(propertyListing[1]);
        });
        it("Should update the token Uri against the tokenId", async () => {
          const price = BigInt(50000);
          const seed = Math.floor(Math.random() * 7652);

          const tx = await offplanRental.addOffplanProperty(
            testURI,
            price,
            seed
          );
          await tx.wait(1);

          const newTokenId = await offplanRental.getTokenId();

          const uri = await offplanRental.uri(newTokenId);

          assert.equal(testURI.toLowerCase(), uri.toLowerCase());
        });
        it("Should emit an event when adding offplan properties", async () => {
          const price = BigInt(300000);
          const seed = Math.floor(Math.random() * 999);

          await expect(
            offplanRental.addOffplanProperty(testURI, price, seed)
          ).to.emit(offplanRental, "OffplanPropertyMinted");
        });
      });
      describe("mintOffplanProperty function", async () => {
        let tokenId, amountToSubmit, price;
        beforeEach(async () => {
          price = BigInt(20000);
          const seed = Math.floor(Math.random() * 7895);
          await offplanRental.addOffplanProperty(testURI, price, seed);
          const tokenIds = await offplanRental.getTokenIds();
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
            offplanRental.mintOffplanProperty(tokenId, amountToOwn)
          ).to.be.revertedWith("Min investment 1%");
        });
        it("Should revert if no supply left", async () => {
          const amountToOwn = 101n;
          await expect(
            offplanRental.mintOffplanProperty(tokenId, amountToOwn)
          ).to.be.revertedWith("Not enough supply left");
        });
        it("Should revert if balance is not enough", async () => {
          const amountToOwn = 12n;
          await expect(
            offplanRental
              .connect(userSigner)
              .mintOffplanProperty(tokenId, amountToOwn)
          ).to.be.revertedWith("Not enough balance");
        });
        it("Should revert if minting is paused", async () => {
          const amountToOwn = 5n;
          const paused = true;
          await offplanRental.pause(paused);

          await expect(
            offplanRental
              .connect(userSigner)
              .mintOffplanProperty(tokenId, amountToOwn)
          ).to.be.revertedWith("Minting Paused");
        });
        it("Should transfer funds from investor to the contract", async () => {
          const amountToOwn = BigInt(10);
          const contractUsdtBalanceBefore = await usdt.balanceOf(offplanRental);
          const approvalAmount = (price * amountToOwn) / BigInt(100);

          await usdt.approve(
            offplanRental.target,
            approvalAmount * BigInt(1e6)
          );
          const tx = await offplanRental.mintOffplanProperty(
            tokenId,
            amountToOwn
          );

          const contractUsdtBalanceAfter = await usdt.balanceOf(offplanRental);

          expect(contractUsdtBalanceAfter).to.be.greaterThan(
            contractUsdtBalanceBefore
          );
        });
        it("Should update the property listings", async () => {
          const amountToOwn = BigInt(5);
          const approvalAmount = (price * amountToOwn) / BigInt(100);

          await usdt.approve(
            offplanRental.target,
            approvalAmount * BigInt(1e6)
          );
          const tx = await offplanRental.mintOffplanProperty(
            tokenId,
            amountToOwn
          );
          await tx.wait(1);
          const propertyListing = await offplanRental.getProperties(tokenId);

          const amountGenerated = propertyListing.amountGenerated;
          const amountMinted = propertyListing.amountMinted;

          assert.equal(amountGenerated, approvalAmount * BigInt(1e6));
          assert.equal(amountMinted, amountToOwn);
        });
        it("Should update the data structure for investors", async function () {
          const amountToOwn = BigInt(5);
          const approvalAmount = (price * amountToOwn) / BigInt(100);

          await usdt.approve(
            offplanRental.target,
            approvalAmount * BigInt(1e6)
          );
          const tx = await offplanRental.mintOffplanProperty(
            tokenId,
            amountToOwn
          );

          const investorListing = await offplanRental.getProperties(tokenId);
          const investorShares = investorListing[3];

          assert.equal(investorShares, amountToOwn);
        });
        it("Should mint the shares to the investor", async () => {
          const amountToOwn = BigInt(5);
          const approvalAmount = (price * amountToOwn) / BigInt(100);

          await usdt.approve(
            offplanRental.target,
            approvalAmount * BigInt(1e6)
          );
          const tx = await offplanRental.mintOffplanProperty(
            tokenId,
            amountToOwn
          );

          const investorBalance = await offplanRental.balanceOf(
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
          await offplanRental.addOffplanProperty(testURI, price, seed);
          const tokenIds = await offplanRental.getTokenIds();
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

          await usdt.approve(offplanRental.target, BigInt(20000 * 1e6));
          await expect(
            offplanRental.mintOffplanInstallments(
              tokenIdTest,
              amountToOwn,
              20000n
            )
          ).to.be.revertedWith("Property not found");
        });
        it("Should revert if the minting is paused", async () => {
          const amountToOwn = 10n;
          const paused = true;
          await offplanRental.pause(paused);
          await usdt
            .connect(userSigner)
            .approve(offplanRental.target, BigInt(20000 * 1e6));

          await expect(
            offplanRental.mintOffplanInstallments(tokenId, amountToOwn, 20000n)
          ).to.be.revertedWith("Minting Paused");
        });
        it("Should revert if min amount is less than 1%", async () => {
          const amountToOwn = 0n;
          await usdt.approve(offplanRental.target, BigInt(20000 * 1e6));

          await expect(
            offplanRental.mintOffplanInstallments(tokenId, amountToOwn, 20000n)
          ).to.be.revertedWith("Max investment 1%");
        });
        it("Should revert if the investor already has pending instalments", async () => {
          const amountToOwn = 10n;
          await usdt.approve(offplanRental.target, BigInt(10000 * 1e6));

          const tx = await offplanRental.mintOffplanInstallments(
            tokenId,
            amountToOwn,
            10000n
          );
          await tx.wait(1);

          await usdt.approve(offplanRental.target, BigInt(10000 * 1e6));
          await expect(
            offplanRental.mintOffplanInstallments(tokenId, amountToOwn, 10000n)
          ).to.be.revertedWithCustomError(
            offplanRental,
            "OffplanRental__ALREADY_HAVE_INSTALLMENTS_REMAINING()"
          );
        });
        it("Should revert if amount to own is more than remaining supply", async () => {
          const amntToOwn = 110n;
          await usdt.approve(offplanRental.target, BigInt(10000 * 1e6));

          await expect(
            offplanRental.mintOffplanInstallments(tokenId, amntToOwn, 10000n)
          ).to.be.revertedWith("Not enough supply");
        });
        it("Should revert if the user balance is less than required", async () => {
          const amountToOwn = 10n;
          await usdt
            .connect(userSigner)
            .approve(offplanRental.target, BigInt(10000 * 1e6));
          await expect(
            offplanRental
              .connect(userSigner)
              .mintOffplanInstallments(tokenId, amountToOwn, 10000n)
          ).to.be.revertedWith("Not enough Balance");
        });
        it("Should update the contract balance after transfer", async () => {
          const amountToOwn = 10n;
          const contractBalanceBefore = await usdt.balanceOf(
            offplanRental.target
          );
          await usdt.approve(offplanRental.target, BigInt(10000 * 1e6));

          const tx = await offplanRental.mintOffplanInstallments(
            tokenId,
            amountToOwn,
            10000n
          );
          await tx.wait(1);

          const contractBalanceAfter = await usdt.balanceOf(
            offplanRental.target
          );

          assert(contractBalanceAfter > contractBalanceBefore);
        });
        it("Should update the offplan property amount generated", async () => {
          const amountToOwn = 5n;
          await usdt.approve(offplanRental.target, BigInt(2000 * 1e6));

          const tx = await offplanRental.mintOffplanInstallments(
            tokenId,
            amountToOwn,
            2000n
          );
          await tx.wait(1);

          const offplanPropery = await offplanRental.getProperties(tokenId);

          assert.equal(
            BigInt(offplanPropery.amountGenerated),
            BigInt(2000 * 1e6)
          );
        });
        it("Should update the amount minted for the offplan property", async () => {
          const amountToOwn = 5n;
          await usdt.approve(offplanRental.target, BigInt(2000 * 1e6));
          const tx = await offplanRental.mintOffplanInstallments(
            tokenId,
            amountToOwn,
            2000n
          );
          await tx.wait(1);

          const offplanPropery = await offplanRental.getProperties(tokenId);

          assert.equal(offplanPropery.amountInInstallments, amountToOwn);
        });
        it("Should push the offplan investor's info", async () => {
          const amountToOwn = 10n;
          const firstInstallment = 2000;
          await usdt.approve(offplanRental.target, firstInstallment * 1e6);

          const tx = await offplanRental.mintOffplanInstallments(
            tokenId,
            amountToOwn,
            firstInstallment
          );

          await tx.wait(1);

          const investorInfoArray = await offplanRental.getInvestments();
          const investorRemainingAmountToPay =
            investorInfoArray[0].remainingInstalmentsAmount;
          const offplanProperty = await offplanRental.getProperties(tokenId);
          const offplanPropertyPrice = offplanProperty.price;
          const investorSharePrice =
            (BigInt(offplanPropertyPrice) * BigInt(amountToOwn)) / BigInt(100);
          assert.equal(
            BigInt(investorSharePrice) - BigInt(investorRemainingAmountToPay),
            BigInt(firstInstallment * 1e6)
          );
        });
        it("Should mint the offplan installment shares to the investor", async () => {
          const amountToOwn = 10n;
          await usdt.approve(offplanRental.target, BigInt(10000 * 1e6));

          const tx = await offplanRental.mintOffplanInstallments(
            tokenId,
            amountToOwn,
            10000
          );
          await tx.wait(1);

          const investorShares = await offplanRental.balanceOf(
            deployer,
            tokenId
          );
          assert.equal(investorShares, amountToOwn);
        });
      });
      describe("checkUpkeep function", async () => {
        let tokenId, userBalance, investments;
        /**
         * 1. Add offplan property
         * 2. Buy usdt for user
         * 3. Buy an offplan investment
         */
        beforeEach(async () => {
          // Admin adds a property
          const price = BigInt(500000);
          const seed = Math.floor(Math.random() * 5561234);

          const tx = await offplanRental.addOffplanProperty(
            testURI,
            price,
            seed
          );
          await tx.wait(1);

          const tokenIds = await offplanRental.getTokenIds();
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
            .approve(offplanRental.target, firstInstallment * BigInt(1e6));
          const tx2 = await offplanRental
            .connect(userSigner)
            .mintOffplanInstallments(tokenId, amountToOwn, firstInstallment);
          await tx2.wait(1);

          const investmentsFromCall = await offplanRental.getInvestments();
          investments = investmentsFromCall[0].remainingInstalmentsAmount;
        });
        it("Should return false if the time hasn't passed", async () => {
          const { upkeepNeeded } = await offplanRental.checkUpkeep.staticCall(
            "0x"
          );
          assert(!upkeepNeeded);
        });
        it("Should return true and the address if payment is due", async () => {
          await network.provider.send("evm_increaseTime", [
            parseInt(upkeepInterval) + 10,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeepNeeded, performData } =
            await offplanRental.checkUpkeep.staticCall("0x");
          const abiCoder = AbiCoder.defaultAbiCoder();
          const decodedVal = abiCoder.decode(
            [
              "tuple(address investor, uint256 remainingInstalmentsAmount, uint256 lastTimestamp, uint256 tokenId, uint256 missedPayementCount)[]",
            ],
            performData
          );
          assert(upkeepNeeded);
          assert.equal(decodedVal[0][0][0], user);
          // expect(decodedVal[0][0][0][1]).to.equal(user);
        });
        it("Should return the addresses of all who are default on payments", async () => {
          const amountOutMin = 145000000000n;
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
              value: ethers.parseEther("43"),
            }
          );
          await transactionResponse.wait(1);

          const amountToOwn = 20n;
          const firstInstallment = BigInt(30000);
          await usdt
            .connect(deployerSigner)
            .approve(offplanRental.target, firstInstallment * BigInt(1e6));
          const tx2 = await offplanRental
            .connect(deployerSigner)
            .mintOffplanInstallments(tokenId, amountToOwn, firstInstallment);
          await tx2.wait(1);

          //Add the same thing for user2
          const txRes = await routerV2
            .connect(user2Signer)
            .swapExactETHForTokens(amountOutMin, path, user2, deadline, {
              value: ethers.parseEther("43"),
            });
          await txRes.wait(1);

          await network.provider.send("evm_increaseTime", [
            parseInt(upkeepInterval) + 10,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });

          await usdt
            .connect(user2Signer)
            .approve(offplanRental.target, firstInstallment * BigInt(1e6));
          const txn = await offplanRental
            .connect(user2Signer)
            .mintOffplanInstallments(tokenId, amountToOwn, firstInstallment);
          await txn.wait(1);

          await network.provider.send("evm_increaseTime", [
            parseInt(upkeepInterval) - 10,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeepNeeded, performData } =
            await offplanRental.checkUpkeep.staticCall("0x");
          const abiCoder = AbiCoder.defaultAbiCoder();
          const decodedVal = abiCoder.decode(
            [
              "tuple(address investor, uint256 remainingInstalmentsAmount, uint256 lastTimestamp, uint256 tokenId, uint256 missedPayementCount)[]",
            ],
            performData
          );
          assert(upkeepNeeded);
          expect(decodedVal[0][0][0]).to.equal(user);
          expect(decodedVal[0][1][0]).to.equal(deployer);
        });
      });
      describe("performUpkeep function", async () => {
        let tokenId, userBalance, investments;
        /**
         * 1. Add offplan property
         * 2. Buy usdt for user
         * 3. Buy an offplan investment
         */
        beforeEach(async () => {
          // Admin adds a property
          const price = BigInt(500000);
          const seed = Math.floor(Math.random() * 5561234);

          const tx = await offplanRental.addOffplanProperty(
            testURI,
            price,
            seed
          );
          await tx.wait(1);

          const tokenIds = await offplanRental.getTokenIds();
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
            .approve(offplanRental.target, firstInstallment * BigInt(1e6));
          const tx2 = await offplanRental
            .connect(userSigner)
            .mintOffplanInstallments(tokenId, amountToOwn, firstInstallment);
          await tx2.wait(1);

          const investmentsFromCall = await offplanRental.getInvestments();
          investments = investmentsFromCall[0].remainingInstalmentsAmount;
        });
        it("Should increment defaulted investors remaining payments and count", async () => {
          const amountOutMin = 145000000000n;
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
              value: ethers.parseEther("43"),
            }
          );
          await transactionResponse.wait(1);

          const amountToOwn = 20n;
          const firstInstallment = BigInt(30000);
          await usdt
            .connect(deployerSigner)
            .approve(offplanRental.target, firstInstallment * BigInt(1e6));
          const tx2 = await offplanRental
            .connect(deployerSigner)
            .mintOffplanInstallments(tokenId, amountToOwn, firstInstallment);
          await tx2.wait(1);

          const investmentsData = await offplanRental.getInvestments();

          await network.provider.send("evm_increaseTime", [
            parseInt(upkeepInterval) + 10,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });

          const { performData } = await offplanRental.checkUpkeep.staticCall(
            "0x"
          );

          const transactionResponse2 = await offplanRental.performUpkeep(
            performData,
            { gasLimit: 5000000 }
          );
          await transactionResponse2.wait(1);

          const invData = await offplanRental.getInvestments();
          assert.equal(invData[0][6], 1);
          assert.equal(invData[1][6], 1);

          expect(investmentsData[0][2]).to.be.lessThan(invData[0][2]);
          expect(investmentsData[1][2]).to.be.lessThan(invData[1][2]);
        });
        it("Should push the investors in the consecutive defaulters array", async () => {
          const userBalBefore = await usdt.balanceOf(user);
          for (let i = 0; i < 4; i++) {
            await network.provider.send("evm_increaseTime", [
              parseInt(upkeepInterval) + 10,
            ]);
            await network.provider.request({ method: "evm_mine", params: [] });

            const { performData } = await offplanRental.checkUpkeep.staticCall(
              "0x"
            );

            const transactionResponse2 = await offplanRental.performUpkeep(
              performData,
              { gasLimit: 30000000 }
            );
            await transactionResponse2.wait(1);
          }

          const defaulters = await offplanRental.getConsecutiveDefaulters();

          assert.equal(defaulters[0], user);

          const investorData = await offplanRental.getInvestments();
          console.log(investorData);
          assert.equal(investorData[0][3], 0n);

          const investorShares = await offplanRental.balanceOf(user, tokenId);
          assert.equal(investorShares, 0n);

          const userBalAfter = await usdt.balanceOf(user);
          assert(userBalAfter > userBalBefore);
        });
      });
    });
