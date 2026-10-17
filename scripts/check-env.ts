import config from "../hardhat.config";
import { ethers } from "hardhat";

async function main() {
  console.log("Sepolia network config URL:", (config.networks as any)?.sepolia?.url);
  console.log("Sepolia accounts configured:", (config.networks as any)?.sepolia?.accounts?.length);
  const [signer] = await ethers.getSigners();
  console.log("Deployer address:", signer.address);
}

main().catch(console.error);
