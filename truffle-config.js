const HDWalletProvider = require('truffle-hdwallet-provider');
require('dotenv').config(); // Store environment-specific variable from '.env' to process.env

module.exports = {
  networks: {
    development: {
      host: 'localhost', // Localhost (default: none)
      port: 8545, // Standard Ethereum port (default: none)
      network_id: '*', // Any network (default: none)
      gas: 6000000,
      gasLimit: 6000000, // <-- Use this high gas value
      gasPrice: 1,
    },

    coverage: {
      host: 'localhost',
      network_id: '*',
      port: 8555, // <-- If you change this, also set the port option in .solcover.js.
      gas: 0xfffffffffff, // <-- Use this high gas value
      gasLimit: 0xfffffffffff, // <-- Use this high gas value
      gasPrice: 0x01, // <-- Use this low gas price
    },

    ropsten: {
      provider: () => new HDWalletProvider(
        process.env.PRIVATE_KEY,
        `https://ropsten.infura.io/v3/${process.env.INFURA_API_KEY}`,
      ),
      network_id: 3,
      gas: 4000000,
      gasLimit: 4000000,
      gasPrice: 120000000000,
    },

    kovan: {
      provider: () => new HDWalletProvider(
        process.env.MNENOMIC,
        `https://kovan.infura.io/v3/${process.env.INFURA_API_KEY}`, 0, 3,
      ),
      network_id: 42,
      // gas: 8000000,
      // gasLimit: 8000000, // <-- Use this high gas value
      gasPrice: 1000000000,
    },

    main: {
      provider: () => new HDWalletProvider(
        process.env.PRIVATE_KEY, `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      ),
      gas: 4000000,
      gasLimit: 4000000,
      gasPrice: 120000000000,
      network_id: 1,
    },
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  compilers: {
    solc: {
      version: '0.7.6',
      settings: {
        optimizer: {
          enabled: true,
          runs: 10000,
        },
      },
    },
  },

  plugins: [
    'truffle-plugin-solhint',
  ],
};
