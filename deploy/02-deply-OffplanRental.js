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
  log("Deploying OffplanRental...");

  const constructorArgs = [networkConfig[chainId].usdt, upkeepInterval];

  const rental = await deploy("OffplanRental", {
    from: deployer,
    log: true,
    args: constructorArgs,
    waitConfirmations: network.config.blockConfirmations || 1,
  });

  if (!developmentChains.includes(network.name)) {
    await verify(rental.address, constructorArgs);
  }
  log("-------------------------------------------------");
  log("successfully deployed NormalRental...");
};

module.exports.tags = ["all", "OffplanRental"];
