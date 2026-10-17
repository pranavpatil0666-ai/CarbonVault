import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { VerifierRegistry, ProjectRegistry, CreditRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CreditRegistry", function () {
  let verifierRegistry: VerifierRegistry;
  let projectRegistry: ProjectRegistry;
  let creditRegistry: CreditRegistry;

  let admin: SignerWithAddress;
  let verifier: SignerWithAddress;
  let developer: SignerWithAddress;
  let buyer: SignerWithAddress;
  let retirementManager: SignerWithAddress;

  const MAX_TONNES = ethers.parseEther("100000"); // 100,000 tonnes cap

  beforeEach(async function () {
    [admin, verifier, developer, buyer, retirementManager] = await ethers.getSigners();

    // 1. Deploy VerifierRegistry
    const VerifierRegistryFactory = await ethers.getContractFactory("VerifierRegistry");
    verifierRegistry = await VerifierRegistryFactory.deploy(admin.address);
    await verifierRegistry.waitForDeployment();

    await verifierRegistry.addVerifier(
      verifier.address,
      "TUV SUD Climate",
      "DOE-0021",
      "ipfs://QmTUVSUD"
    );

    // 2. Deploy ProjectRegistry
    const ProjectRegistryFactory = await ethers.getContractFactory("ProjectRegistry");
    projectRegistry = await ProjectRegistryFactory.deploy(
      admin.address,
      await verifierRegistry.getAddress()
    );
    await projectRegistry.waitForDeployment();

    // 3. Register & Verify Project 1
    await projectRegistry.connect(developer).registerProject(
      "Cordillera Azul National Park REDD+",
      "VM0007",
      "Peru",
      2021,
      2025,
      "Verra VCS",
      "VCS-985",
      "ipfs://QmCordilleraPDD"
    );
    await projectRegistry.connect(verifier).startReview(1);
    await projectRegistry
      .connect(verifier)
      .verifyProject(1, "ipfs://QmValidationReport", MAX_TONNES, "Approved 100k cap");

    // 4. Deploy CreditRegistry
    const CreditRegistryFactory = await ethers.getContractFactory("CreditRegistry");
    creditRegistry = await CreditRegistryFactory.deploy(
      admin.address,
      await projectRegistry.getAddress(),
      "https://api.carbonvault.io/metadata/{id}.json"
    );
    await creditRegistry.waitForDeployment();

    // Grant retirement role to mock retirementManager
    const RETIREMENT_ROLE = await creditRegistry.RETIREMENT_ROLE();
    await creditRegistry.grantRole(RETIREMENT_ROLE, retirementManager.address);
  });

  describe("Batch Issuance", function () {
    it("should issue batch for verified project and track cumulative issuance", async function () {
      const quantity = ethers.parseEther("40000"); // 40,000 tonnes
      await expect(
        creditRegistry.issueBatch(
          1,
          2022,
          quantity,
          "VCS-985-2022-000001",
          "VCS-985-2022-040000",
          "ipfs://QmIssuanceProof1",
          developer.address
        )
      )
        .to.emit(creditRegistry, "BatchIssued")
        .withArgs(
          1,
          1,
          2022,
          quantity,
          "VCS-985-2022-000001",
          "VCS-985-2022-040000",
          developer.address,
          anyValue
        );

      expect(await creditRegistry.batchCount()).to.equal(1);
      expect(await creditRegistry.balanceOf(developer.address, 1)).to.equal(quantity);
      expect(await creditRegistry.totalIssuedPerProject(1)).to.equal(quantity);

      const batch = await creditRegistry.getBatch(1);
      expect(batch.projectId).to.equal(1);
      expect(batch.vintage).to.equal(2022);
      expect(batch.quantityIssued).to.equal(quantity);
    });

    it("should enforce anti-double-issuance cap", async function () {
      // Issue 70,000 tonnes out of 100,000 cap
      await creditRegistry.issueBatch(
        1,
        2022,
        ethers.parseEther("70000"),
        "VCS-985-2022-000001",
        "VCS-985-2022-070000",
        "ipfs://QmProof1",
        developer.address
      );

      // Attempt to issue 35,000 tonnes (70k + 35k = 105k > 100k cap) -> REVERT
      await expect(
        creditRegistry.issueBatch(
          1,
          2023,
          ethers.parseEther("35000"),
          "VCS-985-2023-000001",
          "VCS-985-2023-035000",
          "ipfs://QmProof2",
          developer.address
        )
      ).to.be.revertedWithCustomError(creditRegistry, "IssuanceExceedsCap");

      // Issuing 30,000 tonnes (70k + 30k = 100k exact cap) -> SUCCEED
      await expect(
        creditRegistry.issueBatch(
          1,
          2023,
          ethers.parseEther("30000"),
          "VCS-985-2023-000001",
          "VCS-985-2023-030000",
          "ipfs://QmProof3",
          developer.address
        )
      ).to.not.be.reverted;

      expect(await creditRegistry.totalIssuedPerProject(1)).to.equal(MAX_TONNES);
    });

    it("should prevent duplicate external serial ranges", async function () {
      await creditRegistry.issueBatch(
        1,
        2022,
        ethers.parseEther("10000"),
        "VCS-985-2022-000001",
        "VCS-985-2022-010000",
        "ipfs://QmProof1",
        developer.address
      );

      // Attempting to reuse the exact same serial range
      await expect(
        creditRegistry.issueBatch(
          1,
          2022,
          ethers.parseEther("10000"),
          "VCS-985-2022-000001",
          "VCS-985-2022-010000",
          "ipfs://QmProof2",
          developer.address
        )
      ).to.be.revertedWithCustomError(creditRegistry, "SerialRangeAlreadyIssued");
    });

    it("should reject issuance if vintage is out of project range", async function () {
      await expect(
        creditRegistry.issueBatch(
          1,
          2019, // project range is 2021 - 2025
          ethers.parseEther("5000"),
          "VCS-985-2019-000001",
          "VCS-985-2019-005000",
          "ipfs://QmProof",
          developer.address
        )
      ).to.be.revertedWithCustomError(creditRegistry, "VintageOutOfRange");
    });

    it("should reject issuance if caller lacks ISSUER_ROLE", async function () {
      await expect(
        creditRegistry
          .connect(developer)
          .issueBatch(
            1,
            2022,
            ethers.parseEther("5000"),
            "VCS-985-2022-000001",
            "VCS-985-2022-005000",
            "ipfs://QmProof",
            developer.address
          )
      ).to.be.revertedWithCustomError(creditRegistry, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Transfers & Suspension Hook", function () {
    const batchQty = ethers.parseEther("20000");

    beforeEach(async function () {
      await creditRegistry.issueBatch(
        1,
        2022,
        batchQty,
        "VCS-985-2022-000001",
        "VCS-985-2022-020000",
        "ipfs://QmProof",
        developer.address
      );
    });

    it("should allow normal transfer when project is Verified", async function () {
      const transferAmount = ethers.parseEther("5000");
      await creditRegistry
        .connect(developer)
        .safeTransferFrom(developer.address, buyer.address, 1, transferAmount, "0x");

      expect(await creditRegistry.balanceOf(buyer.address, 1)).to.equal(transferAmount);
      expect(await creditRegistry.balanceOf(developer.address, 1)).to.equal(batchQty - transferAmount);
    });

    it("should block transfers when project is Suspended", async function () {
      // Suspend project in ProjectRegistry
      await projectRegistry.connect(verifier).suspendProject(1, "Audit dispute");

      const transferAmount = ethers.parseEther("5000");
      await expect(
        creditRegistry
          .connect(developer)
          .safeTransferFrom(developer.address, buyer.address, 1, transferAmount, "0x")
      ).to.be.revertedWithCustomError(creditRegistry, "ProjectSuspendedOrInactive");

      // Unsuspend project
      await projectRegistry.connect(verifier).unsuspendProject(1, "Dispute cleared");

      // Transfer succeeds now
      await expect(
        creditRegistry
          .connect(developer)
          .safeTransferFrom(developer.address, buyer.address, 1, transferAmount, "0x")
      ).to.not.be.reverted;
    });
  });

  describe("Retirement & Permanent Burning", function () {
    const batchQty = ethers.parseEther("20000");

    beforeEach(async function () {
      await creditRegistry.issueBatch(
        1,
        2022,
        batchQty,
        "VCS-985-2022-000001",
        "VCS-985-2022-020000",
        "ipfs://QmProof",
        developer.address
      );
    });

    it("should allow authorized RETIREMENT_ROLE to retire and burn credits", async function () {
      const retireAmount = ethers.parseEther("8000");

      await expect(
        creditRegistry.connect(retirementManager).retire(developer.address, 1, retireAmount)
      )
        .to.emit(creditRegistry, "CreditsBurnedForRetirement")
        .withArgs(1, developer.address, retireAmount, anyValue);

      expect(await creditRegistry.balanceOf(developer.address, 1)).to.equal(batchQty - retireAmount);
      expect(await creditRegistry.totalRetiredPerBatch(1)).to.equal(retireAmount);
    });

    it("should reject retirement from unauthorized callers", async function () {
      await expect(
        creditRegistry.connect(buyer).retire(developer.address, 1, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(creditRegistry, "AccessControlUnauthorizedAccount");
    });

    it("should reject retirement if balance is insufficient", async function () {
      await expect(
        creditRegistry.connect(retirementManager).retire(developer.address, 1, ethers.parseEther("50000"))
      ).to.be.revertedWithCustomError(creditRegistry, "InsufficientBalance");
    });

    it("should block retirement if project is suspended", async function () {
      await projectRegistry.connect(verifier).suspendProject(1, "Audit review");

      await expect(
        creditRegistry.connect(retirementManager).retire(developer.address, 1, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(creditRegistry, "ProjectSuspendedOrInactive");
    });

    it("should support setURI, getBatchesByProject, and supportsInterface", async function () {
      await creditRegistry.connect(admin).setURI("https://new.carbonvault.io/{id}.json");
      expect(await creditRegistry.uri(1)).to.equal("https://new.carbonvault.io/{id}.json");

      const batches = await creditRegistry.getBatchesByProject(1);
      expect(batches.length).to.equal(1);
      expect(batches[0]).to.equal(1);

      // ERC1155 interface id
      expect(await creditRegistry.supportsInterface("0xd9b67a26")).to.be.true;
    });

    it("should allow admin to pause and unpause", async function () {
      await creditRegistry.connect(admin).pause();
      await expect(
        creditRegistry.issueBatch(
          1,
          2022,
          ethers.parseEther("1000"),
          "VCS-985-2022-090001",
          "VCS-985-2022-091000",
          "ipfs://QmProof",
          developer.address
        )
      ).to.be.revertedWithCustomError(creditRegistry, "EnforcedPause");

      await creditRegistry.connect(admin).unpause();
      await expect(
        creditRegistry.issueBatch(
          1,
          2022,
          ethers.parseEther("1000"),
          "VCS-985-2022-090001",
          "VCS-985-2022-091000",
          "ipfs://QmProof",
          developer.address
        )
      ).to.not.be.reverted;
    });
  });
});
