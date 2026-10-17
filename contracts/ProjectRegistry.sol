// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IProjectRegistry.sol";
import "./interfaces/IVerifierRegistry.sol";

/**
 * @title ProjectRegistry
 * @author CarbonVault Protocol
 * @notice Registers carbon mitigation projects, enforces anti-duplicate checks against
 * external registries, and transitions project verification states through third-party audits.
 *
 * @dev CORE PRINCIPLE DISCLAIMER:
 * The blockchain does NOT establish or guarantee the physical additionality, permanence,
 * or baseline validity of a project. It immutably records project claims anchored to
 * external standards bodies (Verra, Gold Standard, etc.) and audit attestations signed by
 * authorized verifiers.
 */
contract ProjectRegistry is AccessControl, Pausable, IProjectRegistry {
    bytes32 public constant PROJECT_ADMIN_ROLE = keccak256("PROJECT_ADMIN_ROLE");

    IVerifierRegistry public immutable verifierRegistry;

    // Counter for sequential project IDs
    uint256 private _projectCount;

    // Project ID -> Project details
    mapping(uint256 => Project) private _projects;

    // Project ID -> Verification Record
    mapping(uint256 => VerificationRecord) private _verifications;

    // Anti-duplicate registry: keccak256(abi.encodePacked(externalRegistry, externalProjectId)) => bool
    mapping(bytes32 => bool) private _registeredExternalProjects;

    // Developer address => array of project IDs registered
    mapping(address => uint256[]) private _developerProjects;

    // Custom Errors
    error InvalidAddress();
    error EmptyString();
    error InvalidVintageRange(uint16 start, uint16 end);
    error DuplicateExternalProject(string registry, string externalId);
    error ProjectNotFound(uint256 projectId);
    error UnauthorizedVerifier(address caller);
    error InvalidStatusTransition(ProjectStatus currentStatus, ProjectStatus requestedStatus);
    error ZeroEstimatedTonnes();

    modifier onlyVerifier() {
        if (!verifierRegistry.isVerifier(msg.sender)) {
            revert UnauthorizedVerifier(msg.sender);
        }
        _;
    }

    /**
     * @notice Initializes the ProjectRegistry.
     * @param admin Admin address for governance.
     * @param _verifierRegistry Address of the VerifierRegistry contract.
     */
    constructor(address admin, address _verifierRegistry) {
        if (admin == address(0) || _verifierRegistry == address(0)) revert InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PROJECT_ADMIN_ROLE, admin);
        verifierRegistry = IVerifierRegistry(_verifierRegistry);
    }

    /**
     * @notice Developers submit a new project for review.
     * @param name Project title / designation.
     * @param methodology Approved carbon accounting methodology (e.g. VM0007).
     * @param country Host country.
     * @param vintageStart Earliest vintage year.
     * @param vintageEnd Latest vintage year.
     * @param externalRegistry Name of external standards body (e.g. "Verra VCS", "Gold Standard").
     * @param externalProjectId Unique identifier in external registry (e.g. "VCS-1748").
     * @param ipfsDocumentHash IPFS CID of Project Design Document (PDD).
     * @return projectId The newly assigned sequential project ID.
     */
    function registerProject(
        string calldata name,
        string calldata methodology,
        string calldata country,
        uint16 vintageStart,
        uint16 vintageEnd,
        string calldata externalRegistry,
        string calldata externalProjectId,
        string calldata ipfsDocumentHash
    ) external whenNotPaused returns (uint256 projectId) {
        if (bytes(name).length == 0 || bytes(methodology).length == 0 || bytes(country).length == 0) revert EmptyString();
        if (bytes(externalRegistry).length == 0 || bytes(externalProjectId).length == 0) revert EmptyString();
        if (bytes(ipfsDocumentHash).length == 0) revert EmptyString();
        if (vintageStart > vintageEnd) revert InvalidVintageRange(vintageStart, vintageEnd);

        // Anti-double-registration check
        bytes32 externalKey = keccak256(abi.encode(externalRegistry, externalProjectId));
        if (_registeredExternalProjects[externalKey]) {
            revert DuplicateExternalProject(externalRegistry, externalProjectId);
        }
        _registeredExternalProjects[externalKey] = true;

        _projectCount++;
        projectId = _projectCount;

        _projects[projectId] = Project({
            projectId: projectId,
            developer: msg.sender,
            name: name,
            methodology: methodology,
            country: country,
            vintageStart: vintageStart,
            vintageEnd: vintageEnd,
            externalRegistry: externalRegistry,
            externalProjectId: externalProjectId,
            ipfsDocumentHash: ipfsDocumentHash,
            status: ProjectStatus.Pending,
            registeredAt: block.timestamp
        });

        _developerProjects[msg.sender].push(projectId);

        emit ProjectRegistered(
            projectId,
            msg.sender,
            name,
            externalRegistry,
            externalProjectId,
            ipfsDocumentHash,
            block.timestamp
        );
    }

    /**
     * @notice Verifier begins reviewing a pending project.
     * @param projectId The project ID.
     */
    function startReview(uint256 projectId) external onlyVerifier whenNotPaused {
        Project storage project = _projects[projectId];
        if (project.registeredAt == 0) revert ProjectNotFound(projectId);
        if (project.status != ProjectStatus.Pending) {
            revert InvalidStatusTransition(project.status, ProjectStatus.UnderReview);
        }

        project.status = ProjectStatus.UnderReview;

        emit ProjectUnderReview(projectId, msg.sender, block.timestamp);
    }

    /**
     * @notice Verifier approves and attests to the verification of a project.
     * @param projectId The project ID.
     * @param reportHash IPFS CID of the validation/verification audit report.
     * @param estimatedMaxTonnes Maximum issuable tonnes approved by verifier across project life.
     * @param comments Verification notes or audit findings.
     */
    function verifyProject(
        uint256 projectId,
        string calldata reportHash,
        uint256 estimatedMaxTonnes,
        string calldata comments
    ) external onlyVerifier whenNotPaused {
        Project storage project = _projects[projectId];
        if (project.registeredAt == 0) revert ProjectNotFound(projectId);
        if (project.status != ProjectStatus.UnderReview && project.status != ProjectStatus.Pending) {
            revert InvalidStatusTransition(project.status, ProjectStatus.Verified);
        }
        if (estimatedMaxTonnes == 0) revert ZeroEstimatedTonnes();
        if (bytes(reportHash).length == 0) revert EmptyString();

        project.status = ProjectStatus.Verified;

        _verifications[projectId] = VerificationRecord({
            verifier: msg.sender,
            timestamp: block.timestamp,
            reportHash: reportHash,
            estimatedMaxTonnes: estimatedMaxTonnes,
            comments: comments
        });

        emit ProjectVerified(
            projectId,
            msg.sender,
            reportHash,
            estimatedMaxTonnes,
            block.timestamp
        );
    }

    /**
     * @notice Verifier rejects a project registration based on failed audit.
     * @param projectId The project ID.
     * @param reportHash IPFS CID of the negative finding report.
     * @param comments Specific reasons for rejection.
     */
    function rejectProject(
        uint256 projectId,
        string calldata reportHash,
        string calldata comments
    ) external onlyVerifier whenNotPaused {
        Project storage project = _projects[projectId];
        if (project.registeredAt == 0) revert ProjectNotFound(projectId);
        if (project.status != ProjectStatus.UnderReview && project.status != ProjectStatus.Pending) {
            revert InvalidStatusTransition(project.status, ProjectStatus.Rejected);
        }

        project.status = ProjectStatus.Rejected;

        _verifications[projectId] = VerificationRecord({
            verifier: msg.sender,
            timestamp: block.timestamp,
            reportHash: reportHash,
            estimatedMaxTonnes: 0,
            comments: comments
        });

        emit ProjectRejected(projectId, msg.sender, reportHash, comments, block.timestamp);
    }

    /**
     * @notice Suspends a project due to regulatory inquiry, audit dispute, or registry flag.
     * @dev Can be called by DEFAULT_ADMIN_ROLE or any authorized active verifier.
     * @param projectId Project to suspend.
     * @param reason Detailed explanation for suspension.
     */
    function suspendProject(uint256 projectId, string calldata reason) external whenNotPaused {
        bool isAdmin = hasRole(DEFAULT_ADMIN_ROLE, msg.sender);
        bool isAuthVerifier = verifierRegistry.isVerifier(msg.sender);
        if (!isAdmin && !isAuthVerifier) revert UnauthorizedVerifier(msg.sender);

        Project storage project = _projects[projectId];
        if (project.registeredAt == 0) revert ProjectNotFound(projectId);
        if (project.status != ProjectStatus.Verified) {
            revert InvalidStatusTransition(project.status, ProjectStatus.Suspended);
        }

        project.status = ProjectStatus.Suspended;

        emit ProjectSuspended(projectId, msg.sender, reason, block.timestamp);
    }

    /**
     * @notice Restores a suspended project back to Verified status once dispute is cleared.
     * @param projectId Project to restore.
     * @param reason Explanation of clearance.
     */
    function unsuspendProject(uint256 projectId, string calldata reason) external whenNotPaused {
        bool isAdmin = hasRole(DEFAULT_ADMIN_ROLE, msg.sender);
        bool isAuthVerifier = verifierRegistry.isVerifier(msg.sender);
        if (!isAdmin && !isAuthVerifier) revert UnauthorizedVerifier(msg.sender);

        Project storage project = _projects[projectId];
        if (project.registeredAt == 0) revert ProjectNotFound(projectId);
        if (project.status != ProjectStatus.Suspended) {
            revert InvalidStatusTransition(project.status, ProjectStatus.Verified);
        }

        project.status = ProjectStatus.Verified;

        emit ProjectUnsuspended(projectId, msg.sender, reason, block.timestamp);
    }

    /**
     * @notice View function to get complete project data.
     */
    function getProject(uint256 projectId) external view override returns (Project memory) {
        if (_projects[projectId].registeredAt == 0) revert ProjectNotFound(projectId);
        return _projects[projectId];
    }

    /**
     * @notice View function to get verification record.
     */
    function getVerification(uint256 projectId) external view override returns (VerificationRecord memory) {
        return _verifications[projectId];
    }

    /**
     * @notice Checks whether a project is currently active (Verified and not Suspended).
     */
    function isProjectActive(uint256 projectId) external view override returns (bool) {
        return _projects[projectId].status == ProjectStatus.Verified;
    }

    /**
     * @notice Total number of registered projects.
     */
    function getProjectCount() external view override returns (uint256) {
        return _projectCount;
    }

    /**
     * @notice Projects registered by a specific developer.
     */
    function getProjectsByDeveloper(address developer) external view returns (uint256[] memory) {
        return _developerProjects[developer];
    }

    /**
     * @notice Emergency pause.
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause.
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
