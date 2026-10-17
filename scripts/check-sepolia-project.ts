import { ethers } from "hardhat";
import deployments from "../deployments.json";

async function main() {
  const projectRegistry = await ethers.getContractAt(
    "ProjectRegistry",
    deployments.projectRegistry
  );

  const count = await projectRegistry.getProjectCount();
  console.log("Current Sepolia Project Count:", count.toString());

  for (let i = 1; i <= Number(count); i++) {
    const p = await projectRegistry.getProject(i);
    console.log(`Project #${i}:`, {
      name: p.name,
      externalRegistry: p.externalRegistry,
      externalProjectId: p.externalProjectId,
      status: p.status,
      developer: p.developer,
    });
  }

  // Check key for "Verra VCS" + "VCS-6983"
  // Note: Solidity does: bytes32 externalKey = keccak256(abi.encode(externalRegistry, externalProjectId));
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const encoded = abiCoder.encode(["string", "string"], ["Verra VCS", "VCS-6983"]);
  const key = ethers.keccak256(encoded);
  console.log("Checking external key for (Verra VCS, VCS-6983):", key);

  // Check if project exists by calling registerProject simulate / callStatic
  try {
    const [deployer] = await ethers.getSigners();
    console.log("Simulating registerProject with deployer:", deployer.address);
    const tx = await projectRegistry.registerProject.staticCall(
      "Rimba Raya Peatland Conservation #6983",
      "VM0004 - Avoided Deforestation",
      "Indonesia",
      2022,
      2031,
      "Verra VCS",
      "VCS-6983",
      "ipfs://bafybeir6983rimba-raya-pdd-summary"
    );
    console.log("Static call succeeded! Returned projectId:", tx.toString());
  } catch (err: any) {
    console.log("Static call failed with error:", err.message);
    if (err.data) {
      console.log("Error data:", err.data);
    }
  }
}

main().catch(console.error);
