import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { deployCarbonVault, DeployedContracts } from "./deploy";
import {
  VerifierRegistry,
  ProjectRegistry,
  CreditRegistry,
  Marketplace,
  RetirementManager,
  MockERC20,
} from "../typechain-types";

export async function seedCarbonVault() {
  const signers = await ethers.getSigners();
  const admin = signers[0];
  const sgsAuditor = signers[1] || admin;
  const dnvAuditor = signers[2] || admin;
  const devAmazon = signers[3] || admin;
  const devMangrove = signers[4] || admin;
  const devDac = signers[5] || admin;
  const buyer1 = signers[6] || admin;
  const buyer2 = signers[7] || admin;

  console.log("=================================================");
  console.log("🌱 Seeding CarbonVault with Realistic Market Data");
  console.log(`Admin / Deployer: ${admin.address}`);
  console.log(`Auditor 1 (SGS): ${sgsAuditor.address}`);
  console.log(`Auditor 2 (DNV): ${dnvAuditor.address}`);
  console.log(`Developer 1 (Amazon): ${devAmazon.address}`);
  console.log(`Developer 2 (Mangrove): ${devMangrove.address}`);
  console.log(`Developer 3 (DAC): ${devDac.address}`);
  console.log(`Buyer 1 (Corporate): ${buyer1.address}`);
  console.log(`Buyer 2 (Tech Co): ${buyer2.address}`);
  console.log("=================================================\n");

  const deploymentsPath = path.join(__dirname, "../deployments.json");
  let deployment: DeployedContracts = {} as DeployedContracts;
  let needDeploy = true;
  if (fs.existsSync(deploymentsPath)) {
    try {
      deployment = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
      const code = await ethers.provider.getCode(deployment.verifierRegistry);
      if (code && code !== "0x") {
        needDeploy = false;
      }
    } catch (e) {
      needDeploy = true;
    }
  }

  if (needDeploy) {
    console.log("Deploying fresh contracts to network...");
    deployment = await deployCarbonVault();
  }

  // Attach contracts
  const verifierRegistry = (await ethers.getContractAt(
    "VerifierRegistry",
    deployment.verifierRegistry,
    admin
  )) as unknown as VerifierRegistry;

  const projectRegistry = (await ethers.getContractAt(
    "ProjectRegistry",
    deployment.projectRegistry,
    admin
  )) as unknown as ProjectRegistry;

  const creditRegistry = (await ethers.getContractAt(
    "CreditRegistry",
    deployment.creditRegistry,
    admin
  )) as unknown as CreditRegistry;

  const marketplace = (await ethers.getContractAt(
    "Marketplace",
    deployment.marketplace,
    admin
  )) as unknown as Marketplace;

  const retirementManager = (await ethers.getContractAt(
    "RetirementManager",
    deployment.retirementManager,
    admin
  )) as unknown as RetirementManager;

  const mockUsdc = (await ethers.getContractAt(
    "MockERC20",
    deployment.mockUsdc,
    admin
  )) as unknown as MockERC20;

  // --------------------------------------------------------------------------
  // STEP 1: Register Authorized Independent Verifiers
  // --------------------------------------------------------------------------
  console.log("--- 1. Authorizing Accredited Verifiers ---");

  // Check if SGS is already registered
  const sgsActive = await verifierRegistry.isVerifier(sgsAuditor.address).catch(() => false);
  if (!sgsActive) {
    const tx1 = await verifierRegistry.addVerifier(
      sgsAuditor.address,
      "SGS Climate Solutions",
      "UNFCCC DOE #0012 / ISO 14065:2020",
      "ipfs://bafybeicgxx7aez54vdsw4b4dpm3n7r5g5tcv6n5p5dfh6w5k4u3m2q/sgs-accreditation.pdf"
    );
    await tx1.wait();
    console.log(`   ✓ Added Verifier 1: SGS Climate Solutions (${sgsAuditor.address})`);
  } else {
    console.log(`   ℹ Verifier 1 already registered: ${sgsAuditor.address}`);
  }

  const dnvActive = await verifierRegistry.isVerifier(dnvAuditor.address).catch(() => false);
  if (!dnvActive) {
    const tx2 = await verifierRegistry.addVerifier(
      dnvAuditor.address,
      "DNV Carbon Assurance Services",
      "UNFCCC DOE #0044 / ISO 14064-3:2019",
      "ipfs://bafybeifwx6f3v3kd44j2l2m5k6n7p8q9r0s1t2u3v4w5x6y7z8a/dnv-accreditation.pdf"
    );
    await tx2.wait();
    console.log(`   ✓ Added Verifier 2: DNV Carbon Assurance (${dnvAuditor.address})`);
  } else {
    console.log(`   ℹ Verifier 2 already registered: ${dnvAuditor.address}`);
  }

  // --------------------------------------------------------------------------
  // STEP 2: Register & Verify Projects
  // --------------------------------------------------------------------------
  console.log("\n--- 2. Registering & Verifying Projects ---");

  const projectCount = await projectRegistry.getProjectCount();
  if (projectCount === 0n) {
    // Project 1: Tumucumaque Amazon REDD+ Conservation
    console.log("   Registering Project 1: Tumucumaque Amazon REDD+ Conservation...");
    const regTx1 = await projectRegistry.connect(devAmazon).registerProject(
      "Tumucumaque Amazon REDD+ Conservation",
      "VM0007 (REDD+ Methodology for Avoided Deforestation)",
      "Brazil",
      2021,
      2030,
      "Verra VCS",
      "VCS-1122",
      "ipfs://bafybeidvxqm3p4r5s6t7u8v9w0x1y2z3a4b5c6d7e8f9g0h1i2j/tumucumaque-pdd.pdf"
    );
    await regTx1.wait();

    // SGS reviews and verifies Project 1
    const revTx1 = await projectRegistry.connect(sgsAuditor).startReview(1);
    await revTx1.wait();

    const maxCapAmazon = ethers.parseEther("250000"); // 250,000 tonnes approved
    const verTx1 = await projectRegistry.connect(sgsAuditor).verifyProject(
      1,
      "ipfs://bafybeihpx2r3s4t5u6v7w8x9y0z1a2b3c4d5e6f7g8h9i0j1k2l/sgs-validation-vcs1122.pdf",
      maxCapAmazon,
      "Approved under VCS Standard v4.4. Full additionality and buffer pool compliance attested."
    );
    await verTx1.wait();
    console.log(`   ✓ Project 1 Verified by SGS (Cap: 250,000 tonnes CO2e)`);

    // Project 2: Kilifi Mangrove Blue Carbon Initiative
    console.log("   Registering Project 2: Kilifi Mangrove Blue Carbon Initiative...");
    const regTx2 = await projectRegistry.connect(devMangrove).registerProject(
      "Kilifi Mangrove Blue Carbon Initiative",
      "VM0033 (Tidal Wetland Restoration & Coastal Conservation)",
      "Kenya",
      2022,
      2032,
      "Verra VCS",
      "VCS-2450",
      "ipfs://bafybeigxxqm1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t/kilifi-mangrove-pdd.pdf"
    );
    await regTx2.wait();

    // DNV reviews and verifies Project 2
    const revTx2 = await projectRegistry.connect(dnvAuditor).startReview(2);
    await revTx2.wait();

    const maxCapMangrove = ethers.parseEther("120000"); // 120,000 tonnes approved
    const verTx2 = await projectRegistry.connect(dnvAuditor).verifyProject(
      2,
      "ipfs://bafybeiaqx1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0r1s/dnv-validation-vcs2450.pdf",
      maxCapMangrove,
      "Verified under VCS Blue Carbon Guidance. Soil organic carbon sequestration documented."
    );
    await verTx2.wait();
    console.log(`   ✓ Project 2 Verified by DNV (Cap: 120,000 tonnes CO2e)`);

    // Project 3: Hellisheidi Geothermal Direct Air Capture
    console.log("   Registering Project 3: Hellisheidi Geothermal Direct Air Capture & Mineralization...");
    const regTx3 = await projectRegistry.connect(devDac).registerProject(
      "Hellisheidi Geothermal Direct Air Capture & Mineralization",
      "CDR001 (Direct Air Capture with Permanent Basaltic Storage)",
      "Iceland",
      2023,
      2035,
      "Gold Standard",
      "GS-7740",
      "ipfs://bafybeieyx5v6w7x8y9z0a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p/hellisheidi-dac-pdd.pdf"
    );
    await regTx3.wait();

    // SGS starts review for Project 3, leaving it in UnderReview status
    const revTx3 = await projectRegistry.connect(sgsAuditor).startReview(3);
    await revTx3.wait();
    console.log(`   ✓ Project 3 Registered and UnderReview (demonstrating pending audit workflow)`);
  } else {
    console.log(`   ℹ Projects already registered (${projectCount} found).`);
  }

  // --------------------------------------------------------------------------
  // STEP 3: Issue Credit Batches (ERC-1155)
  // --------------------------------------------------------------------------
  console.log("\n--- 3. Issuing Verified Carbon Credit Batches ---");

  const batchCount = await creditRegistry.batchCount();
  if (batchCount === 0n) {
    // Batch 1: Project 1 (Tumucumaque), Vintage 2022, 60,000 tonnes
    console.log("   Issuing Batch 1 (Tumucumaque 2022: 60,000 tonnes)...");
    const issueTx1 = await creditRegistry.issueBatch(
      1,
      2022,
      ethers.parseEther("60000"),
      "VCS-1122-2022-000001",
      "VCS-1122-2022-060000",
      "ipfs://bafybeihb1x2y3z4a5b6c7d8e9f0g1h2i3j4k5l6m7n8o9p0q1r/vcs1122-issuance-2022.pdf",
      devAmazon.address
    );
    await issueTx1.wait();
    console.log(`   ✓ Batch 1 issued to Developer (${devAmazon.address})`);

    // Batch 2: Project 1 (Tumucumaque), Vintage 2023, 80,000 tonnes
    console.log("   Issuing Batch 2 (Tumucumaque 2023: 80,000 tonnes)...");
    const issueTx2 = await creditRegistry.issueBatch(
      1,
      2023,
      ethers.parseEther("80000"),
      "VCS-1122-2023-000001",
      "VCS-1122-2023-080000",
      "ipfs://bafybeihb2x2y3z4a5b6c7d8e9f0g1h2i3j4k5l6m7n8o9p0q1r/vcs1122-issuance-2023.pdf",
      devAmazon.address
    );
    await issueTx2.wait();
    console.log(`   ✓ Batch 2 issued to Developer (${devAmazon.address})`);

    // Batch 3: Project 2 (Kilifi Mangrove), Vintage 2023, 40,000 tonnes
    console.log("   Issuing Batch 3 (Kilifi Mangrove 2023: 40,000 tonnes)...");
    const issueTx3 = await creditRegistry.issueBatch(
      2,
      2023,
      ethers.parseEther("40000"),
      "VCS-2450-2023-000001",
      "VCS-2450-2023-040000",
      "ipfs://bafybeihb3x2y3z4a5b6c7d8e9f0g1h2i3j4k5l6m7n8o9p0q1r/vcs2450-issuance-2023.pdf",
      devMangrove.address
    );
    await issueTx3.wait();
    console.log(`   ✓ Batch 3 issued to Developer (${devMangrove.address})`);
  } else {
    console.log(`   ℹ Batches already issued (${batchCount} found).`);
  }

  // --------------------------------------------------------------------------
  // STEP 4: Seed Marketplace Listings & Initial Purchases
  // --------------------------------------------------------------------------
  console.log("\n--- 4. Seeding Marketplace Listings & Trading ---");

  // Mint Mock USDC to buyers
  const mintTx1 = await mockUsdc.mint(buyer1.address, ethers.parseEther("500000"));
  await mintTx1.wait();
  const mintTx2 = await mockUsdc.mint(buyer2.address, ethers.parseEther("500000"));
  await mintTx2.wait();

  // Approve Marketplace for developers
  const appTx1 = await creditRegistry
    .connect(devAmazon)
    .setApprovalForAll(deployment.marketplace, true);
  await appTx1.wait();

  const appTx2 = await creditRegistry
    .connect(devMangrove)
    .setApprovalForAll(deployment.marketplace, true);
  await appTx2.wait();

  const listingCount = await marketplace.listingCount();
  if (listingCount === 0n) {
    // Listing 1: Batch 1 (Tumucumaque 2022) - 15,000 tonnes @ 0.006 ETH/tonne
    console.log("   Creating Listing 1: 15,000 tonnes of Batch 1 for ETH...");
    const listTx1 = await marketplace
      .connect(devAmazon)
      .createListing(1, ethers.parseEther("15000"), ethers.parseEther("0.006"), ethers.ZeroAddress);
    await listTx1.wait();
    console.log("   ✓ Listing 1 active (ETH denomination)");

    // Listing 2: Batch 2 (Tumucumaque 2023) - 25,000 tonnes @ 14.50 USDC/tonne
    console.log("   Creating Listing 2: 25,000 tonnes of Batch 2 for USDC...");
    const listTx2 = await marketplace
      .connect(devAmazon)
      .createListing(2, ethers.parseEther("25000"), ethers.parseEther("14.5"), deployment.mockUsdc);
    await listTx2.wait();
    console.log("   ✓ Listing 2 active (USDC denomination)");

    // Listing 3: Batch 3 (Kilifi Mangrove 2023) - 10,000 tonnes @ 24.00 USDC/tonne (Premium Blue Carbon)
    console.log("   Creating Listing 3: 10,000 tonnes of Batch 3 for USDC (Premium Blue Carbon)...");
    const listTx3 = await marketplace
      .connect(devMangrove)
      .createListing(3, ethers.parseEther("10000"), ethers.parseEther("24.0"), deployment.mockUsdc);
    await listTx3.wait();
    console.log("   ✓ Listing 3 active (Premium Blue Carbon)");

    // Execute partial fill trade 1: Buyer 1 buys 5,000 tonnes of Batch 1 with ETH
    console.log("\n   Executing Trade 1: Buyer 1 buys 5,000 tonnes from Listing 1 with ETH...");
    // 5000 tonnes * 0.006 ETH = 30 ETH
    const costTrade1 = ethers.parseEther("30");
    const buyTx1 = await marketplace
      .connect(buyer1)
      .buyListing(1, ethers.parseEther("5000"), { value: costTrade1 });
    await buyTx1.wait();
    console.log(`   ✓ Trade 1 executed: Buyer 1 received 5,000 tonnes of Batch 1`);

    // Execute partial fill trade 2: Buyer 2 buys 10,000 tonnes of Batch 2 with USDC
    console.log("   Executing Trade 2: Buyer 2 buys 10,000 tonnes from Listing 2 with USDC...");
    const appUsdcTx = await mockUsdc
      .connect(buyer2)
      .approve(deployment.marketplace, ethers.MaxUint256);
    await appUsdcTx.wait();

    const buyTx2 = await marketplace
      .connect(buyer2)
      .buyListing(2, ethers.parseEther("10000"));
    await buyTx2.wait();
    console.log(`   ✓ Trade 2 executed: Buyer 2 received 10,000 tonnes of Batch 2`);
  } else {
    console.log(`   ℹ Listings already seeded (${listingCount} found).`);
  }

  // --------------------------------------------------------------------------
  // STEP 5: Seed Permanent Retirements & Certificates
  // --------------------------------------------------------------------------
  console.log("\n--- 5. Seeding Permanent Retirements & Public Certificates ---");

  const totalRetirements = await retirementManager.totalRetirements();
  if (totalRetirements === 0n) {
    // Retirement 1: Buyer 1 retires 3,000 tonnes of Batch 1
    console.log("   Retiring 3,000 tonnes of Batch 1 for 'Acme Global Logistics'...");
    const retTx1 = await retirementManager
      .connect(buyer1)
      .retireCredits(
        1,
        ethers.parseEther("3000"),
        "Acme Global Logistics Corp",
        "Scope 1 Fleet Decarbonization & Net-Zero 2024 Commitment",
        "https://registry.verra.org/retirements/VCS-RET-90112"
      );
    await retTx1.wait();
    console.log(`   ✓ Certificate #1 issued to Acme Global Logistics Corp`);

    // Retirement 2: Buyer 2 retires 6,000 tonnes of Batch 2
    console.log("   Retiring 6,000 tonnes of Batch 2 for 'FinTech Cloud Networks'...");
    const retTx2 = await retirementManager
      .connect(buyer2)
      .retireCredits(
        2,
        ethers.parseEther("6000"),
        "FinTech Cloud Networks Inc",
        "Scope 2 Cloud Data Center Energy Neutrality FY2024",
        "https://registry.verra.org/retirements/VCS-RET-90455"
      );
    await retTx2.wait();
    console.log(`   ✓ Certificate #2 issued to FinTech Cloud Networks Inc`);
  } else {
    console.log(`   ℹ Retirements already seeded (${totalRetirements} found).`);
  }

  console.log("\n=================================================");
  console.log("🎉 CarbonVault Seed Data Setup Complete!");
  console.log("=================================================");
}

if (require.main === module) {
  seedCarbonVault()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
