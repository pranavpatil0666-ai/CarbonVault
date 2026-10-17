import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import {
  VerifierRegistry,
  ProjectRegistry,
  CreditRegistry,
  Marketplace,
  MockERC20,
  MaliciousAttacker,
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Marketplace", function () {
  let verifierRegistry: VerifierRegistry;
  let projectRegistry: ProjectRegistry;
  let creditRegistry: CreditRegistry;
  let marketplace: Marketplace;
  let mockUsdc: MockERC20;
  let attacker: MaliciousAttacker;

  let admin: SignerWithAddress;
  let verifier: SignerWithAddress;
  let seller: SignerWithAddress;
  let buyer: SignerWithAddress;
  let feeTreasury: SignerWithAddress;

  const BATCH_QUANTITY = ethers.parseEther("10000"); // 10,000 tonnes
  const FEE_BPS = 250; // 2.5%

  beforeEach(async function () {
    [admin, verifier, seller, buyer, feeTreasury] = await ethers.getSigners();

    // 1. VerifierRegistry
    const VerifierRegistryFactory = await ethers.getContractFactory("VerifierRegistry");
    verifierRegistry = await VerifierRegistryFactory.deploy(admin.address);
    await verifierRegistry.waitForDeployment();

    await verifierRegistry.addVerifier(
      verifier.address,
      "Earthood Services",
      "DOE-0099",
      "ipfs://QmEarthood"
    );

    // 2. ProjectRegistry
    const ProjectRegistryFactory = await ethers.getContractFactory("ProjectRegistry");
    projectRegistry = await ProjectRegistryFactory.deploy(
      admin.address,
      await verifierRegistry.getAddress()
    );
    await projectRegistry.waitForDeployment();

    await projectRegistry.connect(seller).registerProject(
      "Mangrove Restoration Project",
      "VM0033",
      "Indonesia",
      2022,
      2030,
      "Verra VCS",
      "VCS-2390",
      "ipfs://QmMangrovePDD"
    );
    await projectRegistry.connect(verifier).startReview(1);
    await projectRegistry
      .connect(verifier)
      .verifyProject(1, "ipfs://QmReport", ethers.parseEther("50000"), "Audit approved");

    // 3. CreditRegistry
    const CreditRegistryFactory = await ethers.getContractFactory("CreditRegistry");
    creditRegistry = await CreditRegistryFactory.deploy(
      admin.address,
      await projectRegistry.getAddress(),
      "https://api.carbonvault.io/metadata/{id}.json"
    );
    await creditRegistry.waitForDeployment();

    // Issue Batch 1
    await creditRegistry.issueBatch(
      1,
      2023,
      BATCH_QUANTITY,
      "VCS-2390-2023-000001",
      "VCS-2390-2023-010000",
      "ipfs://QmProof",
      seller.address
    );

    // 4. Mock USDC
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    mockUsdc = await MockERC20Factory.deploy("USD Coin", "USDC", 18);
    await mockUsdc.waitForDeployment();

    // Mint USDC to buyer
    await mockUsdc.mint(buyer.address, ethers.parseEther("500000"));

    // 5. Marketplace
    const MarketplaceFactory = await ethers.getContractFactory("Marketplace");
    marketplace = await MarketplaceFactory.deploy(
      admin.address,
      await creditRegistry.getAddress(),
      await projectRegistry.getAddress(),
      FEE_BPS,
      feeTreasury.address
    );
    await marketplace.waitForDeployment();

    // Seller approves marketplace for all ERC-1155 tokens
    await creditRegistry
      .connect(seller)
      .setApprovalForAll(await marketplace.getAddress(), true);

    // 6. Deploy MaliciousAttacker
    const MaliciousAttackerFactory = await ethers.getContractFactory("MaliciousAttacker");
    attacker = await MaliciousAttackerFactory.deploy(await marketplace.getAddress());
    await attacker.waitForDeployment();
  });

  describe("Listing Creation & Escrow", function () {
    it("should create an active listing and escrow credits into Marketplace contract", async function () {
      const listQuantity = ethers.parseEther("5000");
      const pricePerUnit = ethers.parseEther("0.02"); // 0.02 ETH per tonne

      await expect(
        marketplace
          .connect(seller)
          .createListing(1, listQuantity, pricePerUnit, ethers.ZeroAddress)
      )
        .to.emit(marketplace, "ListingCreated")
        .withArgs(
          1,
          seller.address,
          1,
          listQuantity,
          pricePerUnit,
          ethers.ZeroAddress,
          anyValue
        );

      expect(await marketplace.listingCount()).to.equal(1);
      const listing = await marketplace.getListing(1);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.quantity).to.equal(listQuantity);
      expect(listing.active).to.be.true;

      // Check tokens are locked in marketplace escrow
      expect(await creditRegistry.balanceOf(await marketplace.getAddress(), 1)).to.equal(listQuantity);
      expect(await creditRegistry.balanceOf(seller.address, 1)).to.equal(BATCH_QUANTITY - listQuantity);
    });

    it("should prevent listing if project is suspended", async function () {
      await projectRegistry.connect(verifier).suspendProject(1, "Investigation ongoing");

      await expect(
        marketplace
          .connect(seller)
          .createListing(1, ethers.parseEther("1000"), ethers.parseEther("0.01"), ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(marketplace, "ProjectSuspendedOrInactive");
    });
  });

  describe("Purchasing with Native ETH", function () {
    const listQuantity = ethers.parseEther("1000"); // 1,000 tonnes
    const pricePerUnit = ethers.parseEther("0.05"); // 0.05 ETH per tonne

    beforeEach(async function () {
      await marketplace
        .connect(seller)
        .createListing(1, listQuantity, pricePerUnit, ethers.ZeroAddress);
    });

    it("should allow partial fill purchase with exact ETH and distribute fee correctly", async function () {
      const buyQuantity = ethers.parseEther("400"); // 400 tonnes
      // totalCost = (400 * 0.05) = 20 ETH
      const totalCost = ethers.parseEther("20");
      // fee = 20 * 250 / 10000 = 0.5 ETH
      const fee = ethers.parseEther("0.5");
      const sellerProceeds = ethers.parseEther("19.5");

      const sellerInitialEth = await ethers.provider.getBalance(seller.address);
      const treasuryInitialEth = await ethers.provider.getBalance(feeTreasury.address);

      await expect(
        marketplace.connect(buyer).buyListing(1, buyQuantity, { value: totalCost })
      )
        .to.emit(marketplace, "ListingFilled")
        .withArgs(
          1,
          buyer.address,
          buyQuantity,
          totalCost,
          fee,
          anyValue
        );

      // Verify tokens delivered
      expect(await creditRegistry.balanceOf(buyer.address, 1)).to.equal(buyQuantity);

      // Verify listing updated
      const listing = await marketplace.getListing(1);
      expect(listing.quantity).to.equal(listQuantity - buyQuantity);
      expect(listing.active).to.be.true;

      // Verify funds received
      expect(await ethers.provider.getBalance(seller.address)).to.equal(
        sellerInitialEth + sellerProceeds
      );
      expect(await ethers.provider.getBalance(feeTreasury.address)).to.equal(
        treasuryInitialEth + fee
      );
    });

    it("should refund excess ETH sent", async function () {
      const buyQuantity = ethers.parseEther("100"); // 100 tonnes -> 5 ETH
      const totalCost = ethers.parseEther("5");
      const excessEth = ethers.parseEther("3");

      const initialBuyerEth = await ethers.provider.getBalance(buyer.address);

      const tx = await marketplace
        .connect(buyer)
        .buyListing(1, buyQuantity, { value: totalCost + excessEth });
      const receipt = await tx.wait();
      const gasSpent = receipt!.gasUsed * receipt!.gasPrice;

      const finalBuyerEth = await ethers.provider.getBalance(buyer.address);
      // Net change should be -(totalCost + gasSpent)
      expect(initialBuyerEth - finalBuyerEth).to.be.closeTo(
        totalCost + gasSpent,
        ethers.parseEther("0.001")
      );
    });

    it("should revert if insufficient ETH is sent", async function () {
      const buyQuantity = ethers.parseEther("100");
      await expect(
        marketplace.connect(buyer).buyListing(1, buyQuantity, { value: ethers.parseEther("2") })
      ).to.be.revertedWithCustomError(marketplace, "InsufficientPayment");
    });
  });

  describe("Purchasing with ERC-20 (Mock USDC)", function () {
    const listQuantity = ethers.parseEther("2000");
    const pricePerUnit = ethers.parseEther("15"); // 15 USDC per tonne

    beforeEach(async function () {
      await marketplace
        .connect(seller)
        .createListing(1, listQuantity, pricePerUnit, await mockUsdc.getAddress());

      // Buyer approves marketplace to spend USDC
      await mockUsdc
        .connect(buyer)
        .approve(await marketplace.getAddress(), ethers.MaxUint256);
    });

    it("should purchase full fill with ERC-20 and close listing", async function () {
      // 2000 tonnes * 15 USDC = 30,000 USDC
      const totalCost = ethers.parseEther("30000");
      const fee = (totalCost * BigInt(FEE_BPS)) / 10000n; // 750 USDC
      const sellerProceeds = totalCost - fee;

      const initialSellerUsdc = await mockUsdc.balanceOf(seller.address);
      const initialTreasuryUsdc = await mockUsdc.balanceOf(feeTreasury.address);

      await marketplace.connect(buyer).buyListing(1, listQuantity);

      expect(await mockUsdc.balanceOf(seller.address)).to.equal(
        initialSellerUsdc + sellerProceeds
      );
      expect(await mockUsdc.balanceOf(feeTreasury.address)).to.equal(
        initialTreasuryUsdc + fee
      );
      expect(await creditRegistry.balanceOf(buyer.address, 1)).to.equal(listQuantity);

      const listing = await marketplace.getListing(1);
      expect(listing.quantity).to.equal(0);
      expect(listing.active).to.be.false;
    });

    it("should reject sending ETH for an ERC-20 listing", async function () {
      await expect(
        marketplace.connect(buyer).buyListing(1, ethers.parseEther("100"), {
          value: ethers.parseEther("1"),
        })
      ).to.be.revertedWithCustomError(marketplace, "NativeTokenNotAccepted");
    });
  });

  describe("Listing Management: Cancel & Update Price", function () {
    const listQuantity = ethers.parseEther("1000");
    const pricePerUnit = ethers.parseEther("0.05");

    beforeEach(async function () {
      await marketplace
        .connect(seller)
        .createListing(1, listQuantity, pricePerUnit, ethers.ZeroAddress);
    });

    it("should allow seller to cancel listing and return escrowed tokens", async function () {
      const initialSellerTokens = await creditRegistry.balanceOf(seller.address, 1);

      await expect(marketplace.connect(seller).cancelListing(1))
        .to.emit(marketplace, "ListingCancelled")
        .withArgs(1, seller.address, anyValue);

      const listing = await marketplace.getListing(1);
      expect(listing.active).to.be.false;
      expect(listing.quantity).to.equal(0);

      // Tokens returned to seller
      expect(await creditRegistry.balanceOf(seller.address, 1)).to.equal(
        initialSellerTokens + listQuantity
      );
    });

    it("should prevent non-seller from cancelling", async function () {
      await expect(
        marketplace.connect(buyer).cancelListing(1)
      ).to.be.revertedWithCustomError(marketplace, "UnauthorizedSeller");
    });

    it("should allow seller to update price", async function () {
      const newPrice = ethers.parseEther("0.08");
      await expect(marketplace.connect(seller).updateListingPrice(1, newPrice))
        .to.emit(marketplace, "ListingPriceUpdated")
        .withArgs(1, pricePerUnit, newPrice, anyValue);

      const listing = await marketplace.getListing(1);
      expect(listing.pricePerUnit).to.equal(newPrice);
    });
  });

  describe("Reentrancy Protection", function () {
    it("should block reentrancy attack on buyListing", async function () {
      const listQuantity = ethers.parseEther("1000");
      const pricePerUnit = ethers.parseEther("0.01");

      await marketplace
        .connect(seller)
        .createListing(1, listQuantity, pricePerUnit, ethers.ZeroAddress);

      // Set target on attacker contract
      const buyAmount = ethers.parseEther("100");
      const totalCost = ethers.parseEther("1"); // 100 * 0.01

      await attacker.setTarget(1, buyAmount);

      // Execute initial buy from attacker
      await attacker.initiateBuyAttack({ value: totalCost });

      // Verify that reentrancy was attempted and blocked
      expect(await attacker.attackTriggered()).to.be.true;
      expect(await attacker.reentrancyBlocked()).to.be.true;
      expect(await attacker.reentrancyCount()).to.equal(1);

      // Check that the reentrancy revert selector matches ReentrancyGuardReentrantCall
      const expectedErrorSelector = marketplace.interface.getError("ReentrancyGuardReentrantCall")!.selector;
      const actualRevertData = await attacker.reentrancyRevertData();
      expect(actualRevertData.slice(0, 10)).to.equal(expectedErrorSelector);
    });
  });

  describe("Fee Management", function () {
    it("should allow admin to update fee and recipient", async function () {
      await expect(marketplace.connect(admin).setFee(300, buyer.address))
        .to.emit(marketplace, "FeeUpdated")
        .withArgs(FEE_BPS, 300, feeTreasury.address, buyer.address);

      expect(await marketplace.feeBasisPoints()).to.equal(300);
      expect(await marketplace.feeRecipient()).to.equal(buyer.address);
    });

    it("should revert if fee exceeds 10% maximum", async function () {
      await expect(
        marketplace.connect(admin).setFee(1001, feeTreasury.address)
      ).to.be.revertedWithCustomError(marketplace, "FeeTooHigh");
    });

    it("should allow admin to pause and unpause", async function () {
      await marketplace.connect(admin).pause();
      await expect(
        marketplace.connect(seller).createListing(1, ethers.parseEther("100"), ethers.parseEther("1"), ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(marketplace, "EnforcedPause");

      await marketplace.connect(admin).unpause();
      await expect(
        marketplace.connect(seller).createListing(1, ethers.parseEther("100"), ethers.parseEther("1"), ethers.ZeroAddress)
      ).to.not.be.reverted;
    });

    it("should check supportsInterface", async function () {
      // AccessControl / ERC1155Holder interface
      expect(await marketplace.supportsInterface("0x7965db0b")).to.be.true;
    });
  });
});
