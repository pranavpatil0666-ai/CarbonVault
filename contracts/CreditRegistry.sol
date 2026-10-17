// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/ICreditRegistry.sol";
import "./interfaces/IProjectRegistry.sol";

/**
 * @title CreditRegistry
 * @author CarbonVault Protocol
 * @notice ERC-1155 multi-token contract managing verified carbon credit batches.
 * Each token ID represents a unique project + vintage credit batch.
 *
 * @dev CORE PRINCIPLE DISCLAIMER:
 * The ERC-1155 token does NOT prove physical carbon sequestration or ecological additionality.
 * It is an auditable on-chain certificate that anchors a discrete batch of tonnes CO2e
 * backed by verified off-chain registry serial numbers and authorized auditor sign-offs.
 */
contract CreditRegistry is ERC1155, AccessControl, Pausable, ICreditRegistry {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant RETIREMENT_ROLE = keccak256("RETIREMENT_ROLE");

    IProjectRegistry public immutable projectRegistry;

    // Sequential counter for batch IDs
    uint256 private _batchCount;

    // Batch ID -> CreditBatch metadata
    mapping(uint256 => CreditBatch) private _batches;

    // Project ID -> Total cumulative tonnes issued
    mapping(uint256 => uint256) public override totalIssuedPerProject;

    // Batch ID -> Total tonnes retired (burned)
    mapping(uint256 => uint256) public override totalRetiredPerBatch;

    // Hash of serial range -> bool (prevents reuse of external registry serial numbers)
    mapping(bytes32 => bool) public usedSerialRangeHashes;

    // Project ID => array of batch IDs issued
    mapping(uint256 => uint256[]) private _projectBatches;

    // Custom Errors
    error InvalidAddress();
    error EmptyString();
    error ZeroQuantity();
    error BatchNotFound(uint256 batchId);
    error ProjectNotActive(uint256 projectId);
    error VintageOutOfRange(uint16 vintage, uint16 start, uint16 end);
    error IssuanceExceedsCap(uint256 projectId, uint256 requestedTotal, uint256 maxAllowed);
    error SerialRangeAlreadyIssued(string startSerial, string endSerial);
    error ProjectSuspendedOrInactive(uint256 projectId);
    error InsufficientBalance(address account, uint256 batchId, uint256 balance, uint256 required);

    /**
     * @notice Initializes CreditRegistry.
     * @param admin Admin address for role management.
     * @param _projectRegistry Address of ProjectRegistry contract.
     * @param baseURI Metadata base URI for ERC-1155 tokens.
     */
    constructor(
        address admin,
        address _projectRegistry,
        string memory baseURI
    ) ERC1155(baseURI) {
        if (admin == address(0) || _projectRegistry == address(0)) revert InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);

        projectRegistry = IProjectRegistry(_projectRegistry);
    }

    /**
     * @notice Issues a new batch of carbon credit tokens for a verified project.
     * @dev Enforces verifier-approved issuance cap and prevents serial number duplicate reuse.
     * @param projectId The ID of the verified project.
     * @param vintage The vintage year for this credit batch.
     * @param quantity Amount of credits (in 18 decimals; 1e18 = 1 metric tonne CO2e).
     * @param serialNumberStart Starting serial number from external registry.
     * @param serialNumberEnd Ending serial number from external registry.
     * @param ipfsIssuanceProof IPFS CID of the issuance attestation/statement.
     * @param recipient Destination address for the newly minted credits.
     * @return batchId The newly created ERC-1155 token ID.
     */
    function issueBatch(
        uint256 projectId,
        uint16 vintage,
        uint256 quantity,
        string calldata serialNumberStart,
        string calldata serialNumberEnd,
        string calldata ipfsIssuanceProof,
        address recipient
    ) external override onlyRole(ISSUER_ROLE) whenNotPaused returns (uint256 batchId) {
        if (recipient == address(0)) revert InvalidAddress();
        if (quantity == 0) revert ZeroQuantity();
        if (bytes(serialNumberStart).length == 0 || bytes(serialNumberEnd).length == 0) revert EmptyString();
        if (bytes(ipfsIssuanceProof).length == 0) revert EmptyString();

        // Check project status
        if (!projectRegistry.isProjectActive(projectId)) revert ProjectNotActive(projectId);

        IProjectRegistry.Project memory project = projectRegistry.getProject(projectId);
        if (vintage < project.vintageStart || vintage > project.vintageEnd) {
            revert VintageOutOfRange(vintage, project.vintageStart, project.vintageEnd);
        }

        // Anti-double-issuance check: total issuance cannot exceed verifier's cap
        IProjectRegistry.VerificationRecord memory verification = projectRegistry.getVerification(projectId);
        uint256 currentTotal = totalIssuedPerProject[projectId];
        if (currentTotal + quantity > verification.estimatedMaxTonnes) {
            revert IssuanceExceedsCap(projectId, currentTotal + quantity, verification.estimatedMaxTonnes);
        }

        // Anti-double-counting check: ensure external serial range is globally unique
        bytes32 serialHash = keccak256(abi.encode(serialNumberStart, serialNumberEnd));
        if (usedSerialRangeHashes[serialHash]) {
            revert SerialRangeAlreadyIssued(serialNumberStart, serialNumberEnd);
        }
        usedSerialRangeHashes[serialHash] = true;

        totalIssuedPerProject[projectId] = currentTotal + quantity;

        _batchCount++;
        batchId = _batchCount;

        _batches[batchId] = CreditBatch({
            batchId: batchId,
            projectId: projectId,
            vintage: vintage,
            quantityIssued: quantity,
            serialNumberStart: serialNumberStart,
            serialNumberEnd: serialNumberEnd,
            serialRangeHash: serialHash,
            issuanceTimestamp: block.timestamp,
            ipfsIssuanceProof: ipfsIssuanceProof
        });

        _projectBatches[projectId].push(batchId);

        _mint(recipient, batchId, quantity, "");

        emit BatchIssued(
            batchId,
            projectId,
            vintage,
            quantity,
            serialNumberStart,
            serialNumberEnd,
            recipient,
            block.timestamp
        );
    }

    /**
     * @notice Burns credit tokens upon retirement.
     * @dev Only callable by the authorized RetirementManager contract.
     * @param account The wallet retiring the credits.
     * @param batchId The batch/token ID being retired.
     * @param amount The quantity of credits to retire.
     */
    function retire(
        address account,
        uint256 batchId,
        uint256 amount
    ) external override onlyRole(RETIREMENT_ROLE) whenNotPaused {
        if (account == address(0)) revert InvalidAddress();
        if (amount == 0) revert ZeroQuantity();
        if (_batches[batchId].batchId == 0) revert BatchNotFound(batchId);

        // Disallow retiring credits from a suspended project
        uint256 projectId = _batches[batchId].projectId;
        if (!projectRegistry.isProjectActive(projectId)) {
            revert ProjectSuspendedOrInactive(projectId);
        }

        uint256 balance = balanceOf(account, batchId);
        if (balance < amount) revert InsufficientBalance(account, batchId, balance, amount);

        totalRetiredPerBatch[batchId] += amount;

        _burn(account, batchId, amount);

        emit CreditsBurnedForRetirement(batchId, account, amount, block.timestamp);
    }

    /**
     * @dev Hook that is called before any token transfer, minting, or burning.
     * Blocks transfers between accounts if the underlying project is Suspended.
     */
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal virtual override whenNotPaused {
        // If this is a regular transfer between users or marketplace (not minting)
        if (from != address(0)) {
            for (uint256 i = 0; i < ids.length; i++) {
                uint256 bId = ids[i];
                CreditBatch storage b = _batches[bId];
                if (b.batchId == 0) revert BatchNotFound(bId);

                // Enforce project active status on transfer
                if (!projectRegistry.isProjectActive(b.projectId)) {
                    revert ProjectSuspendedOrInactive(b.projectId);
                }
            }
        }

        super._update(from, to, ids, values);
    }

    /**
     * @notice Returns batch details by ID.
     */
    function getBatch(uint256 batchId) external view override returns (CreditBatch memory) {
        if (_batches[batchId].batchId == 0) revert BatchNotFound(batchId);
        return _batches[batchId];
    }

    /**
     * @notice Total number of batches issued.
     */
    function batchCount() external view override returns (uint256) {
        return _batchCount;
    }

    /**
     * @notice Returns all batch IDs issued for a given project.
     */
    function getBatchesByProject(uint256 projectId) external view returns (uint256[] memory) {
        return _projectBatches[projectId];
    }

    /**
     * @notice Sets base URI for ERC-1155 token metadata.
     */
    function setURI(string memory newURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setURI(newURI);
    }

    /**
     * @notice Pause contract operations.
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause contract operations.
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice SupportsInterface override for AccessControl and ERC1155.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(AccessControl, ERC1155, IERC165) returns (bool) {
        return super.supportsInterface(interfaceId) || interfaceId == type(ICreditRegistry).interfaceId;
    }
}
