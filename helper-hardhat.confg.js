const networkConfig = {
  31337: {
    name: "localhost",
    usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7", //Mainnet USDT for forked network testing
  },
  11155111: {
    name: "sepolia",
    usdt: "0x7169d38820dfd117c3fa1f22a697dba58d90ba06", //Sepolia USDT for testnet testing
  },
};

const upkeepInterval = "180";
const developmentChains = ["hardhat", "localhost"];
const testURI =
  "https://nft.brickblock.estate/ipfs/bafkreiglx2wswxae5qsfp3pmlvt2qha4zjzqfyv5cncgcgqv4uwzhwfaiy/?filename=nft-668f108eac26f3feb9a96252.json"; //Test URI

module.exports = {
  networkConfig,
  developmentChains,
  testURI,
  upkeepInterval,
};
