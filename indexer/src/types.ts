export interface VerifierRecord {
  address: string;
  name: string;
  accreditation_ref: string;
  metadata_uri: string;
  active: number; // 0 or 1
  added_at: number;
  updated_at: number;
}

export interface ProjectRecord {
  project_id: number;
  developer: string;
  name: string;
  methodology: string;
  country: string;
  vintage_start: number;
  vintage_end: number;
  external_registry: string;
  external_project_id: string;
  ipfs_document_hash: string;
  status: "Pending" | "UnderReview" | "Verified" | "Rejected" | "Suspended";
  registered_at: number;
  verifier?: string;
  report_hash?: string;
  estimated_max_tonnes?: string;
  estimated_max_tonnes_num?: number;
  verification_comments?: string;
  verified_at?: number;
}

export interface BatchRecord {
  batch_id: number;
  project_id: number;
  vintage: number;
  quantity_issued: string;
  quantity_issued_tonnes: number;
  serial_number_start: string;
  serial_number_end: string;
  ipfs_issuance_proof: string;
  recipient: string;
  issued_at: number;
  total_retired: string;
  total_retired_tonnes: number;
}

export interface TokenBalanceRecord {
  account: string;
  batch_id: number;
  balance: string;
  balance_tonnes: number;
}

export interface ListingRecord {
  listing_id: number;
  seller: string;
  batch_id: number;
  quantity: string;
  quantity_tonnes: number;
  price_per_unit: string;
  price_per_unit_formatted: number;
  payment_token: string;
  active: number; // 0 or 1
  created_at: number;
  updated_at: number;
}

export interface TradeRecord {
  id?: number;
  listing_id: number;
  buyer: string;
  batch_id: number;
  quantity: string;
  quantity_tonnes: number;
  total_price: string;
  total_price_formatted: number;
  platform_fee: string;
  payment_token: string;
  timestamp: number;
  tx_hash: string;
}

export interface RetirementRecord {
  retirement_id: number;
  retiree: string;
  beneficiary_name: string;
  retirement_reason: string;
  batch_id: number;
  amount: string;
  amount_tonnes: number;
  timestamp: number;
  external_registry_ref: string;
  certificate_hash: string;
  tx_hash: string;
}

export interface TimelineEventRecord {
  id?: number;
  batch_id?: number | null;
  project_id?: number | null;
  event_type:
    | "ProjectRegistered"
    | "ProjectUnderReview"
    | "ProjectVerified"
    | "ProjectRejected"
    | "ProjectSuspended"
    | "ProjectUnsuspended"
    | "BatchIssued"
    | "ListingCreated"
    | "TradeExecuted"
    | "ListingCancelled"
    | "ListingPriceUpdated"
    | "CreditsRetired"
    | "TokenTransferred";
  actor: string;
  title: string;
  description: string;
  data_json: string;
  timestamp: number;
  tx_hash: string;
}

export interface GlobalStats {
  totalProjects: number;
  verifiedProjects: number;
  totalTonnesIssued: number;
  totalTonnesRetired: number;
  activeCreditsInCirculation: number;
  activeListingsCount: number;
  totalTradesCount: number;
  totalTradeVolumeEth: number;
  totalTradeVolumeUsdc: number;
  totalVerifiersCount: number;
}
