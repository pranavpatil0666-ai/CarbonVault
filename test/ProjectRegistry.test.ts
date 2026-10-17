import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { VerifierRegistry, ProjectRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ProjectRegistry", function () {
  let verifierRegistry: VerifierRegistry;
  let projectRegistry: ProjectRegistry;
  let admin: SignerWithAddress;
  let verifier: SignerWithAddress;
  let developer: SignerWithAddress;
  let outsider: SignerWithAddress;

  beforeEach(async function () {
    [admin, verifier, developer, outsider] = await ethers.getSigners();

    const VerifierRegistryFactory = await ethers.getContractFactory("VerifierRegistry");
    verifierRegistry = await VerifierRegistryFactory.deploy(admin.address);
    await verifierRegistry.waitForDeployment();

    // Authorize verifier in VerifierRegistry
    await verifierRegistry.addVerifier(
      verifier.address,
      "DNV Climate Solutions",
      "DOE-0044",
      "ipfs://QmDnvAccreditation"
    );

    const ProjectRegistryFactory = await ethers.getContractFactory("ProjectRegistry");
    projectRegistry = await ProjectRegistryFactory.deploy(
      admin.address,
      await verifierRegistry.getAddress()
    );
    await projectRegistry.waitForDeployment();
  });

  describe("Project Registration", function () {
    it("should allow a developer to register a project with status Pending", async function () {
      await expect(
        projectRegistry.connect(developer).registerProject(
          "Amazon REDD+ Conservation",
          "VM0007",
          "Brazil",
          2020,
          2030,
          "Verra VCS",
          "VCS-1748",
          "ipfs://QmProjectDesignDocument"
        )
      )
        .to.emit(projectRegistry, "ProjectRegistered")
        .withArgs(
          1,
          developer.address,
          "Amazon REDD+ Conservation",
          "Verra VCS",
          "VCS-1748",
          "ipfs://QmProjectDesignDocument",
          anyValue
        );

      expect(await projectRegistry.getProjectCount()).to.equal(1);
      const project = await projectRegistry.getProject(1);
      expect(project.name).to.equal("Amazon REDD+ Conservation");
      expect(project.developer).to.equal(developer.address);
      expect(project.methodology).to.equal("VM0007");
      expect(project.status).to.equal(0); // Pending
      expect(await projectRegistry.isProjectActive(1)).to.be.false;

      const devProjects = await projectRegistry.getProjectsByDeveloper(developer.address);
      expect(devProjects.length).to.equal(1);
      expect(devProjects[0]).to.equal(1);
    });

    it("should prevent duplicate registration of the same (externalRegistry, externalProjectId)", async function () {
      await projectRegistry.connect(developer).registerProject(
        "Project 1",
        "VM0007",
        "Brazil",
        2020,
        2030,
        "Verra VCS",
        "VCS-1748",
        "ipfs://PDD1"
      );

      await expect(
        projectRegistry.connect(outsider).registerProject(
          "Imposter Project",
          "VM0007",
          "Brazil",
          2020,
          2030,
          "Verra VCS",
          "VCS-1748",
          "ipfs://PDD2"
        )
      ).to.be.revertedWithCustomError(projectRegistry, "DuplicateExternalProject");
    });

    it("should reject invalid vintage range", async function () {
      await expect(
        projectRegistry.connect(developer).registerProject(
          "Invalid Vintages",
          "VM0007",
          "Brazil",
          2030,
          2020, // start > end
          "Verra VCS",
          "VCS-9999",
          "ipfs://PDD"
        )
      ).to.be.revertedWithCustomError(projectRegistry, "InvalidVintageRange");
    });

    it("should reject empty strings", async function () {
      await expect(
        projectRegistry.connect(developer).registerProject(
          "",
          "VM0007",
          "Brazil",
          2020,
          2030,
          "Verra VCS",
          "VCS-9999",
          "ipfs://PDD"
        )
      ).to.be.revertedWithCustomError(projectRegistry, "EmptyString");
    });
  });

  describe("Review & Verification Lifecycle", function () {
    beforeEach(async function () {
      await projectRegistry.connect(developer).registerProject(
        "Amazon REDD+ Conservation",
        "VM0007",
        "Brazil",
        2020,
        2030,
        "Verra VCS",
        "VCS-1748",
        "ipfs://PDD"
      );
    });

    it("should allow an authorized verifier to start review", async function () {
      await expect(projectRegistry.connect(verifier).startReview(1))
        .to.emit(projectRegistry, "ProjectUnderReview")
        .withArgs(1, verifier.address, anyValue);

      const project = await projectRegistry.getProject(1);
      expect(project.status).to.equal(1); // UnderReview
    });

    it("should prevent unauthorized accounts from starting review", async function () {
      await expect(
        projectRegistry.connect(outsider).startReview(1)
      ).to.be.revertedWithCustomError(projectRegistry, "UnauthorizedVerifier");
    });

    it("should allow authorized verifier to verify project with approved tonnes cap", async function () {
      await projectRegistry.connect(verifier).startReview(1);

      const maxTonnes = ethers.parseEther("50000"); // 50,000 tonnes
      await expect(
        projectRegistry
          .connect(verifier)
          .verifyProject(1, "ipfs://QmVAlidationReport", maxTonnes, "Verified according to ISO 14064-3")
      )
        .to.emit(projectRegistry, "ProjectVerified")
        .withArgs(
          1,
          verifier.address,
          "ipfs://QmVAlidationReport",
          maxTonnes,
          anyValue
        );

      const project = await projectRegistry.getProject(1);
      expect(project.status).to.equal(2); // Verified
      expect(await projectRegistry.isProjectActive(1)).to.be.true;

      const verification = await projectRegistry.getVerification(1);
      expect(verification.verifier).to.equal(verifier.address);
      expect(verification.estimatedMaxTonnes).to.equal(maxTonnes);
      expect(verification.reportHash).to.equal("ipfs://QmVAlidationReport");
    });

    it("should reject verification with zero max tonnes", async function () {
      await projectRegistry.connect(verifier).startReview(1);

      await expect(
        projectRegistry
          .connect(verifier)
          .verifyProject(1, "ipfs://Report", 0, "Zero cap not allowed")
      ).to.be.revertedWithCustomError(projectRegistry, "ZeroEstimatedTonnes");
    });

    it("should allow verifier to reject a project", async function () {
      await projectRegistry.connect(verifier).startReview(1);

      await expect(
        projectRegistry
          .connect(verifier)
          .rejectProject(1, "ipfs://QmNegativeAudit", "Baseline inflation detected")
      )
        .to.emit(projectRegistry, "ProjectRejected")
        .withArgs(
          1,
          verifier.address,
          "ipfs://QmNegativeAudit",
          "Baseline inflation detected",
          anyValue
        );

      const project = await projectRegistry.getProject(1);
      expect(project.status).to.equal(3); // Rejected
      expect(await projectRegistry.isProjectActive(1)).to.be.false;
    });
  });

  describe("Suspension & Unsuspension", function () {
    beforeEach(async function () {
      await projectRegistry.connect(developer).registerProject(
        "Amazon REDD+",
        "VM0007",
        "Brazil",
        2020,
        2030,
        "Verra VCS",
        "VCS-1748",
        "ipfs://PDD"
      );
      await projectRegistry.connect(verifier).startReview(1);
      await projectRegistry
        .connect(verifier)
        .verifyProject(1, "ipfs://Report", ethers.parseEther("100000"), "Audit passed");
    });

    it("should allow verifier or admin to suspend a verified project", async function () {
      await expect(
        projectRegistry.connect(verifier).suspendProject(1, "Inquiry into land tenure dispute")
      )
        .to.emit(projectRegistry, "ProjectSuspended")
        .withArgs(1, verifier.address, "Inquiry into land tenure dispute", anyValue);

      expect(await projectRegistry.isProjectActive(1)).to.be.false;
      const project = await projectRegistry.getProject(1);
      expect(project.status).to.equal(4); // Suspended
    });

    it("should allow unsuspend back to verified status", async function () {
      await projectRegistry.connect(verifier).suspendProject(1, "Dispute pending");
      expect(await projectRegistry.isProjectActive(1)).to.be.false;

      await expect(
        projectRegistry.connect(admin).unsuspendProject(1, "Dispute resolved with registry")
      )
        .to.emit(projectRegistry, "ProjectUnsuspended")
        .withArgs(1, admin.address, "Dispute resolved with registry", anyValue);

      expect(await projectRegistry.isProjectActive(1)).to.be.true;
      const project = await projectRegistry.getProject(1);
      expect(project.status).to.equal(2); // Verified
    });

    it("should reject unauthorized callers from suspending", async function () {
      await expect(
        projectRegistry.connect(outsider).suspendProject(1, "Malicious attempt")
      ).to.be.revertedWithCustomError(projectRegistry, "UnauthorizedVerifier");
    });

    it("should allow admin to pause and unpause", async function () {
      await projectRegistry.connect(admin).pause();
      await expect(
        projectRegistry.connect(developer).registerProject(
          "Paused Project",
          "VM0007",
          "Brazil",
          2020,
          2030,
          "Gold Standard",
          "GS-8888",
          "ipfs://PDD"
        )
      ).to.be.revertedWithCustomError(projectRegistry, "EnforcedPause");

      await projectRegistry.connect(admin).unpause();
      await expect(
        projectRegistry.connect(developer).registerProject(
          "Unpaused Project",
          "VM0007",
          "Brazil",
          2020,
          2030,
          "Gold Standard",
          "GS-8888",
          "ipfs://PDD"
        )
      ).to.not.be.reverted;
    });

    it("should reject query for non-existent project", async function () {
      await expect(projectRegistry.getProject(999)).to.be.revertedWithCustomError(
        projectRegistry,
        "ProjectNotFound"
      );
    });
  });
});
