// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IVerifierRegistry.sol";

/**
 * @title VerifierRegistry
 * @author CarbonVault Protocol
 * @notice Manages authorized independent third-party carbon credit verifiers on-chain.
 *
 * @dev CORE PRINCIPLE DISCLAIMER:
 * The blockchain does NOT establish the real-world competence, integrity, or accreditation
 * validity of a verifier. This contract records administrative authorizations granted to
 * accredited third parties (e.g., ISO 14065 accredited bodies, UNFCCC DOEs) whose offline audits
 * are anchored to on-chain lifecycle events.
 */
contract VerifierRegistry is AccessControl, Pausable, IVerifierRegistry {
    bytes32 public constant VERIFIER_ADMIN_ROLE = keccak256("VERIFIER_ADMIN_ROLE");

    // Address -> Verifier details
    mapping(address => Verifier) private _verifiers;
    // List of all registered verifier addresses for enumerability
    address[] private _verifierAddresses;
    // Fast lookup for address inclusion in array
    mapping(address => bool) private _isKnown;

    // Custom Errors
    error InvalidAddress();
    error EmptyString();
    error VerifierAlreadyExists(address verifier);
    error VerifierNotFound(address verifier);
    error VerifierNotActive(address verifier);

    /**
     * @notice Initializes the VerifierRegistry with an admin address.
     * @param admin The address granted default admin and verifier admin roles.
     */
    constructor(address admin) {
        if (admin == address(0)) revert InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VERIFIER_ADMIN_ROLE, admin);
    }

    /**
     * @notice Registers a new authorized third-party verifier.
     * @param verifierAddress The wallet address belonging to the verifier.
     * @param name The legal or organization name of the verifier.
     * @param accreditationRef Reference ID/code of accreditation (e.g. ISO 14065 / UNFCCC).
     * @param metadataURI IPFS CID or URI linking to accreditation credentials.
     */
    function addVerifier(
        address verifierAddress,
        string calldata name,
        string calldata accreditationRef,
        string calldata metadataURI
    ) external onlyRole(VERIFIER_ADMIN_ROLE) whenNotPaused {
        if (verifierAddress == address(0)) revert InvalidAddress();
        if (bytes(name).length == 0 || bytes(accreditationRef).length == 0) revert EmptyString();
        if (_verifiers[verifierAddress].addedAt != 0) revert VerifierAlreadyExists(verifierAddress);

        _verifiers[verifierAddress] = Verifier({
            verifierAddress: verifierAddress,
            name: name,
            accreditationRef: accreditationRef,
            metadataURI: metadataURI,
            active: true,
            addedAt: block.timestamp
        });

        if (!_isKnown[verifierAddress]) {
            _verifierAddresses.push(verifierAddress);
            _isKnown[verifierAddress] = true;
        }

        emit VerifierAdded(
            verifierAddress,
            name,
            accreditationRef,
            metadataURI,
            block.timestamp
        );
    }

    /**
     * @notice Updates the status and metadata URI of an existing verifier.
     * @param verifierAddress The address of the verifier to update.
     * @param active True if active, false to temporarily suspend authorization.
     * @param metadataURI Updated IPFS CID or URI for accreditation credentials.
     */
    function updateVerifier(
        address verifierAddress,
        bool active,
        string calldata metadataURI
    ) external onlyRole(VERIFIER_ADMIN_ROLE) whenNotPaused {
        if (_verifiers[verifierAddress].addedAt == 0) revert VerifierNotFound(verifierAddress);

        _verifiers[verifierAddress].active = active;
        _verifiers[verifierAddress].metadataURI = metadataURI;

        emit VerifierUpdated(verifierAddress, active, metadataURI, block.timestamp);
    }

    /**
     * @notice Deauthorizes and permanently removes a verifier record.
     * @param verifierAddress The address of the verifier to remove.
     */
    function removeVerifier(
        address verifierAddress
    ) external onlyRole(VERIFIER_ADMIN_ROLE) whenNotPaused {
        if (_verifiers[verifierAddress].addedAt == 0) revert VerifierNotFound(verifierAddress);

        delete _verifiers[verifierAddress];

        emit VerifierRemoved(verifierAddress, block.timestamp);
    }

    /**
     * @notice Checks if an address is an authorized active verifier.
     * @param account Address to check.
     * @return bool True if the account is an authorized and active verifier.
     */
    function isVerifier(address account) external view override returns (bool) {
        return _verifiers[account].active;
    }

    /**
     * @notice Retrieves the full record of a verifier.
     * @param account Address of the verifier.
     * @return Verifier struct containing metadata and authorization status.
     */
    function getVerifier(address account) external view override returns (Verifier memory) {
        if (_verifiers[account].addedAt == 0) revert VerifierNotFound(account);
        return _verifiers[account];
    }

    /**
     * @notice Returns total number of unique verifiers ever registered.
     */
    function getVerifierCount() external view returns (uint256) {
        return _verifierAddresses.length;
    }

    /**
     * @notice Returns verifier address at index.
     */
    function getVerifierAddressAt(uint256 index) external view returns (address) {
        require(index < _verifierAddresses.length, "Index out of bounds");
        return _verifierAddresses[index];
    }

    /**
     * @notice Emergency pause for the registry.
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause the registry.
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
