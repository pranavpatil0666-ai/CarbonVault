import { ethers } from "hardhat";
import deployments from "../deployments.json";

async function main() {
  const projectRegistry = await ethers.getContractAt(
    "ProjectRegistry",
    deployments.projectRegistry
  );
  const [signer] = await ethers.getSigners();
  console.log("Signer address:", signer.address);

  const proj = await projectRegistry.getProject(2);
  console.log("Project #2 current status:", proj.status.toString());

  try {
    await projectRegistry.verifyProject.staticCall(
      2,
      "ipfs://bafybeiaudit-sgs-val-2024",
      250000,
      "Methodology VM0007 baseline verified via multi-spectral satellite imagery and historical PRODES validation."
    );
    console.log(">>> Static call to verifyProject(2) SUCCEEDED! No revert.");
  } catch (err: any) {
    console.error(">>> Static call to verifyProject(2) REVERTED:", err.message);
    if (err.data) console.error("Error data:", err.data);
  }
}

main().catch(console.error);
