// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IRetirementManager.sol";
import "./interfaces/ICreditRegistry.sol";

/**
 * @title RetirementManager
 * @author CarbonVault Protocol
 * @notice Manages permanent retirement (burning) of carbon credits and issues
 * publicly queryable, tamper-evident cryptographic retirement certificates.
 *
 * @dev CORE PRINCIPLE DISCLAIMER:
 * On-chain retirement permanently destroys the digital representation within CarbonVault
 * and prevents double-spending or resale on this ledger. It does NOT automatically execute
 * an off-chain retirement in external registries (Verra, Gold Standard) unless linked via
 * the optional external registry reference field and verified by the relevant registry.
 */
contract RetirementManager is AccessControl, Pausable, ReentrancyGuard, IRetirementManager {
    bytes32 public constant RETIREMENT_ADMIN_ROLE = keccak256("RETIREMENT_ADMIN_ROLE");

    ICreditRegistry public immutable creditRegistry;

    uint256 private _retirementCount;

    // Retirement ID -> Certificate
    mapping(uint256 => RetirementCertificate) private _certificates;

    // Retiree address -> list of retirement IDs
    mapping(address => uint256[]) private _retireeCertificates;

    // Batch ID -> list of retirement IDs
    mapping(uint256 => uint256[]) private _batchCertificates;

    // Custom Errors
    error InvalidAddress();
    error ZeroAmount();
    error EmptyString();
    error CertificateNotFound(uint256 retirementId);
    error UnauthorizedRetirement(address caller, address account);

    /**
     * @notice Initializes RetirementManager.
     * @param admin Admin address for governance.
     * @param _creditRegistry Address of the CreditRegistry contract.
     */
    constructor(address admin, address _creditRegistry) {
        if (admin == address(0) || _creditRegistry == address(0)) revert InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RETIREMENT_ADMIN_ROLE, admin);

        creditRegistry = ICreditRegistry(_creditRegistry);
    }

    /**
     * @notice Permanently burns credits for the caller and generates a public retirement certificate.
     * @param batchId ERC-1155 token ID of the credit batch.
     * @param amount Amount of tonnes to permanently retire (in 1e18 units).
     * @param beneficiaryName Name of individual or entity receiving the environmental benefit.
     * @param retirementReason Justification (e.g. "Scope 3 Neutrality FY24", "Flight Offset").
     * @param externalRegistryRef Optional external registry retirement serial or URL.
     * @return retirementId Unique ID of the issued certificate.
     */
    function retireCredits(
        uint256 batchId,
        uint256 amount,
        string calldata beneficiaryName,
        string calldata retirementReason,
        string calldata externalRegistryRef
    ) external override whenNotPaused nonReentrant returns (uint256 retirementId) {
        return _executeRetirement(
            msg.sender,
            batchId,
            amount,
            beneficiaryName,
            retirementReason,
            externalRegistryRef
        );
    }

    /**
     * @notice Retires credits on behalf of an account that has approved the caller.
     * @param account The account whose credits are being burned.
     * @param batchId ERC-1155 token ID of the credit batch.
     * @param amount Amount of tonnes to permanently retire.
     * @param beneficiaryName Name of entity receiving the benefit.
     * @param retirementReason Stated purpose.
     * @param externalRegistryRef External registry reference.
     * @return retirementId Unique ID of the issued certificate.
     */
    function retireCreditsFor(
        address account,
        uint256 batchId,
        uint256 amount,
        string calldata beneficiaryName,
        string calldata retirementReason,
        string calldata externalRegistryRef
    ) external whenNotPaused nonReentrant returns (uint256 retirementId) {
        if (msg.sender != account && !creditRegistry.isApprovedForAll(account, msg.sender)) {
            revert UnauthorizedRetirement(msg.sender, account);
        }

        return _executeRetirement(
            account,
            batchId,
            amount,
            beneficiaryName,
            retirementReason,
            externalRegistryRef
        );
    }

    /**
     * @dev Internal helper executing the burn and certificate registration.
     */
    function _executeRetirement(
        address retiree,
        uint256 batchId,
        uint256 amount,
        string memory beneficiaryName,
        string memory retirementReason,
        string memory externalRegistryRef
    ) internal returns (uint256 retirementId) {
        if (retiree == address(0)) revert InvalidAddress();
        if (amount == 0) revert ZeroAmount();
        if (bytes(beneficiaryName).length == 0 || bytes(retirementReason).length == 0) revert EmptyString();

        // Burn the credits on-chain in CreditRegistry (reverts if insufficient balance or suspended)
        creditRegistry.retire(retiree, batchId, amount);

        _retirementCount++;
        retirementId = _retirementCount;

        // Compute tamper-evident cryptographic hash
        bytes32 certificateHash = keccak256(
            abi.encode(
                retirementId,
                retiree,
                beneficiaryName,
                batchId,
                amount,
                block.timestamp,
                externalRegistryRef
            )
        );

        _certificates[retirementId] = RetirementCertificate({
            retirementId: retirementId,
            retiree: retiree,
            beneficiaryName: beneficiaryName,
            retirementReason: retirementReason,
            batchId: batchId,
            amount: amount,
            timestamp: block.timestamp,
            externalRegistryRef: externalRegistryRef,
            certificateHash: certificateHash
        });

        _retireeCertificates[retiree].push(retirementId);
        _batchCertificates[batchId].push(retirementId);

        emit CreditsRetired(
            retirementId,
            retiree,
            beneficiaryName,
            batchId,
            amount,
            block.timestamp,
            certificateHash,
            externalRegistryRef
        );
    }

    /**
     * @notice Retrieves full certificate details.
     */
    function getCertificate(uint256 retirementId) external view override returns (RetirementCertificate memory) {
        if (retirementId == 0 || retirementId > _retirementCount) revert CertificateNotFound(retirementId);
        return _certificates[retirementId];
    }

    /**
     * @notice Lists all retirement certificate IDs issued to a retiree address.
     */
    function getRetirementsByRetiree(address retiree) external view override returns (uint256[] memory) {
        return _retireeCertificates[retiree];
    }

    /**
     * @notice Lists all retirement certificate IDs associated with a specific batch.
     */
    function getRetirementsByBatch(uint256 batchId) external view override returns (uint256[] memory) {
        return _batchCertificates[batchId];
    }

    /**
     * @notice Returns total number of retirements ever executed.
     */
    function totalRetirements() external view override returns (uint256) {
        return _retirementCount;
    }

    /**
     * @notice Pause contract.
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause contract.
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
