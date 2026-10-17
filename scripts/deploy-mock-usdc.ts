import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("Deploying Mock USDC on Sepolia with deployer:", deployer.address);
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockUsdc = await MockERC20.deploy("USD Coin", "USDC", 18);
  await mockUsdc.waitForDeployment();
  const mockUsdcAddr = await mockUsdc.getAddress();
  console.log("✓ Mock USDC deployed to:", mockUsdcAddr);

  const deploymentData = {
    network: network.name,
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
    verifierRegistry: "0x53855A39559b756702d710A8AE26fe07b02C8170",
    projectRegistry: "0x4325098775c58Ddd6763F100a375197dEf3985C1",
    creditRegistry: "0xa5c2811146BE07f473743d0521992857c5aB26F4",
    marketplace: "0xcdCEf1c3fb8BF2EB439c658a086B155f37112eB2",
    retirementManager: "0xC01c0688D0c567F0C3F229E445A1207e353b0fA9",
    mockUsdc: mockUsdcAddr,
    adminAddress: deployer.address,
  };

  const deploymentsPath = path.join(__dirname, "../deployments.json");
  fs.writeFileSync(deploymentsPath, JSON.stringify(deploymentData, null, 2));
  console.log("Saved deployments.json:", deploymentsPath);
}

main().catch(console.error);
