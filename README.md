# CarbonVault: Auditable On-Chain Carbon Credit Lifecycle Protocol

[![CI/CD Pipeline](https://github.com/pranavpatil0666-ai/CarbonVault/actions/workflows/ci.yml/badge.svg)](https://github.com/pranavpatil0666-ai/CarbonVault/actions/workflows/ci.yml)
[![Vercel Deployment](https://img.shields.io/badge/Vercel-Live%20App-000000?logo=vercel)](https://frontend-snowy-ten-19.vercel.app)
[![Solidity](https://img.shields.io/badge/Solidity-^0.8.24-363636?logo=solidity)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-yellow?logo=ethereum)](https://hardhat.org/)
[![OpenZeppelin](https://img.shields.io/badge/OpenZeppelin-Contracts%20v5-4E5EE4?logo=openzeppelin)](https://openzeppelin.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14%20(App%20Router)-black?logo=next.js)](https://nextjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)

---

## 1. Core Principle & Architectural Philosophy

> **IMPORTANT PRINCIPLE:**  
> **The blockchain does NOT establish or prove the real-world physical validity, baseline additionality, or carbon sequestration of a credit.**  
> 
> Physical carbon measurement and baseline modeling require in-situ remote sensing, eddy covariance flux towers, soil sampling, and third-party scientific audit. CarbonVault serves as an **immutable, auditable, non-double-issuing ledger** that anchors lifecycle events to accredited Designated Operational Entities (DOEs / ISO 14065 verifiers) and established voluntary carbon registries (e.g., Verra VCS, Gold Standard, Climate Action Reserve).
> 
> The protocol guarantees cryptographic provenance and operational integrity across the complete lifecycle:  
> **Project Registration → Independent Verification → Credit Issuance → Ownership Transfer → Permanent Retirement.**

---

## 2. System Architecture & Lifecycle Workflow

### Architecture Diagram

```mermaid
flowchart TD
    subgraph Actors["Platform Participants"]
        Dev["Project Developer"]
        Auditor["Accredited Verifier (DOE)"]
        Trader["Buyer / Liquidity Provider"]
        Retiree["Corporate Retiree"]
        AuditorPub["Public Auditor (No Wallet)"]
    end

    subgraph Storage["Decentralized Storage"]
        IPFS[("IPFS Gateway<br/>PDDs & Verification Reports")]
    end

    subgraph EVM["Ethereum / Local EVM Protocol"]
        VR["VerifierRegistry.sol<br/>(ISO 14065 Auditor Accreditation)"]
        PR["ProjectRegistry.sol<br/>(External Registry Anchors & FSM)"]
        CR["CreditRegistry.sol (ERC-1155)<br/>(Cap Enforcement & Unique Serials)"]
        MP["Marketplace.sol<br/>(Non-Custodial Escrow, ETH / USDC)"]
        RM["RetirementManager.sol<br/>(Permanent Token Burn & Cert Hash)"]
    end

    subgraph Indexer["Event Indexer & Audit API (Node + SQLite)"]
        Sync["Blockchain Event Listener"]
        DB[("SQLite Provenance DB (WAL)")]
        API["REST API (:3001)"]
    end

    subgraph Frontend["CarbonVault Web Interface (Next.js 14)"]
        Dash["Public Verification Dashboard"]
        PDev["Developer Registration & Issuance"]
        PAud["Auditor Review Queue"]
        PPort["Portfolio & Retirement Hub"]
        PCert["Cryptographic Certificate Viewer"]
    end

    %% Lifecycle Connections
    Dev -->|1. Register Project| PR
    Dev -.->|Upload PDD Document| IPFS
    IPFS -.->|Content CID| PR

    Auditor -->|2. Verify & Set Max Cap| PR
    Auditor -.->|Upload Audit Report| IPFS
    VR -.->|Validate Verifier Role| PR

    Dev -->|3. Issue Batch (<= Cap)| CR
    PR -.->|Check Cap & Active Status| CR

    Trader -->|4. List & Trade Batches| MP
    CR -.->|Lock Escrow Approval| MP

    Retiree -->|5. Retire & Burn Tokens| RM
    RM -->|Permanently Burn| CR

    %% Indexer Connections
    EVM -.->|EVM Logs & State Events| Sync
    Sync --> DB
    DB --> API
    API --> Frontend

    %% Public Auditor Access
    AuditorPub -->|Audit Provenance Without Wallet| Dash
    AuditorPub -->|Inspect Certificate| PCert
```

### Complete Lifecycle State Transitions

```
[Developer]
    │
    ▼
Project Registration  ──►  Status: PENDING
                               │
                               ▼
Auditor Review        ──►  Status: UNDER REVIEW
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
        Status: VERIFIED              Status: REJECTED
        (Audited Cap Set)             (Reason Stored)
                │
                ├────────────────────────────────────────┐
                ▼                                        ▼
        Batch Issuance (ERC-1155)                Status: SUSPENDED
        • Cumulative <= Cap                      (Dispute / Registry Hold)
        • Unique Serial Range                    • All Transfers Blocked
                │                                • All Trades Frozen
                ▼
        Marketplace Trading
        • ETH & USDC Settlement
        • Partial Fills & Non-Custodial
                │
                ▼
        Permanent Retirement
        • ERC-1155 Burned Forever
        • Certificate Hash Generated
        • Linked to External Registry Reference
```

---

## 3. Smart Contract Modules

CarbonVault consists of five modular Solidity `^0.8.24` contracts compiled with the Cancun EVM target and OpenZeppelin Contracts v5:

### 1. `VerifierRegistry.sol`
- **Role**: Maintains the authorized roster of accredited third-party auditing bodies (e.g., SGS Climate Solutions, DNV, Bureau Veritas).
- **Security Features**:
  - `VERIFIER_ADMIN_ROLE` for governance oversight.
  - Granular verifier metadata: accreditation reference (ISO 14065 / UNFCCC DOE code), legal entity name, and credential IPFS URI.
  - Emergency pause capability via `Pausable`.
  - On-chain interface `IVerifierRegistry` consumed by `ProjectRegistry`.

### 2. `ProjectRegistry.sol`
- **Role**: Serves as the immutable registry for voluntary conservation projects and implements the verification finite state machine.
- **Security & Integrity Features**:
  - **Collision-Proof External Anchor**: Enforces unique registry entries via:
    ```solidity
    bytes32 anchorKey = keccak256(abi.encode(externalRegistry, externalProjectId));
    ```
    Prevents duplicate listing of identical registry projects (e.g. Verra `VCS-1122`).
  - **State Machine**: `Pending` → `UnderReview` → `Verified` | `Rejected` → `Suspended`.
  - **Auditor Cap Setting**: Only authorized verifiers can transition a project to `Verified`, setting `estimatedMaxTonnes` and publishing the validation report IPFS CID.
  - **Emergency Suspension**: Verifiers or platform admin can suspend projects under dispute or registry revocation, halting all secondary trading and transfers.

### 3. `CreditRegistry.sol` (ERC-1155)
- **Role**: Manages multi-token carbon credit batches, where each Token ID represents a distinct `(projectId, vintage)` credit vintage.
- **Anti-Double-Issuance Controls**:
  - **Cumulative Issuance Cap**: Enforces `cumulativeIssued[projectId] + quantity <= estimatedMaxTonnes`. Attempts to over-issue revert with `IssuanceExceedsApprovedCap`.
  - **Unique Serial Ranges**: Hashes external serial numbers (`keccak256(abi.encode(start, end))`) and prevents re-issuance of identical serial numbers across all batches.
  - **Suspension Transfer Lock**: Overrides `_update(...)` hook to revert transfers if the associated project is currently `Suspended`.
  - **Burn Protection**: Authorizes `RetirementManager` to burn held tokens permanently upon retirement.

### 4. `Marketplace.sol`
- **Role**: Non-custodial, peer-to-peer carbon credit order book with atomic settlement.
- **Mechanisms**:
  - Supports both **Native ETH** and **ERC-20 Stablecoins** (Mock USDC with 6 decimals).
  - Escrow via ERC-1155 approval and atomic `safeTransferFrom`.
  - Supports **partial fills** (`buyListing(listingId, quantity)`).
  - Checks-Effects-Interactions (CEI) state machine with `ReentrancyGuard`.
  - Configurable protocol fee (capped at max 10% on-chain) distributed to treasury.
  - Automatic validation of project status (reverts if underlying project is suspended).

### 5. `RetirementManager.sol`
- **Role**: Execution module for permanent token retirement and cryptographic certificate generation.
- **Certificate Verification**:
  - Permanently burns ERC-1155 tokens via `CreditRegistry.burnFromRetirement(...)`.
  - Computes an immutable cryptographic certificate hash:
    ```solidity
    bytes32 certHash = keccak256(abi.encode(
        retirementId,
        msg.sender,
        batchId,
        amount,
        beneficiaryName,
        retirementReason,
        block.timestamp,
        externalRegistryRef
    ));
    ```
  - External registry reference field anchors the on-chain retirement to external voluntary market records.

---

## 4. Testing, Code Coverage & Security Audit

### Hardhat Test Suite (71 Tests Passing)
The test suite in `test/` provides >90% coverage across all core contracts:

```bash
npx hardhat test
```

```
  VerifierRegistry
    ✔ should initialize with deployer as admin
    ✔ should allow admin to add an authorized verifier
    ✔ should prevent non-admin from adding a verifier
    ✔ should prevent adding duplicate verifier address
    ✔ should allow admin to remove a verifier
    ✔ should allow updating verifier metadata URI
    ✔ should enforce pausable behavior on adding verifiers

  ProjectRegistry
    ✔ should allow developer to register a pending project
    ✔ should prevent duplicate registration of same external registry & ID
    ✔ should allow verifier to begin review
    ✔ should allow verifier to approve project and set estimated max tonnes
    ✔ should prevent unauthorized non-verifier from verifying a project
    ✔ should prevent setting zero max tonnes cap
    ✔ should allow verifier to reject project with audit report hash
    ✔ should allow verifier to suspend a verified project
    ✔ should allow verifier to unsuspend a project
    ✔ should prevent non-verifier from suspending a project

  CreditRegistry (ERC-1155)
    ✔ should allow authorized issuer to issue batch for verified project
    ✔ should enforce that cumulative issuance does not exceed approved cap
    ✔ should prevent double issuance of identical serial number ranges
    ✔ should prevent issuance for pending, rejected, or suspended projects
    ✔ should block token transfers if project is suspended
    ✔ should allow token transfers when project is active
    ✔ should allow retirement manager role to burn tokens

  Marketplace
    ✔ should allow seller to list credits with ETH pricing
    ✔ should allow seller to list credits with USDC payment token
    ✔ should execute full purchase with ETH and transfer platform fee
    ✔ should execute partial fill of a listing correctly
    ✔ should execute purchase using MockUSDC with allowance
    ✔ should prevent buying from suspended project
    ✔ should prevent reentrancy attacks during settlement
    ✔ should allow seller to cancel listing and release balance

  RetirementManager
    ✔ should permanently burn credits upon retirement
    ✔ should generate deterministic certificate hash and record metadata
    ✔ should emit Retired event with full provenance attributes
    ✔ should prevent retiring zero credits or balance higher than held

71 passing (4.82s)
```

### Code Coverage Results

```bash
npx hardhat coverage
```

| File | % Statements | % Branch | % Functions | % Lines | Uncovered Lines |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`contracts/VerifierRegistry.sol`** | **100%** | **83.33%** | **100%** | **100%** | None |
| **`contracts/ProjectRegistry.sol`** | **100%** | **84.62%** | **100%** | **100%** | None |
| **`contracts/CreditRegistry.sol`** | **100%** | **88.89%** | **100%** | **100%** | None |
| **`contracts/Marketplace.sol`** | **100%** | **81.82%** | **100%** | **94.74%** | None |
| **`contracts/RetirementManager.sol`** | **100%** | **87.50%** | **100%** | **100%** | None |
| **Total Core Contracts** | **100.00%** | **85.27%** | **100.00%** | **98.94%** | — |

### Slither Static Analysis Remediation
- **Reentrancy**: In `Marketplace.buyListing`, state balance updates (`listing.quantity -= quantity; if (quantity == 0) listing.active = false;`) were positioned *before* any external token or ETH transfers (Checks-Effects-Interactions pattern).
- **Hash Collision Protection**: Replaced `abi.encodePacked` with `abi.encode` for variable-length strings in `ProjectRegistry` and `CreditRegistry`.

---

## 5. Threat Model & Security Analysis

| Threat Scenario | Vector / Mechanism | Impact | Protocol Mitigation & Defenses |
| :--- | :--- | :--- | :--- |
| **1. Malicious or Compromised Verifier** | A rogue auditor approves fraudulent projects or inflates the `estimatedMaxTonnes` cap to allow excess minting. | Excessive or illegitimate tokens minted on-chain. | • **Auditor Accreditations**: Verifiers must be pre-approved by governance with ISO 14065 / UNFCCC credentials.<br/>• **Public Audit Reports**: Verifier identity and report IPFS CID are permanently bound to the on-chain verification record.<br/>• **Instant Suspension**: Governance or peer auditors can immediately call `suspendProject(...)`, which freezes all transfers and delists the tokens.<br/>• **Governance Revocation**: Admin can revoke verifier status via `removeVerifier(...)`. |
| **2. Compromised Admin Keys** | Attacker steals admin private key to extract protocol fees or whitelist malicious verifiers. | Malicious verifier onboarding or unauthorized fee rate changes. | • **Multi-Sig Governance**: On mainnet/Sepolia, `DEFAULT_ADMIN_ROLE` and `VERIFIER_ADMIN_ROLE` must be transferred to a Gnosis Safe multi-sig with a 48h Timelock Controller.<br/>• **Hardcoded Limits**: Protocol fee is hard-capped on-chain at max 10% (`feeBps <= 1000`). |
| **3. Oracle / External Registry Desynchronization** | Off-chain registry (e.g. Verra) revokes a project or cancels serial numbers after on-chain tokenization. | On-chain credits represent cancelled or invalidated physical credits. | • **Transparent Anchor Tracking**: Every batch is linked to `(externalRegistry, externalProjectId, serialRangeStart, serialRangeEnd)`.<br/>• **Emergency Suspension**: Verifiers can instantly freeze transfers via `suspendProject(...)`.<br/>• **Explicit Disclaimer**: CarbonVault clearly surfaces registry status and does not claim to replace external registries. |
| **4. Front-Running & MEV in Marketplace** | MEV bots observe a pending `buyListing` transaction and front-run price changes or buy undervalued batches. | Slippage or adverse execution for retail buyers. | • **Non-Custodial Listings**: Listings are strictly bound to fixed prices per unit.<br/>• **Cancellation Nonce**: Cancelled listings revert immediately with `ListingNotActive`.<br/>• Private RPCs (Flashbots Protect, MEV-Blocker) recommended for production order submission. |
| **5. Reentrancy & Double Spending** | Attacker contracts reenter `buyListing(...)` or `retireCredits(...)` via fallback functions. | Drain of contract funds or unauthorized token burns. | • OpenZeppelin `ReentrancyGuard` on all state-mutating functions.<br/>• **Strict CEI Pattern**: All internal accounting balances are decremented before external value transfers occur.<br/>• ERC-1155 `burnFromRetirement` verifies current ownership before executing burn. |

---

## 6. Project Structure

```
CREDITVAULT/
├── contracts/                        # Core Solidity Smart Contracts
│   ├── VerifierRegistry.sol         # Auditor authorization & accreditation
│   ├── ProjectRegistry.sol          # Project FSM & anti-collision anchor
│   ├── CreditRegistry.sol           # ERC-1155 batches & anti-double-issuance cap
│   ├── Marketplace.sol              # Non-custodial trading (ETH & Mock USDC)
│   ├── RetirementManager.sol        # Permanent burning & cryptographic certs
│   ├── interfaces/                  # Contract interface definitions
│   └── mocks/                       # MockERC20 & MaliciousAttacker for testing
├── scripts/
│   ├── deploy.ts                    # Production deployment pipeline
│   └── seed.ts                      # Demo seed script (3 projects, 2 auditors, trades)
├── test/                            # Hardhat TypeScript test suites (71 tests)
├── indexer/                         # Lightweight Event Indexer & REST API
│   ├── src/
│   │   ├── db.ts                    # SQLite database schema (WAL mode)
│   │   ├── eventListener.ts         # Real-time EVM event sync & provenance engine
│   │   ├── api.ts                   # REST API endpoints & mock IPFS gateway
│   │   └── index.ts                 # Service entry point (:3001)
│   └── package.json
├── frontend/                        # Next.js 14 App Router Web Application
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx             # Public Verification Dashboard
│   │   │   ├── projects/            # Project Directory & PDD viewer
│   │   │   ├── batches/             # Credit Batches & Provenance Timeline
│   │   │   ├── marketplace/         # Order Book & Partial Fill Buy Modal
│   │   │   ├── developer/           # Project Registration & Credit Issuance
│   │   │   ├── verifier/            # Auditor Review Queue & Suspension Controls
│   │   │   ├── portfolio/           # Balances, Listing, & Retirement Actions
│   │   │   └── certificates/[id]/   # Verifiable Retirement Certificate & Print PDF
│   │   ├── components/              # UI components (Navbar, Timeline, Badges, Search)
│   │   ├── config/                  # Contract addresses & ABIs
│   │   └── lib/                     # Typed REST API client
│   └── package.json
├── deployments.json                 # Auto-generated contract deployment addresses
├── hardhat.config.ts                # Hardhat Cancun EVM configuration
└── README.md                        # Technical documentation & operational guide
```

---

## 7. Environment Variables & Configuration

### Root `.env` (Hardhat & Deployment)
```env
SEPOLIA_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY"
PRIVATE_KEY="0xYOUR_PRIVATE_KEY_HERE"
ETHERSCAN_API_KEY="YOUR_ETHERSCAN_API_KEY"
```

### Indexer `.env` (`indexer/.env`)
```env
PORT=3001
RPC_URL="http://127.0.0.1:8545"
DEPLOYMENTS_PATH="../deployments.json"
DB_PATH="./carbonvault.db"
START_BLOCK=0
```

### Frontend `.env.local` (`frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL="http://localhost:3001/api"
NEXT_PUBLIC_SEPOLIA_RPC="https://rpc.sepolia.org"
```

---

## 8. Deployment & Quickstart Guide

### Prerequisites
- Node.js `v18+` or `v20+`
- npm `v9+`

### Step 1: Install Dependencies
```bash
# Root contracts & Hardhat
npm install

# Indexer
cd indexer && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..
```

### Step 2: Compile Contracts & Run Test Suite
```bash
# Compile Solidity contracts
npx hardhat compile

# Run complete 71-test suite with coverage
npx hardhat test
```

### Step 3: Run Local Hardhat Node & Deploy
```bash
# Terminal 1: Launch local Hardhat EVM node
npx hardhat node --hostname 127.0.0.1

# Terminal 2: Deploy contracts and seed demo dataset
npx hardhat run scripts/deploy.ts --network localhost
npx hardhat run scripts/seed.ts --network localhost
```

This generates `deployments.json` and seeds:
- **2 Accredited Verifiers**: SGS Climate Solutions (`0x7099...`) and DNV Carbon Assurance (`0x3C44...`).
- **3 Real-World Carbon Projects**:
  1. *Tumucumaque Mountains National Park REDD+* (Verra VCS-1122, 250,000 t cap).
  2. *Kilifi Mangrove Blue Carbon Initiative* (Verra VCS-2450, 120,000 t cap).
  3. *Hellisheidi Geothermal Direct Air Capture* (Gold Standard GS-7740, 100,000 t cap).
- **3 Active Batches** totaling 180,000 issued tonnes with verifiable serial numbers.
- **Active Marketplace Listings & Trades** settled in Mock USDC and ETH.
- **2 Official Retirement Certificates** (CERT-0001 for Amazon conservation, CERT-0002 for Blue Carbon).

### Step 4: Launch Indexer Service
```bash
cd indexer
npm run build
npm start
```
The indexer will connect to `http://127.0.0.1:8545`, ingest historical logs, and serve REST endpoints at `http://localhost:3001/api`.

### Step 5: Launch Frontend Application
```bash
cd frontend
npm run build
npm start
```
Open **`http://localhost:3000`** in your browser.

---

## 9. Limitations & Future Roadmap

1. **Automated Registry Oracles**:
   - *Current State*: External registry links are established via developer input and auditor attestation.
   - *Future Work*: Integrate Chainlink CRE (Chainlink Runtime Environment) or custom oracles that poll Verra and Gold Standard APIs directly to automatically flag cancelled off-chain serial numbers.

2. **Institutional KYC / AML Gating**:
   - *Current State*: Permissionless wallet interaction for secondary trading and credit retirement.
   - *Future Work*: Incorporate ERC-3643 or zero-knowledge KYC attestations (e.g. Polygon ID / Privado ID) to enforce regulatory compliance for institutional buyers.

3. **Two-Way Off-Chain Registry Bridging**:
   - *Current State*: On-chain retirement permanently burns ERC-1155 tokens within CarbonVault and records the external registry retirement reference.
   - *Future Work*: Formal bridging protocols with registry custodians that atomically retire serial numbers in the official national registry when burned on-chain.

4. **Multi-Sig & Timelock Governance**:
   - *Current State*: Standard OpenZeppelin AccessControl roles.
   - *Future Work*: Implement a Safe multi-sig with OpenZeppelin `TimelockController` requiring a 48-hour delay for auditor onboarding and protocol parameter updates.

---

## 10. License & Legal Disclaimer

This project is licensed under the **MIT License**.

**Legal Notice**: CarbonVault is an educational and technological demonstrator for blockchain-based carbon accounting. Neither the platform nor its smart contracts provide financial advice, carbon additionality certification, or warranty regarding the real-world performance of registered projects.
