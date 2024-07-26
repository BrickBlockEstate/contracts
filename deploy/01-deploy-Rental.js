const { network } = require("hardhat");
const {
  networkConfig,
  developmentChains,
  upkeepInterval,
  uriStartsWithBytes,
} = require("../helper-hardhat.confg");
const { verify } = require("../utils/Verification");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;

  log("-------------------------------------------------");
  log("Deploying Rental...");

  const constructorArgs = [networkConfig[chainId].usdt];

  const rental = await deploy("Rental", {
    from: deployer,
    log: true,
    args: constructorArgs,
    waitConfirmations: network.config.blockConfirmations || 1,
  });

  if (!developmentChains.includes(network.name)) {
    log("Verifying contract on etherscan please wait...");
    await verify(rental.address, constructorArgs);
  }
  log("-------------------------------------------------");
  log("successfully deployed NormalRental...");
};

module.exports.tags = ["all", "Rental"];
