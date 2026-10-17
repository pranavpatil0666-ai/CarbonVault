// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IVerifierRegistry
 * @notice Interface for the Verifier Registry in CarbonVault.
 *
 * NOTE: The blockchain does NOT establish the real-world validity or integrity of an auditor.
 * This contract records and manages on-chain authorizations for accredited third-party verifiers.
 */
interface IVerifierRegistry {
    struct Verifier {
        address verifierAddress;
        string name;
        string accreditationRef;
        string metadataURI;
        bool active;
        uint256 addedAt;
    }

    event VerifierAdded(
        address indexed verifierAddress,
        string name,
        string accreditationRef,
        string metadataURI,
        uint256 timestamp
    );

    event VerifierUpdated(
        address indexed verifierAddress,
        bool active,
        string metadataURI,
        uint256 timestamp
    );

    event VerifierRemoved(
        address indexed verifierAddress,
        uint256 timestamp
    );

    function isVerifier(address account) external view returns (bool);
    function getVerifier(address account) external view returns (Verifier memory);
}
