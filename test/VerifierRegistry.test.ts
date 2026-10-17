import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { VerifierRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("VerifierRegistry", function () {
  let verifierRegistry: VerifierRegistry;
  let admin: SignerWithAddress;
  let verifier1: SignerWithAddress;
  let verifier2: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async function () {
    [admin, verifier1, verifier2, user] = await ethers.getSigners();

    const VerifierRegistryFactory = await ethers.getContractFactory("VerifierRegistry");
    verifierRegistry = await VerifierRegistryFactory.deploy(admin.address);
    await verifierRegistry.waitForDeployment();
  });

  describe("Deployment & Roles", function () {
    it("should set deployer as admin and verifier admin", async function () {
      const DEFAULT_ADMIN_ROLE = await verifierRegistry.DEFAULT_ADMIN_ROLE();
      const VERIFIER_ADMIN_ROLE = await verifierRegistry.VERIFIER_ADMIN_ROLE();

      expect(await verifierRegistry.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await verifierRegistry.hasRole(VERIFIER_ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("should reject zero address admin at deployment", async function () {
      const VerifierRegistryFactory = await ethers.getContractFactory("VerifierRegistry");
      await expect(
        VerifierRegistryFactory.deploy(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(verifierRegistry, "InvalidAddress");
    });
  });

  describe("addVerifier", function () {
    it("should allow admin to add an authorized verifier", async function () {
      await expect(
        verifierRegistry.addVerifier(
          verifier1.address,
          "SGS Climate Solutions",
          "UNFCCC-DOE-0012",
          "ipfs://QmSgsAccreditationProof"
        )
      )
        .to.emit(verifierRegistry, "VerifierAdded")
        .withArgs(
          verifier1.address,
          "SGS Climate Solutions",
          "UNFCCC-DOE-0012",
          "ipfs://QmSgsAccreditationProof",
          anyValue
        );

      expect(await verifierRegistry.isVerifier(verifier1.address)).to.be.true;
      const v = await verifierRegistry.getVerifier(verifier1.address);
      expect(v.name).to.equal("SGS Climate Solutions");
      expect(v.accreditationRef).to.equal("UNFCCC-DOE-0012");
      expect(v.metadataURI).to.equal("ipfs://QmSgsAccreditationProof");
      expect(v.active).to.be.true;
      expect(await verifierRegistry.getVerifierCount()).to.equal(1);
      expect(await verifierRegistry.getVerifierAddressAt(0)).to.equal(verifier1.address);
    });

    it("should reject adding existing verifier", async function () {
      await verifierRegistry.addVerifier(
        verifier1.address,
        "SGS Climate",
        "DOE-0012",
        "ipfs://proof"
      );

      await expect(
        verifierRegistry.addVerifier(
          verifier1.address,
          "Duplicate SGS",
          "DOE-0012",
          "ipfs://proof2"
        )
      ).to.be.revertedWithCustomError(verifierRegistry, "VerifierAlreadyExists");
    });

    it("should reject invalid inputs", async function () {
      await expect(
        verifierRegistry.addVerifier(ethers.ZeroAddress, "Name", "Ref", "uri")
      ).to.be.revertedWithCustomError(verifierRegistry, "InvalidAddress");

      await expect(
        verifierRegistry.addVerifier(verifier1.address, "", "Ref", "uri")
      ).to.be.revertedWithCustomError(verifierRegistry, "EmptyString");

      await expect(
        verifierRegistry.addVerifier(verifier1.address, "Name", "", "uri")
      ).to.be.revertedWithCustomError(verifierRegistry, "EmptyString");
    });

    it("should prevent non-admin from adding verifier", async function () {
      await expect(
        verifierRegistry
          .connect(user)
          .addVerifier(verifier1.address, "Name", "Ref", "uri")
      ).to.be.revertedWithCustomError(verifierRegistry, "AccessControlUnauthorizedAccount");
    });
  });

  describe("updateVerifier", function () {
    beforeEach(async function () {
      await verifierRegistry.addVerifier(
        verifier1.address,
        "SGS Climate",
        "DOE-0012",
        "ipfs://proof1"
      );
    });

    it("should allow admin to update active status and metadata URI", async function () {
      await expect(
        verifierRegistry.updateVerifier(verifier1.address, false, "ipfs://proof2")
      ).to.emit(verifierRegistry, "VerifierUpdated");

      expect(await verifierRegistry.isVerifier(verifier1.address)).to.be.false;
      const v = await verifierRegistry.getVerifier(verifier1.address);
      expect(v.active).to.be.false;
      expect(v.metadataURI).to.equal("ipfs://proof2");
    });

    it("should revert if updating non-existent verifier", async function () {
      await expect(
        verifierRegistry.updateVerifier(verifier2.address, false, "ipfs://proof")
      ).to.be.revertedWithCustomError(verifierRegistry, "VerifierNotFound");
    });
  });

  describe("removeVerifier", function () {
    beforeEach(async function () {
      await verifierRegistry.addVerifier(
        verifier1.address,
        "SGS Climate",
        "DOE-0012",
        "ipfs://proof1"
      );
    });

    it("should allow admin to remove a verifier", async function () {
      await expect(verifierRegistry.removeVerifier(verifier1.address))
        .to.emit(verifierRegistry, "VerifierRemoved")
        .withArgs(verifier1.address, anyValue);

      expect(await verifierRegistry.isVerifier(verifier1.address)).to.be.false;
      await expect(
        verifierRegistry.getVerifier(verifier1.address)
      ).to.be.revertedWithCustomError(verifierRegistry, "VerifierNotFound");
    });

    it("should revert if removing non-existent verifier", async function () {
      await expect(
        verifierRegistry.removeVerifier(verifier2.address)
      ).to.be.revertedWithCustomError(verifierRegistry, "VerifierNotFound");
    });
  });

  describe("Pausable", function () {
    it("should pause and unpause correctly by admin", async function () {
      await verifierRegistry.pause();
      await expect(
        verifierRegistry.addVerifier(verifier1.address, "Name", "Ref", "uri")
      ).to.be.revertedWithCustomError(verifierRegistry, "EnforcedPause");

      await verifierRegistry.unpause();
      await expect(
        verifierRegistry.addVerifier(verifier1.address, "Name", "Ref", "uri")
      ).to.not.be.reverted;
    });

    it("should prevent non-admin from pausing", async function () {
      await expect(
        verifierRegistry.connect(user).pause()
      ).to.be.revertedWithCustomError(verifierRegistry, "AccessControlUnauthorizedAccount");
    });
  });
});
