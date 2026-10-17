import { ethers } from "hardhat";
import deployments from "../deployments.json";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Setting up initial verifier role for:", signer.address);

  const verifierRegistry = await ethers.getContractAt("VerifierRegistry", deployments.verifierRegistry, signer);

  // Check if signer is already a verifier
  const isVerif = await verifierRegistry.isVerifier(signer.address);
  if (!isVerif) {
    console.log("Adding deployer as authorized verifier in VerifierRegistry...");
    const tx = await verifierRegistry.addVerifier(
      signer.address,
      "SGS Carbon Auditor (Sepolia)",
      "UNFCCC DOE #0012 / ISO 14065",
      "ipfs://bafybeicverifieraccreditationsummary"
    );
    await tx.wait();
    console.log("✓ Added deployer as authorized verifier on Sepolia! Tx:", tx.hash);
  } else {
    console.log("✓ Deployer is already an authorized verifier on Sepolia.");
  }
}

main().catch(console.error);
