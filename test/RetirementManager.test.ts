import { expect } from "chai";
import { ethers } from "hardhat";
import {
  VerifierRegistry,
  ProjectRegistry,
  CreditRegistry,
  RetirementManager,
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("RetirementManager", function () {
  let verifierRegistry: VerifierRegistry;
  let projectRegistry: ProjectRegistry;
  let creditRegistry: CreditRegistry;
  let retirementManager: RetirementManager;

  let admin: SignerWithAddress;
  let verifier: SignerWithAddress;
  let developer: SignerWithAddress;
  let retiree: SignerWithAddress;
  let broker: SignerWithAddress;

  const BATCH_QUANTITY = ethers.parseEther("10000");

  beforeEach(async function () {
    [admin, verifier, developer, retiree, broker] = await ethers.getSigners();

    // 1. VerifierRegistry
    const VerifierRegistryFactory = await ethers.getContractFactory("VerifierRegistry");
    verifierRegistry = await VerifierRegistryFactory.deploy(admin.address);
    await verifierRegistry.waitForDeployment();

    await verifierRegistry.addVerifier(
      verifier.address,
      "Bureau Veritas",
      "DOE-0077",
      "ipfs://QmBureauVeritas"
    );

    // 2. ProjectRegistry
    const ProjectRegistryFactory = await ethers.getContractFactory("ProjectRegistry");
    projectRegistry = await ProjectRegistryFactory.deploy(
      admin.address,
      await verifierRegistry.getAddress()
    );
    await projectRegistry.waitForDeployment();

    await projectRegistry.connect(developer).registerProject(
      "Direct Air Carbon Capture Facility",
      "CDR001",
      "Iceland",
      2023,
      2033,
      "Gold Standard",
      "GS-5432",
      "ipfs://QmClimeworksPDD"
    );
    await projectRegistry.connect(verifier).startReview(1);
    await projectRegistry
      .connect(verifier)
      .verifyProject(1, "ipfs://QmAudit", ethers.parseEther("50000"), "Audit verified");

    // 3. CreditRegistry
    const CreditRegistryFactory = await ethers.getContractFactory("CreditRegistry");
    creditRegistry = await CreditRegistryFactory.deploy(
      admin.address,
      await projectRegistry.getAddress(),
      "https://api.carbonvault.io/metadata/{id}.json"
    );
    await creditRegistry.waitForDeployment();

    // Issue Batch 1 to retiree
    await creditRegistry.issueBatch(
      1,
      2023,
      BATCH_QUANTITY,
      "GS-5432-2023-000001",
      "GS-5432-2023-010000",
      "ipfs://QmProof",
      retiree.address
    );

    // 4. RetirementManager
    const RetirementManagerFactory = await ethers.getContractFactory("RetirementManager");
    retirementManager = await RetirementManagerFactory.deploy(
      admin.address,
      await creditRegistry.getAddress()
    );
    await retirementManager.waitForDeployment();

    // Grant RETIREMENT_ROLE on CreditRegistry to RetirementManager
    const RETIREMENT_ROLE = await creditRegistry.RETIREMENT_ROLE();
    await creditRegistry.grantRole(RETIREMENT_ROLE, await retirementManager.getAddress());
  });

  describe("Retirement & Certificate Generation", function () {
    it("should allow token holder to permanently retire credits and emit certificate details", async function () {
      const retireAmount = ethers.parseEther("2500"); // 2,500 tonnes
      const beneficiary = "Global Logistics Corp";
      const reason = "Scope 1 Fleet Emissions Neutralization 2024";
      const externalRef = "https://registry.goldstandard.org/retirements/GS-RET-88990";

      await expect(
        retirementManager
          .connect(retiree)
          .retireCredits(1, retireAmount, beneficiary, reason, externalRef)
      )
        .to.emit(retirementManager, "CreditsRetired");

      expect(await retirementManager.totalRetirements()).to.equal(1);

      // Verify tokens burned
      expect(await creditRegistry.balanceOf(retiree.address, 1)).to.equal(
        BATCH_QUANTITY - retireAmount
      );
      expect(await creditRegistry.totalRetiredPerBatch(1)).to.equal(retireAmount);

      // Verify certificate query
      const cert = await retirementManager.getCertificate(1);
      expect(cert.retirementId).to.equal(1);
      expect(cert.retiree).to.equal(retiree.address);
      expect(cert.beneficiaryName).to.equal(beneficiary);
      expect(cert.retirementReason).to.equal(reason);
      expect(cert.batchId).to.equal(1);
      expect(cert.amount).to.equal(retireAmount);
      expect(cert.externalRegistryRef).to.equal(externalRef);
      expect(cert.certificateHash).to.not.equal(ethers.ZeroHash);

      const retireeCerts = await retirementManager.getRetirementsByRetiree(retiree.address);
      expect(retireeCerts.length).to.equal(1);
      expect(retireeCerts[0]).to.equal(1);

      const batchCerts = await retirementManager.getRetirementsByBatch(1);
      expect(batchCerts.length).to.equal(1);
      expect(batchCerts[0]).to.equal(1);
    });

    it("should allow broker to retire credits on behalf of retiree with approval", async function () {
      const retireAmount = ethers.parseEther("1000");

      // Approve broker
      await creditRegistry
        .connect(retiree)
        .setApprovalForAll(broker.address, true);

      await expect(
        retirementManager
          .connect(broker)
          .retireCreditsFor(
            retiree.address,
            1,
            retireAmount,
            "Tech Startup Inc",
            "Data Center Carbon Offset",
            "GS-RET-99001"
          )
      ).to.not.be.reverted;

      expect(await creditRegistry.balanceOf(retiree.address, 1)).to.equal(
        BATCH_QUANTITY - retireAmount
      );
    });

    it("should revert if broker tries to retire without approval", async function () {
      await expect(
        retirementManager
          .connect(broker)
          .retireCreditsFor(
            retiree.address,
            1,
            ethers.parseEther("500"),
            "Beneficiary",
            "Reason",
            "Ref"
          )
      ).to.be.revertedWithCustomError(retirementManager, "UnauthorizedRetirement");
    });

    it("should revert if retiring zero amount", async function () {
      await expect(
        retirementManager
          .connect(retiree)
          .retireCredits(1, 0, "Beneficiary", "Reason", "Ref")
      ).to.be.revertedWithCustomError(retirementManager, "ZeroAmount");
    });

    it("should revert if beneficiary or reason is empty", async function () {
      await expect(
        retirementManager
          .connect(retiree)
          .retireCredits(1, ethers.parseEther("100"), "", "Reason", "Ref")
      ).to.be.revertedWithCustomError(retirementManager, "EmptyString");

      await expect(
        retirementManager
          .connect(retiree)
          .retireCredits(1, ethers.parseEther("100"), "Beneficiary", "", "Ref")
      ).to.be.revertedWithCustomError(retirementManager, "EmptyString");
    });

    it("should revert if project is suspended", async function () {
      await projectRegistry.connect(verifier).suspendProject(1, "DAC facility offline inquiry");

      await expect(
        retirementManager
          .connect(retiree)
          .retireCredits(1, ethers.parseEther("100"), "Beneficiary", "Reason", "Ref")
      ).to.be.revertedWithCustomError(creditRegistry, "ProjectSuspendedOrInactive");
    });

    it("should revert if certificate not found", async function () {
      await expect(retirementManager.getCertificate(999)).to.be.revertedWithCustomError(
        retirementManager,
        "CertificateNotFound"
      );
    });

    it("should allow admin to pause and unpause", async function () {
      await retirementManager.connect(admin).pause();
      await expect(
        retirementManager
          .connect(retiree)
          .retireCredits(1, ethers.parseEther("100"), "Beneficiary", "Reason", "Ref")
      ).to.be.revertedWithCustomError(retirementManager, "EnforcedPause");

      await retirementManager.connect(admin).unpause();
      await expect(
        retirementManager
          .connect(retiree)
          .retireCredits(1, ethers.parseEther("100"), "Beneficiary", "Reason", "Ref")
      ).to.not.be.reverted;
    });
  });
});
