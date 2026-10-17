// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "../interfaces/IMarketplace.sol";

/**
 * @title MaliciousAttacker
 * @notice Test contract attempting reentrancy into CarbonVault Marketplace via onERC1155Received.
 */
contract MaliciousAttacker is IERC1155Receiver {
    IMarketplace public targetMarketplace;
    uint256 public targetListingId;
    uint256 public attackQuantity;
    bool public attackTriggered;
    uint256 public reentrancyCount;
    bool public reentrancyBlocked;
    bytes public reentrancyRevertData;

    constructor(address _marketplace) {
        targetMarketplace = IMarketplace(_marketplace);
    }

    function setTarget(uint256 listingId, uint256 quantity) external {
        targetListingId = listingId;
        attackQuantity = quantity;
        attackTriggered = false;
        reentrancyCount = 0;
        reentrancyBlocked = false;
    }

    function initiateBuyAttack() external payable {
        targetMarketplace.buyListing{value: msg.value}(targetListingId, attackQuantity);
    }

    // Attempt reentrancy during ERC1155 receipt
    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external override returns (bytes4) {
        if (!attackTriggered && targetListingId > 0) {
            attackTriggered = true;
            reentrancyCount++;
            // Reentrancy attempt: call buyListing again while executing
            (bool success, bytes memory returnData) = address(targetMarketplace).call{value: 0}(
                abi.encodeWithSelector(IMarketplace.buyListing.selector, targetListingId, attackQuantity)
            );
            if (!success) {
                reentrancyBlocked = true;
                reentrancyRevertData = returnData;
            }
        }
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    receive() external payable {}

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId;
    }
}
