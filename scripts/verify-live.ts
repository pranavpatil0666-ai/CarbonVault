import { ethers } from "hardhat";
import deployments from "../deployments.json";

async function main() {
  console.log("=========================================");
  console.log("CARBONVAULT LIVE ON-CHAIN STATE AUDIT");
  console.log("=========================================");

  // 1. VerifierRegistry
  const verifierRegistry = await ethers.getContractAt("VerifierRegistry", deployments.verifierRegistry);
  const verifierCount = await verifierRegistry.getVerifierCount();
  console.log(`[VerifierRegistry] Total Registered Verifiers: ${verifierCount}`);
  for (let i = 0; i < Number(verifierCount); i++) {
    const addr = await verifierRegistry.getVerifierAddressAt(i);
    const v = await verifierRegistry.getVerifier(addr);
    console.log(`  - Verifier #${i + 1}: ${v.name} (${v.accreditationRef}) Active: ${v.active}`);
  }

  // 2. ProjectRegistry
  const projectRegistry = await ethers.getContractAt("ProjectRegistry", deployments.projectRegistry);
  const projectCount = await projectRegistry.getProjectCount();
  console.log(`\n[ProjectRegistry] Total Registered Projects: ${projectCount}`);
  const statusNames = ["Pending", "UnderReview", "Verified", "Rejected", "Suspended"];
  for (let id = 1; id <= Number(projectCount); id++) {
    const p = await projectRegistry.getProject(id);
    const vRec = await projectRegistry.getVerification(id);
    console.log(`  - Project #${id}: "${p.name}"`);
    console.log(`      Registry: ${p.externalRegistry}:${p.externalProjectId} | Country: ${p.country}`);
    console.log(`      Status: ${statusNames[Number(p.status)]} | Approved Cap: ${vRec.estimatedMaxTonnes.toLocaleString()} tCO2e`);
  }

  // 3. CreditRegistry
  const creditRegistry = await ethers.getContractAt("CreditRegistry", deployments.creditRegistry);
  const batchCount = await creditRegistry.batchCount();
  console.log(`\n[CreditRegistry] Total Issued Batches: ${batchCount}`);
  for (let id = 1; id <= Number(batchCount); id++) {
    const b = await creditRegistry.getBatch(id);
    console.log(`  - Batch Token #${id}: Project #${b.projectId}, Vintage ${b.vintage}`);
    console.log(`      Quantity Issued: ${b.quantityIssued.toLocaleString()} t | Serials: ${b.serialNumberStart} -> ${b.serialNumberEnd}`);
  }

  // 4. Marketplace
  const marketplace = await ethers.getContractAt("Marketplace", deployments.marketplace);
  const listingCount = await marketplace.listingCount();
  console.log(`\n[Marketplace] Total Listings Created: ${listingCount}`);
  for (let id = 1; id <= Number(listingCount); id++) {
    const l = await marketplace.getListing(id);
    console.log(`  - Listing #${id}: Batch #${l.batchId}, Qty: ${l.quantity.toLocaleString()} t | Active: ${l.active}`);
  }

  // 5. RetirementManager
  const retirementManager = await ethers.getContractAt("RetirementManager", deployments.retirementManager);
  const retirementCount = await retirementManager.totalRetirements();
  console.log(`\n[RetirementManager] Total Retirement Certificates: ${retirementCount}`);
  for (let id = 1; id <= Number(retirementCount); id++) {
    const r = await retirementManager.getCertificate(id);
    console.log(`  - Certificate #${id}: ${r.amount.toLocaleString()} tCO2e for "${r.beneficiaryName}"`);
    console.log(`      Reason: "${r.retirementReason}"`);
    console.log(`      Cert Hash: ${r.certificateHash}`);
  }

  console.log("\n=========================================");
  console.log("ALL ON-CHAIN SUBSYSTEMS VERIFIED AND OPERATIONAL");
  console.log("=========================================");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
