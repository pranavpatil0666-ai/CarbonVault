// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IMarketplace.sol";
import "./interfaces/ICreditRegistry.sol";
import "./interfaces/IProjectRegistry.sol";

/**
 * @title Marketplace
 * @author CarbonVault Protocol
 * @notice Trustless escrow marketplace for verified carbon credit ERC-1155 tokens.
 * Supports native ETH and ERC-20 payment tokens, with partial fills and reentrancy protection.
 *
 * @dev CORE PRINCIPLE DISCLAIMER:
 * Trading on this marketplace represents the exchange of auditable claims anchored
 * to certified third-party registries. The marketplace verifies on-chain standing (e.g. not suspended)
 * but does not validate offline carbon metrics.
 */
contract Marketplace is AccessControl, Pausable, ReentrancyGuard, ERC1155Holder, IMarketplace {
    using SafeERC20 for IERC20;

    bytes32 public constant MARKETPLACE_ADMIN_ROLE = keccak256("MARKETPLACE_ADMIN_ROLE");

    uint256 public constant MAX_FEE_BPS = 1000; // 10.00% maximum platform fee
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant UNIT_SCALE = 1e18; // 1 tonne = 1e18 units

    ICreditRegistry public immutable creditRegistry;
    IProjectRegistry public immutable projectRegistry;

    uint256 public feeBasisPoints; // e.g., 100 = 1.00%
    address public feeRecipient;

    uint256 private _listingCount;
    mapping(uint256 => Listing) private _listings;

    // Custom Errors
    error InvalidAddress();
    error ZeroQuantity();
    error ZeroPrice();
    error FeeTooHigh(uint256 feeBps, uint256 maxBps);
    error ListingNotActive(uint256 listingId);
    error ListingNotFound(uint256 listingId);
    error UnauthorizedSeller(address caller);
    error InsufficientPayment(uint256 sent, uint256 required);
    error ExceedsAvailableQuantity(uint256 requested, uint256 available);
    error ProjectSuspendedOrInactive(uint256 projectId);
    error NativeTokenNotAccepted();
    error TransferFailed();

    /**
     * @notice Initializes the Marketplace contract.
     * @param admin Governance admin.
     * @param _creditRegistry Address of the CreditRegistry contract.
     * @param _projectRegistry Address of the ProjectRegistry contract.
     * @param _feeBasisPoints Platform fee in basis points (e.g. 100 = 1%).
     * @param _feeRecipient Treasury address receiving fees.
     */
    constructor(
        address admin,
        address _creditRegistry,
        address _projectRegistry,
        uint256 _feeBasisPoints,
        address _feeRecipient
    ) {
        if (admin == address(0) || _creditRegistry == address(0) || _projectRegistry == address(0)) {
            revert InvalidAddress();
        }
        if (_feeBasisPoints > MAX_FEE_BPS) revert FeeTooHigh(_feeBasisPoints, MAX_FEE_BPS);
        if (_feeRecipient == address(0) && _feeBasisPoints > 0) revert InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MARKETPLACE_ADMIN_ROLE, admin);

        creditRegistry = ICreditRegistry(_creditRegistry);
        projectRegistry = IProjectRegistry(_projectRegistry);
        feeBasisPoints = _feeBasisPoints;
        feeRecipient = _feeRecipient;
    }

    /**
     * @notice Creates a new listing by transferring tokens into escrow.
     * @param batchId ERC-1155 token ID of the credit batch.
     * @param quantity Amount of credits to list (in 1e18 units).
     * @param pricePerUnit Price in base units of paymentToken per 1 tonne (1e18 units).
     * @param paymentToken address(0) for native ETH, or ERC-20 contract address.
     * @return listingId Unique ID of created listing.
     */
    function createListing(
        uint256 batchId,
        uint256 quantity,
        uint256 pricePerUnit,
        address paymentToken
    ) external override whenNotPaused nonReentrant returns (uint256 listingId) {
        if (quantity == 0) revert ZeroQuantity();
        if (pricePerUnit == 0) revert ZeroPrice();

        // Check that project is active
        ICreditRegistry.CreditBatch memory batch = creditRegistry.getBatch(batchId);
        if (!projectRegistry.isProjectActive(batch.projectId)) {
            revert ProjectSuspendedOrInactive(batch.projectId);
        }

        _listingCount++;
        listingId = _listingCount;

        _listings[listingId] = Listing({
            listingId: listingId,
            seller: msg.sender,
            batchId: batchId,
            quantity: quantity,
            pricePerUnit: pricePerUnit,
            paymentToken: paymentToken,
            active: true
        });

        // Escrow credits into this marketplace contract
        creditRegistry.safeTransferFrom(msg.sender, address(this), batchId, quantity, "");

        emit ListingCreated(
            listingId,
            msg.sender,
            batchId,
            quantity,
            pricePerUnit,
            paymentToken,
            block.timestamp
        );
    }

    /**
     * @notice Purchases a specific quantity of credits from a listing (supports partial fills).
     * @param listingId Listing to purchase from.
     * @param quantity Amount of credits to buy (in 1e18 units).
     */
    function buyListing(
        uint256 listingId,
        uint256 quantity
    ) external payable override whenNotPaused nonReentrant {
        Listing storage listing = _listings[listingId];
        if (!listing.active) revert ListingNotActive(listingId);
        if (quantity == 0) revert ZeroQuantity();
        if (quantity > listing.quantity) revert ExceedsAvailableQuantity(quantity, listing.quantity);

        // Check project active status
        ICreditRegistry.CreditBatch memory batch = creditRegistry.getBatch(listing.batchId);
        if (!projectRegistry.isProjectActive(batch.projectId)) {
            revert ProjectSuspendedOrInactive(batch.projectId);
        }

        // Calculate total cost and fee
        // totalCost = (quantity * pricePerUnit) / 1e18
        uint256 totalCost = (quantity * listing.pricePerUnit) / UNIT_SCALE;
        uint256 fee = (totalCost * feeBasisPoints) / BPS_DENOMINATOR;
        uint256 sellerAmount = totalCost - fee;

        // Effects: Update listing state before interactions (Checks-Effects-Interactions pattern)
        listing.quantity -= quantity;
        if (listing.quantity == 0) {
            listing.active = false;
        }

        // Interactions: Payment settlement
        if (listing.paymentToken == address(0)) {
            // ETH payment
            if (msg.value < totalCost) revert InsufficientPayment(msg.value, totalCost);

            // Pay seller
            (bool sellerSuccess, ) = payable(listing.seller).call{value: sellerAmount}("");
            if (!sellerSuccess) revert TransferFailed();

            // Pay fee
            if (fee > 0 && feeRecipient != address(0)) {
                (bool feeSuccess, ) = payable(feeRecipient).call{value: fee}("");
                if (!feeSuccess) revert TransferFailed();
            }

            // Refund any excess ETH
            if (msg.value > totalCost) {
                (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - totalCost}("");
                if (!refundSuccess) revert TransferFailed();
            }
        } else {
            // ERC-20 payment
            if (msg.value > 0) revert NativeTokenNotAccepted();

            IERC20 payToken = IERC20(listing.paymentToken);
            payToken.safeTransferFrom(msg.sender, listing.seller, sellerAmount);

            if (fee > 0 && feeRecipient != address(0)) {
                payToken.safeTransferFrom(msg.sender, feeRecipient, fee);
            }
        }

        // Deliver credits from escrow to buyer
        creditRegistry.safeTransferFrom(address(this), msg.sender, listing.batchId, quantity, "");

        emit ListingFilled(
            listingId,
            msg.sender,
            quantity,
            totalCost,
            fee,
            block.timestamp
        );
    }

    /**
     * @notice Cancels an active listing and returns escrowed tokens to seller.
     * @param listingId Listing to cancel.
     */
    function cancelListing(uint256 listingId) external override whenNotPaused nonReentrant {
        Listing storage listing = _listings[listingId];
        if (!listing.active) revert ListingNotActive(listingId);
        if (listing.seller != msg.sender) revert UnauthorizedSeller(msg.sender);

        uint256 remainingQuantity = listing.quantity;
        listing.active = false;
        listing.quantity = 0;

        // Return tokens from escrow to seller
        creditRegistry.safeTransferFrom(address(this), listing.seller, listing.batchId, remainingQuantity, "");

        emit ListingCancelled(listingId, msg.sender, block.timestamp);
    }

    /**
     * @notice Updates the price of an active listing.
     * @param listingId Listing to update.
     * @param newPricePerUnit New unit price.
     */
    function updateListingPrice(
        uint256 listingId,
        uint256 newPricePerUnit
    ) external override whenNotPaused {
        if (newPricePerUnit == 0) revert ZeroPrice();

        Listing storage listing = _listings[listingId];
        if (!listing.active) revert ListingNotActive(listingId);
        if (listing.seller != msg.sender) revert UnauthorizedSeller(msg.sender);

        uint256 oldPrice = listing.pricePerUnit;
        listing.pricePerUnit = newPricePerUnit;

        emit ListingPriceUpdated(listingId, oldPrice, newPricePerUnit, block.timestamp);
    }

    /**
     * @notice Updates platform fee configuration.
     * @param newFeeBasisPoints New fee in basis points (max 1000 = 10%).
     * @param newFeeRecipient New fee treasury recipient.
     */
    function setFee(
        uint256 newFeeBasisPoints,
        address newFeeRecipient
    ) external onlyRole(MARKETPLACE_ADMIN_ROLE) {
        if (newFeeBasisPoints > MAX_FEE_BPS) revert FeeTooHigh(newFeeBasisPoints, MAX_FEE_BPS);
        if (newFeeRecipient == address(0) && newFeeBasisPoints > 0) revert InvalidAddress();

        uint256 oldFee = feeBasisPoints;
        address oldRecipient = feeRecipient;

        feeBasisPoints = newFeeBasisPoints;
        feeRecipient = newFeeRecipient;

        emit FeeUpdated(oldFee, newFeeBasisPoints, oldRecipient, newFeeRecipient);
    }

    /**
     * @notice Retrieves listing details.
     */
    function getListing(uint256 listingId) external view override returns (Listing memory) {
        if (listingId == 0 || listingId > _listingCount) revert ListingNotFound(listingId);
        return _listings[listingId];
    }

    /**
     * @notice Total number of listings ever created.
     */
    function listingCount() external view returns (uint256) {
        return _listingCount;
    }

    /**
     * @notice Pause marketplace.
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause marketplace.
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev SupportsInterface override for AccessControl and ERC1155Receiver.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(AccessControl, ERC1155Holder) returns (bool) {
        return super.supportsInterface(interfaceId) || interfaceId == type(IMarketplace).interfaceId;
    }
}
