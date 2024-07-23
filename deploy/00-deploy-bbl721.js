const { network } = require("hardhat");


module.exports = async ({ deployments, getNamedAccounts }) => {
    const { deploy, log } = await deployments;
    const { deployer } = await getNamedAccounts();

    log("-------------------------------------------------");
    log("Deploying Bbl721...");

    const bbl721 = await deploy("Bbl721", {
        from: deployer,
        log: true,
        args: [],
        waitConfirmations: network.config.blockConfirmations || 1,
    });

    log("Successfully deployed Bbl721");
    log("-------------------------------------------------");
}

module.exports.tags = ["all", "bbl721"];