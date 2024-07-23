const { getNamedAccounts, deployments, network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat.confg");
const { verify } = require("../utils/Verification");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log("---------------------------------------");
  log("deploying test fav number");

  const favNum = await deploy("FavoriteNumber", {
    from: deployer,
    log: true,
    args: [],
    waitConfirmations: network.config.blockConfirmations || 1,
  });

  if (!developmentChains.includes(network.name)) {
    await verify(favNum.address, []);
  }

  log("---------------------------------------");
};

module.exports.tags = ["all", "test"];
