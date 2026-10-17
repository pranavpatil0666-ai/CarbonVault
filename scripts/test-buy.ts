import { ethers } from "hardhat";
import deployments from "../deployments.json";

async function main() {
  const marketplace = await ethers.getContractAt(
    "Marketplace",
    deployments.marketplace
  );
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  try {
    await marketplace.buyListing.staticCall(1, 100);
    console.log(">>> Static call to buyListing(1, 100) SUCCEEDED!");
  } catch (err: any) {
    console.error(">>> Static call REVERTED:", err.message);
    if (err.data) console.error("Error data:", err.data);
  }
}

main().catch(console.error);
