// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IMarketplace
 * @notice Interface for Carbon Credit Marketplace in CarbonVault.
 */
interface IMarketplace {
    struct Listing {
        uint256 listingId;
        address seller;
        uint256 batchId;
        uint256 quantity;
        uint256 pricePerUnit;
        address paymentToken;
        bool active;
    }

    event ListingCreated(
        uint256 indexed listingId,
        address indexed seller,
        uint256 indexed batchId,
        uint256 quantity,
        uint256 pricePerUnit,
        address paymentToken,
        uint256 timestamp
    );

    event ListingFilled(
        uint256 indexed listingId,
        address indexed buyer,
        uint256 quantity,
        uint256 totalPrice,
        uint256 platformFee,
        uint256 timestamp
    );

    event ListingCancelled(
        uint256 indexed listingId,
        address indexed seller,
        uint256 timestamp
    );

    event ListingPriceUpdated(
        uint256 indexed listingId,
        uint256 oldPrice,
        uint256 newPrice,
        uint256 timestamp
    );

    event FeeUpdated(
        uint256 oldFeeBasisPoints,
        uint256 newFeeBasisPoints,
        address oldRecipient,
        address newRecipient
    );

    function createListing(
        uint256 batchId,
        uint256 quantity,
        uint256 pricePerUnit,
        address paymentToken
    ) external returns (uint256 listingId);

    function buyListing(
        uint256 listingId,
        uint256 quantity
    ) external payable;

    function cancelListing(uint256 listingId) external;

    function updateListingPrice(
        uint256 listingId,
        uint256 newPricePerUnit
    ) external;

    function getListing(uint256 listingId) external view returns (Listing memory);
}
