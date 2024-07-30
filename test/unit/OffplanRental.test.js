const { expect, assert } = require("chai");
const {
  developmentChains,
  testURI,
  networkConfig,
  upkeepInterval,
} = require("../helper-hardhat.confg");
const { network, getNamedAccounts, ethers, deployments } = require("hardhat");
const { AbiCoder } = require("ethers");

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
    });
