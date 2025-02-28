// SPDX-License-Identifier: Apache-2.0
module.exports = async ({
  deployments,
  getNamedAccounts
}) => {
  const {execute, deploy} = deployments;
  const { ethers, upgrades } = require("hardhat");
  const {deployer} = await getNamedAccounts();

  console.log(`Deploying NetEmissionsTokenNetwork with account: ${deployer}`);

  let netEmissionsTokenNetwork = await deploy('NetEmissionsTokenNetwork', {
    from: deployer,
    proxy: {
      owner: deployer,
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: 'initialize',
        args: [ deployer ]
      }
    },
  });

  console.log("NetEmissionsTokenNetwork deployed to:", netEmissionsTokenNetwork.address);

  const timelock = await deployments.get('Timelock');

  await execute(
    'NetEmissionsTokenNetwork',
    { from: deployer },
    'setTimelock',
    timelock.address
  );
  console.log("Timelock address set so that the DAO has permission to issue tokens with issueOnBehalf().");


  console.log(`Deploying CarbonTracker with account: ${deployer}`);

  let carbonTracker = await deploy('CarbonTracker', {
    from: deployer,
    proxy: {
      owner: deployer,
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: 'initialize',
        args: [ netEmissionsTokenNetwork.address, deployer, ]
      }
    },
  });

  console.log("CarbonTracker deployed to:", carbonTracker.address);


};

module.exports.tags = ['CLM8'];
module.exports.dependencies = ['DAO'];
