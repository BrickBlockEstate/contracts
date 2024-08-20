const { network } = require("hardhat");
const { networkConfig } = require("../helper-hardhat.confg");

module.exports = async ({ deployments, getNamedAccounts }) => {
  const { deploy, log } = await deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;

  log("-------------------------------------------------");
  log("Deploying Ownership...");

  const usdt = networkConfig[chainId].usdt;
  const constructorArgs = [usdt];

  const Ownership = await deploy("Ownership", {
    from: deployer,
    log: true,
    args: constructorArgs,
    waitConfirmations: network.config.blockConfirmations || 1,
  });

  log("Successfully deployed Ownership contract");
  log("-------------------------------------------------");
};

module.exports.tags = ["all", "Ownership"];
