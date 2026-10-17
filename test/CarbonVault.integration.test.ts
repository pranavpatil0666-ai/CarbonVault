import { expect } from "chai";
import { ethers } from "hardhat";
import {
  VerifierRegistry,
  ProjectRegistry,
  CreditRegistry,
  Marketplace,
  RetirementManager,
  MockERC20,
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CarbonVault End-to-End Integration", function () {
  let verifierRegistry: VerifierRegistry;
  let projectRegistry: ProjectRegistry;
  let creditRegistry: CreditRegistry;
  let marketplace: Marketplace;
  let retirementManager: RetirementManager;
  let mockUsdc: MockERC20;

  let admin: SignerWithAddress;
  let auditor: SignerWithAddress;
  let developer: SignerWithAddress;
  let investor: SignerWithAddress;
  let corporateBuyer: SignerWithAddress;
  let feeTreasury: SignerWithAddress;

  const PROJECT_CAP = ethers.parseEther("200000"); // 200,000 tonnes approved
  const BATCH1_QTY = ethers.parseEther("50000"); // 50,000 tonnes (2023 vintage)
  const BATCH2_QTY = ethers.parseEther("80000"); // 80,000 tonnes (2024 vintage)

  before(async function () {
    [admin, auditor, developer, investor, corporateBuyer, feeTreasury] =
      await ethers.getSigners();

    // 1. Deploy VerifierRegistry
    const VerifierRegistry = await ethers.getContractFactory("VerifierRegistry");
    verifierRegistry = await VerifierRegistry.deploy(admin.address);
    await verifierRegistry.waitForDeployment();

    // 2. Deploy ProjectRegistry
    const ProjectRegistry = await ethers.getContractFactory("ProjectRegistry");
    projectRegistry = await ProjectRegistry.deploy(
      admin.address,
      await verifierRegistry.getAddress()
    );
    await projectRegistry.waitForDeployment();

    // 3. Deploy CreditRegistry
    const CreditRegistry = await ethers.getContractFactory("CreditRegistry");
    creditRegistry = await CreditRegistry.deploy(
      admin.address,
      await projectRegistry.getAddress(),
      "https://api.carbonvault.io/metadata/{id}.json"
    );
    await creditRegistry.waitForDeployment();

    // 4. Deploy Marketplace
    const Marketplace = await ethers.getContractFactory("Marketplace");
    marketplace = await Marketplace.deploy(
      admin.address,
      await creditRegistry.getAddress(),
      await projectRegistry.getAddress(),
      100, // 1.00% fee
      feeTreasury.address
    );
    await marketplace.waitForDeployment();

    // 5. Deploy RetirementManager
    const RetirementManager = await ethers.getContractFactory("RetirementManager");
    retirementManager = await RetirementManager.deploy(
      admin.address,
      await creditRegistry.getAddress()
    );
    await retirementManager.waitForDeployment();

    // 6. Grant RETIREMENT_ROLE to RetirementManager
    const RETIREMENT_ROLE = await creditRegistry.RETIREMENT_ROLE();
    await creditRegistry.grantRole(RETIREMENT_ROLE, await retirementManager.getAddress());

    // 7. Deploy Mock USDC
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockUsdc = await MockERC20.deploy("USD Coin", "USDC", 18);
    await mockUsdc.waitForDeployment();

    // Mint USDC to corporate buyer
    await mockUsdc.mint(corporateBuyer.address, ethers.parseEther("1000000"));
  });

  it("Step 1: Admin authorizes accredited verifier", async function () {
    await verifierRegistry.addVerifier(
      auditor.address,
      "SGS Carbon Verification Services",
      "UNFCCC-DOE-0012 / ISO-14065",
      "ipfs://QmSgsAccreditationDocs"
    );

    expect(await verifierRegistry.isVerifier(auditor.address)).to.be.true;
  });

  it("Step 2: Developer registers carbon project", async function () {
    const tx = await projectRegistry.connect(developer).registerProject(
      "Tumucumaque Mountains National Park REDD+",
      "VM0007",
      "Brazil",
      2023,
      2030,
      "Verra VCS",
      "VCS-1122",
      "ipfs://QmTumucumaquePDD"
    );
    await tx.wait();

    expect(await projectRegistry.getProjectCount()).to.equal(1);
    const proj = await projectRegistry.getProject(1);
    expect(proj.status).to.equal(0); // Pending
  });

  it("Step 3: Auditor reviews and verifies project with 200,000 tonnes cap", async function () {
    await projectRegistry.connect(auditor).startReview(1);
    expect((await projectRegistry.getProject(1)).status).to.equal(1); // UnderReview

    await projectRegistry
      .connect(auditor)
      .verifyProject(1, "ipfs://QmValidationReportVCS1122", PROJECT_CAP, "Compliant with VCS Standard v4.4");

    expect(await projectRegistry.isProjectActive(1)).to.be.true;
    expect((await projectRegistry.getProject(1)).status).to.equal(2); // Verified
  });

  it("Step 4: Issuer issues Batch 1 (2023 vintage) and Batch 2 (2024 vintage)", async function () {
    // Batch 1: 50,000 tonnes
    await creditRegistry.issueBatch(
      1,
      2023,
      BATCH1_QTY,
      "VCS-1122-2023-000001",
      "VCS-1122-2023-050000",
      "ipfs://QmIssuanceReport2023",
      developer.address
    );

    // Batch 2: 80,000 tonnes
    await creditRegistry.issueBatch(
      1,
      2024,
      BATCH2_QTY,
      "VCS-1122-2024-000001",
      "VCS-1122-2024-080000",
      "ipfs://QmIssuanceReport2024",
      developer.address
    );

    expect(await creditRegistry.batchCount()).to.equal(2);
    expect(await creditRegistry.totalIssuedPerProject(1)).to.equal(BATCH1_QTY + BATCH2_QTY);
    expect(await creditRegistry.balanceOf(developer.address, 1)).to.equal(BATCH1_QTY);
    expect(await creditRegistry.balanceOf(developer.address, 2)).to.equal(BATCH2_QTY);
  });

  it("Step 5: Anti-double-issuance prevents exceeding verified cap", async function () {
    // Current total = 130,000. Cap = 200,000. Trying to issue 70,001 tonnes reverts
    await expect(
      creditRegistry.issueBatch(
        1,
        2024,
        ethers.parseEther("70001"),
        "VCS-1122-2024-080001",
        "VCS-1122-2024-150001",
        "ipfs://QmProofOverflow",
        developer.address
      )
    ).to.be.revertedWithCustomError(creditRegistry, "IssuanceExceedsCap");
  });

  it("Step 6: Developer lists 10,000 tonnes of Batch 1 on Marketplace for USDC", async function () {
    await creditRegistry
      .connect(developer)
      .setApprovalForAll(await marketplace.getAddress(), true);

    const listQty = ethers.parseEther("10000");
    const pricePerUnit = ethers.parseEther("12"); // 12 USDC per tonne

    await marketplace
      .connect(developer)
      .createListing(1, listQty, pricePerUnit, await mockUsdc.getAddress());

    expect(await marketplace.listingCount()).to.equal(1);
    expect(await creditRegistry.balanceOf(await marketplace.getAddress(), 1)).to.equal(listQty);
  });

  it("Step 7: Corporate buyer purchases 6,000 tonnes (partial fill)", async function () {
    await mockUsdc
      .connect(corporateBuyer)
      .approve(await marketplace.getAddress(), ethers.MaxUint256);

    const buyQty = ethers.parseEther("6000"); // 6,000 tonnes * 12 USDC = 72,000 USDC
    await marketplace.connect(corporateBuyer).buyListing(1, buyQty);

    expect(await creditRegistry.balanceOf(corporateBuyer.address, 1)).to.equal(buyQty);

    const listing = await marketplace.getListing(1);
    expect(listing.quantity).to.equal(ethers.parseEther("4000")); // 4,000 remaining
    expect(listing.active).to.be.true;
  });

  it("Step 8: Corporate buyer permanently retires 4,000 tonnes with certificate", async function () {
    const retireQty = ethers.parseEther("4000");
    const beneficiary = "MegaCorp Logistics North America";
    const reason = "Scope 1 Trucking Fleet Net-Zero Offset 2024";
    const externalRef = "https://registry.verra.org/retirements/VCS-RET-99381";

    const tx = await retirementManager
      .connect(corporateBuyer)
      .retireCredits(1, retireQty, beneficiary, reason, externalRef);
    await tx.wait();

    expect(await retirementManager.totalRetirements()).to.equal(1);
    expect(await creditRegistry.balanceOf(corporateBuyer.address, 1)).to.equal(
      ethers.parseEther("2000") // 6,000 - 4,000 = 2,000 remaining
    );
    expect(await creditRegistry.totalRetiredPerBatch(1)).to.equal(retireQty);

    const cert = await retirementManager.getCertificate(1);
    expect(cert.beneficiaryName).to.equal(beneficiary);
    expect(cert.amount).to.equal(retireQty);
    expect(cert.certificateHash).to.not.equal(ethers.ZeroHash);
  });

  it("Step 9: Suspended project blocks remaining transfers and marketplace purchases", async function () {
    // Auditor flags an issue and suspends project
    await projectRegistry.connect(auditor).suspendProject(1, "Satellite imagery inquiry");
    expect(await projectRegistry.isProjectActive(1)).to.be.false;

    // Corporate buyer cannot transfer their remaining 2,000 tonnes
    await expect(
      creditRegistry
        .connect(corporateBuyer)
        .safeTransferFrom(
          corporateBuyer.address,
          investor.address,
          1,
          ethers.parseEther("1000"),
          "0x"
        )
    ).to.be.revertedWithCustomError(creditRegistry, "ProjectSuspendedOrInactive");

    // Attempting to buy remaining listed credits is also blocked
    await expect(
      marketplace.connect(corporateBuyer).buyListing(1, ethers.parseEther("1000"))
    ).to.be.revertedWithCustomError(marketplace, "ProjectSuspendedOrInactive");

    // Dispute resolved -> Auditor unsuspends project
    await projectRegistry.connect(auditor).unsuspendProject(1, "Canopy cover confirmed intact");
    expect(await projectRegistry.isProjectActive(1)).to.be.true;

    // Transfer succeeds now
    await expect(
      creditRegistry
        .connect(corporateBuyer)
        .safeTransferFrom(
          corporateBuyer.address,
          investor.address,
          1,
          ethers.parseEther("1000"),
          "0x"
        )
    ).to.not.be.reverted;

    expect(await creditRegistry.balanceOf(investor.address, 1)).to.equal(ethers.parseEther("1000"));
  });
});
