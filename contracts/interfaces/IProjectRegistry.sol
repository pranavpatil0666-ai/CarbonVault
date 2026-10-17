// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IProjectRegistry
 * @notice Interface for Project registration and lifecycle tracking in CarbonVault.
 *
 * NOTE: The blockchain does NOT prove the real-world existence, additionality, or ecological integrity of a project.
 * It records claims submitted by developers and audits attested by accredited verifiers, anchored to established registries.
 */
interface IProjectRegistry {
    enum ProjectStatus {
        Pending,
        UnderReview,
        Verified,
        Rejected,
        Suspended
    }

    struct Project {
        uint256 projectId;
        address developer;
        string name;
        string methodology;
        string country;
        uint16 vintageStart;
        uint16 vintageEnd;
        string externalRegistry;
        string externalProjectId;
        string ipfsDocumentHash;
        ProjectStatus status;
        uint256 registeredAt;
    }

    struct VerificationRecord {
        address verifier;
        uint256 timestamp;
        string reportHash;
        uint256 estimatedMaxTonnes;
        string comments;
    }

    event ProjectRegistered(
        uint256 indexed projectId,
        address indexed developer,
        string name,
        string externalRegistry,
        string externalProjectId,
        string ipfsDocumentHash,
        uint256 timestamp
    );

    event ProjectUnderReview(
        uint256 indexed projectId,
        address indexed verifier,
        uint256 timestamp
    );

    event ProjectVerified(
        uint256 indexed projectId,
        address indexed verifier,
        string reportHash,
        uint256 estimatedMaxTonnes,
        uint256 timestamp
    );

    event ProjectRejected(
        uint256 indexed projectId,
        address indexed verifier,
        string reportHash,
        string comments,
        uint256 timestamp
    );

    event ProjectSuspended(
        uint256 indexed projectId,
        address indexed actor,
        string reason,
        uint256 timestamp
    );

    event ProjectUnsuspended(
        uint256 indexed projectId,
        address indexed actor,
        string reason,
        uint256 timestamp
    );

    function getProject(uint256 projectId) external view returns (Project memory);
    function getVerification(uint256 projectId) external view returns (VerificationRecord memory);
    function isProjectActive(uint256 projectId) external view returns (bool);
    function getProjectCount() external view returns (uint256);
}
