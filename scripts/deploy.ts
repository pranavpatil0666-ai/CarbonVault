import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

export interface DeployedContracts {
  network: string;
  chainId: number;
  deployedAt: string;
  verifierRegistry: string;
  projectRegistry: string;
  creditRegistry: string;
  marketplace: string;
  retirementManager: string;
  mockUsdc: string;
  adminAddress: string;
}

export async function deployCarbonVault(): Promise<DeployedContracts> {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("=================================================");
  console.log("🚀 Deploying CarbonVault Protocol");
  console.log(`Network: ${network.name} (ChainID: ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);
  console.log("=================================================");

  // 1. Deploy VerifierRegistry
  console.log("\n1. Deploying VerifierRegistry...");
  const VerifierRegistry = await ethers.getContractFactory("VerifierRegistry");
  const verifierRegistry = await VerifierRegistry.deploy(deployer.address);
  await verifierRegistry.waitForDeployment();
  const verifierRegistryAddr = await verifierRegistry.getAddress();
  console.log(`   ✓ VerifierRegistry deployed to: ${verifierRegistryAddr}`);

  // 2. Deploy ProjectRegistry
  console.log("\n2. Deploying ProjectRegistry...");
  const ProjectRegistry = await ethers.getContractFactory("ProjectRegistry");
  const projectRegistry = await ProjectRegistry.deploy(deployer.address, verifierRegistryAddr);
  await projectRegistry.waitForDeployment();
  const projectRegistryAddr = await projectRegistry.getAddress();
  console.log(`   ✓ ProjectRegistry deployed to: ${projectRegistryAddr}`);

  // 3. Deploy CreditRegistry (ERC-1155)
  console.log("\n3. Deploying CreditRegistry (ERC-1155)...");
  const CreditRegistry = await ethers.getContractFactory("CreditRegistry");
  const baseURI = "https://api.carbonvault.io/metadata/{id}.json";
  const creditRegistry = await CreditRegistry.deploy(deployer.address, projectRegistryAddr, baseURI);
  await creditRegistry.waitForDeployment();
  const creditRegistryAddr = await creditRegistry.getAddress();
  console.log(`   ✓ CreditRegistry deployed to: ${creditRegistryAddr}`);

  // 4. Deploy Marketplace
  console.log("\n4. Deploying Marketplace...");
  const feeBasisPoints = 150; // 1.50% platform fee
  const feeRecipient = deployer.address;
  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy(
    deployer.address,
    creditRegistryAddr,
    projectRegistryAddr,
    feeBasisPoints,
    feeRecipient
  );
  await marketplace.waitForDeployment();
  const marketplaceAddr = await marketplace.getAddress();
  console.log(`   ✓ Marketplace deployed to: ${marketplaceAddr}`);

  // 5. Deploy RetirementManager
  console.log("\n5. Deploying RetirementManager...");
  const RetirementManager = await ethers.getContractFactory("RetirementManager");
  const retirementManager = await RetirementManager.deploy(deployer.address, creditRegistryAddr);
  await retirementManager.waitForDeployment();
  const retirementManagerAddr = await retirementManager.getAddress();
  console.log(`   ✓ RetirementManager deployed to: ${retirementManagerAddr}`);

  // 6. Grant RETIREMENT_ROLE to RetirementManager on CreditRegistry
  console.log("\n6. Configuring protocol roles...");
  const RETIREMENT_ROLE = await creditRegistry.RETIREMENT_ROLE();
  const roleTx = await creditRegistry.grantRole(RETIREMENT_ROLE, retirementManagerAddr);
  await roleTx.wait();
  console.log(`   ✓ Granted RETIREMENT_ROLE to RetirementManager on CreditRegistry`);

  // 7. Deploy Mock USDC for dev / testnet
  console.log("\n7. Deploying Mock USDC (18 decimals)...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockUsdc = await MockERC20.deploy("USD Coin", "USDC", 18);
  await mockUsdc.waitForDeployment();
  const mockUsdcAddr = await mockUsdc.getAddress();
  console.log(`   ✓ Mock USDC deployed to: ${mockUsdcAddr}`);

  const deploymentData: DeployedContracts = {
    network: network.name,
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
    verifierRegistry: verifierRegistryAddr,
    projectRegistry: projectRegistryAddr,
    creditRegistry: creditRegistryAddr,
    marketplace: marketplaceAddr,
    retirementManager: retirementManagerAddr,
    mockUsdc: mockUsdcAddr,
    adminAddress: deployer.address,
  };

  // Save to deployments.json
  const deploymentsPath = path.join(__dirname, "../deployments.json");
  fs.writeFileSync(deploymentsPath, JSON.stringify(deploymentData, null, 2));
  console.log(`\n📄 Deployment configuration saved to: ${deploymentsPath}`);

  return deploymentData;
}

if (require.main === module) {
  deployCarbonVault()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
