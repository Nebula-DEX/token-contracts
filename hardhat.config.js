require("@nomicfoundation/hardhat-toolbox");
require("hardhat-tracer");

const pk = process.env.PRIV_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.26",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 10_000
      }
    }
  },
  networks: {
    mainnet: {
      url: "https://mainnet.infura.io/v3/35466ea974844d3fa4066151068fbbd8",
      accounts: [pk]
    }
  }
};
