import deploymentsData from "../../deployments.json";

export const CONTRACT_ADDRESSES = {
  verifierRegistry: (deploymentsData?.verifierRegistry || "0x53855A39559b756702d710A8AE26fe07b02C8170") as `0x${string}`,
  projectRegistry: (deploymentsData?.projectRegistry || "0x4325098775c58Ddd6763F100a375197dEf3985C1") as `0x${string}`,
  creditRegistry: (deploymentsData?.creditRegistry || "0xa5c2811146BE07f473743d0521992857c5aB26F4") as `0x${string}`,
  marketplace: (deploymentsData?.marketplace || "0xcdCEf1c3fb8BF2EB439c658a086B155f37112eB2") as `0x${string}`,
  retirementManager: (deploymentsData?.retirementManager || "0xC01c0688D0c567F0C3F229E445A1207e353b0fA9") as `0x${string}`,
  mockUsdc: (deploymentsData?.mockUsdc || "0xDf330D38dd2cd3FC4687126f1d52285792067C2F") as `0x${string}`,
};
export const TARGET_CHAIN_ID = deploymentsData?.chainId || 11155111;
export const TARGET_NETWORK_NAME = deploymentsData?.network || "sepolia";

export const CORE_PRINCIPLE_DISCLAIMER =
  "The blockchain does NOT establish or prove the real-world physical additionality or carbon sequestration of a credit. CarbonVault serves as an immutable, transparent registry that tracks lifecycle events attested by accredited third-party verifiers and anchored to established registries (e.g., Verra, Gold Standard) to eliminate double-issuance and double-retirement.";

// Minimal ABIs for web3 calls
export const PROJECT_REGISTRY_ABI = [
  {
    name: "registerProject",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "methodology", type: "string" },
      { name: "country", type: "string" },
      { name: "vintageStart", type: "uint16" },
      { name: "vintageEnd", type: "uint16" },
      { name: "externalRegistry", type: "string" },
      { name: "externalProjectId", type: "string" },
      { name: "ipfsDocumentHash", type: "string" },
    ],
    outputs: [{ name: "projectId", type: "uint256" }],
  },
  {
    name: "verifyProject",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "projectId", type: "uint256" },
      { name: "reportHash", type: "string" },
      { name: "estimatedMaxTonnes", type: "uint256" },
      { name: "comments", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "suspendProject",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "projectId", type: "uint256" },
      { name: "reason", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "unsuspendProject",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "projectId", type: "uint256" },
      { name: "reason", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "startReview",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "projectId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "rejectProject",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "projectId", type: "uint256" },
      { name: "reportHash", type: "string" },
      { name: "comments", type: "string" },
    ],
    outputs: [],
  },
] as const;

export const VERIFIER_REGISTRY_ABI = [
  {
    name: "isVerifier",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "getVerifier",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      {
        components: [
          { name: "verifierAddress", type: "address" },
          { name: "name", type: "string" },
          { name: "accreditationRef", type: "string" },
          { name: "metadataURI", type: "string" },
          { name: "active", type: "bool" },
          { name: "addedAt", type: "uint256" },
        ],
        name: "",
        type: "tuple",
      },
    ],
  },
] as const;

export const CREDIT_REGISTRY_ABI = [
  {
    name: "issueBatch",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "projectId", type: "uint256" },
      { name: "vintage", type: "uint16" },
      { name: "quantity", type: "uint256" },
      { name: "serialNumberStart", type: "string" },
      { name: "serialNumberEnd", type: "string" },
      { name: "ipfsIssuanceProof", type: "string" },
      { name: "recipient", type: "address" },
    ],
    outputs: [{ name: "batchId", type: "uint256" }],
  },
  {
    name: "setApprovalForAll",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "isApprovedForAll",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const MARKETPLACE_ABI = [
  {
    name: "createListing",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "batchId", type: "uint256" },
      { name: "quantity", type: "uint256" },
      { name: "pricePerUnit", type: "uint256" },
      { name: "paymentToken", type: "address" },
    ],
    outputs: [{ name: "listingId", type: "uint256" }],
  },
  {
    name: "buyListing",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "listingId", type: "uint256" },
      { name: "quantity", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "cancelListing",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [],
  },
] as const;

export const RETIREMENT_MANAGER_ABI = [
  {
    name: "retireCredits",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "batchId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "beneficiaryName", type: "string" },
      { name: "retirementReason", type: "string" },
      { name: "externalRegistryRef", type: "string" },
    ],
    outputs: [{ name: "retirementId", type: "uint256" }],
  },
] as const;

export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
