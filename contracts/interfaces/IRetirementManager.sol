// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IRetirementManager
 * @notice Interface for Carbon Credit Retirement and Public Certificate issuance in CarbonVault.
 *
 * NOTE: On-chain retirement burns the CarbonVault ERC-1155 token, ensuring it cannot be traded or
 * transferred again within this platform. External registry off-chain retirement references may be linked.
 */
interface IRetirementManager {
    struct RetirementCertificate {
        uint256 retirementId;
        address retiree;
        string beneficiaryName;
        string retirementReason;
        uint256 batchId;
        uint256 amount;
        uint256 timestamp;
        string externalRegistryRef;
        bytes32 certificateHash;
    }

    event CreditsRetired(
        uint256 indexed retirementId,
        address indexed retiree,
        string beneficiaryName,
        uint256 indexed batchId,
        uint256 amount,
        uint256 timestamp,
        bytes32 certificateHash,
        string externalRegistryRef
    );

    function retireCredits(
        uint256 batchId,
        uint256 amount,
        string calldata beneficiaryName,
        string calldata retirementReason,
        string calldata externalRegistryRef
    ) external returns (uint256 retirementId);

    function getCertificate(uint256 retirementId) external view returns (RetirementCertificate memory);
    function getRetirementsByRetiree(address retiree) external view returns (uint256[] memory);
    function getRetirementsByBatch(uint256 batchId) external view returns (uint256[] memory);
    function totalRetirements() external view returns (uint256);
}
