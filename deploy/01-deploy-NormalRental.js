const { network } = require("hardhat");
const {
  networkConfig,
  developmentChains,
  upkeepInterval,
} = require("../helper-hardhat.confg");
const { verify } = require("../utils/Verification");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;

  log("-------------------------------------------------");
  log("Deploying NormalRental...");

  const constructorArgs = [networkConfig[chainId].usdt, upkeepInterval];

  const normalRental = await deploy("NormalRental", {
    from: deployer,
    log: true,
    args: constructorArgs,
    waitConfirmations: network.config.blockConfirmations,
  });

  if (!developmentChains.includes(network.name)) {
    log("Verifying contract on etherscan please wait...");
    await verify(normalRental.address, constructorArgs);
  }
  log("-------------------------------------------------");
  log("successfully deployed NormalRental...");
};

module.exports.tags = ["all", "NormalRental"];
