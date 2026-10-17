// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

/**
 * @title ICreditRegistry
 * @notice Interface for Carbon Credit ERC-1155 token batches in CarbonVault.
 *
 * NOTE: The token does NOT prove physical carbon sequestration. It represents an auditable,
 * on-chain carbon credit batch backed by third-party verification and external registry serial numbers.
 */
interface ICreditRegistry is IERC1155 {
    struct CreditBatch {
        uint256 batchId;
        uint256 projectId;
        uint16 vintage;
        uint256 quantityIssued;
        string serialNumberStart;
        string serialNumberEnd;
        bytes32 serialRangeHash;
        uint256 issuanceTimestamp;
        string ipfsIssuanceProof;
    }

    event BatchIssued(
        uint256 indexed batchId,
        uint256 indexed projectId,
        uint16 indexed vintage,
        uint256 quantity,
        string serialNumberStart,
        string serialNumberEnd,
        address recipient,
        uint256 timestamp
    );

    event CreditsBurnedForRetirement(
        uint256 indexed batchId,
        address indexed account,
        uint256 amount,
        uint256 timestamp
    );

    function issueBatch(
        uint256 projectId,
        uint16 vintage,
        uint256 quantity,
        string calldata serialNumberStart,
        string calldata serialNumberEnd,
        string calldata ipfsIssuanceProof,
        address recipient
    ) external returns (uint256 batchId);

    function retire(address account, uint256 batchId, uint256 amount) external;

    function getBatch(uint256 batchId) external view returns (CreditBatch memory);
    function totalIssuedPerProject(uint256 projectId) external view returns (uint256);
    function totalRetiredPerBatch(uint256 batchId) external view returns (uint256);
    function batchCount() external view returns (uint256);
}
