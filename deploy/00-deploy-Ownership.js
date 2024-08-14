const { network } = require("hardhat");

module.exports = async ({ deployments, getNamedAccounts }) => {
  const { deploy, log } = await deployments;
  const { deployer } = await getNamedAccounts();

  log("-------------------------------------------------");
  log("Deploying FractionalOwnership...");

  const Ownership = await deploy("Ownership", {
    from: deployer,
    log: true,
    args: [],
    waitConfirmations: network.config.blockConfirmations || 1,
  });

  log("Successfully deployed Ownership contract");
  log("-------------------------------------------------");
};

module.exports.tags = ["all", "Ownership"];
