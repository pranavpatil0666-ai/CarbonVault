import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";
import {
  VerifierRecord,
  ProjectRecord,
  BatchRecord,
  TokenBalanceRecord,
  ListingRecord,
  TradeRecord,
  RetirementRecord,
  TimelineEventRecord,
  GlobalStats,
} from "./types";

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, "../carbonvault.db");

// Ensure directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS verifiers (
      address TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      accreditation_ref TEXT NOT NULL,
      metadata_uri TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      added_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      project_id INTEGER PRIMARY KEY,
      developer TEXT NOT NULL,
      name TEXT NOT NULL,
      methodology TEXT NOT NULL,
      country TEXT NOT NULL,
      vintage_start INTEGER NOT NULL,
      vintage_end INTEGER NOT NULL,
      external_registry TEXT NOT NULL,
      external_project_id TEXT NOT NULL,
      ipfs_document_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      registered_at INTEGER NOT NULL,
      verifier TEXT,
      report_hash TEXT,
      estimated_max_tonnes TEXT,
      estimated_max_tonnes_num REAL DEFAULT 0,
      verification_comments TEXT,
      verified_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS credit_batches (
      batch_id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL,
      vintage INTEGER NOT NULL,
      quantity_issued TEXT NOT NULL,
      quantity_issued_tonnes REAL NOT NULL,
      serial_number_start TEXT NOT NULL,
      serial_number_end TEXT NOT NULL,
      ipfs_issuance_proof TEXT,
      recipient TEXT NOT NULL,
      issued_at INTEGER NOT NULL,
      total_retired TEXT DEFAULT '0',
      total_retired_tonnes REAL DEFAULT 0,
      FOREIGN KEY(project_id) REFERENCES projects(project_id)
    );

    CREATE TABLE IF NOT EXISTS token_balances (
      account TEXT NOT NULL,
      batch_id INTEGER NOT NULL,
      balance TEXT NOT NULL,
      balance_tonnes REAL NOT NULL,
      PRIMARY KEY (account, batch_id)
    );

    CREATE TABLE IF NOT EXISTS listings (
      listing_id INTEGER PRIMARY KEY,
      seller TEXT NOT NULL,
      batch_id INTEGER NOT NULL,
      quantity TEXT NOT NULL,
      quantity_tonnes REAL NOT NULL,
      price_per_unit TEXT NOT NULL,
      price_per_unit_formatted REAL NOT NULL,
      payment_token TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(batch_id) REFERENCES credit_batches(batch_id)
    );

    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER NOT NULL,
      buyer TEXT NOT NULL,
      batch_id INTEGER NOT NULL,
      quantity TEXT NOT NULL,
      quantity_tonnes REAL NOT NULL,
      total_price TEXT NOT NULL,
      total_price_formatted REAL NOT NULL,
      platform_fee TEXT NOT NULL,
      payment_token TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      tx_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS retirements (
      retirement_id INTEGER PRIMARY KEY,
      retiree TEXT NOT NULL,
      beneficiary_name TEXT NOT NULL,
      retirement_reason TEXT NOT NULL,
      batch_id INTEGER NOT NULL,
      amount TEXT NOT NULL,
      amount_tonnes REAL NOT NULL,
      timestamp INTEGER NOT NULL,
      external_registry_ref TEXT,
      certificate_hash TEXT NOT NULL,
      tx_hash TEXT NOT NULL,
      FOREIGN KEY(batch_id) REFERENCES credit_batches(batch_id)
    );

    CREATE TABLE IF NOT EXISTS audit_timeline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER,
      project_id INTEGER,
      event_type TEXT NOT NULL,
      actor TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      data_json TEXT,
      timestamp INTEGER NOT NULL,
      tx_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      contract_name TEXT PRIMARY KEY,
      last_synced_block INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    CREATE INDEX IF NOT EXISTS idx_batches_project ON credit_batches(project_id);
    CREATE INDEX IF NOT EXISTS idx_timeline_batch ON audit_timeline(batch_id);
    CREATE INDEX IF NOT EXISTS idx_timeline_project ON audit_timeline(project_id);
    CREATE INDEX IF NOT EXISTS idx_listings_active ON listings(active);
    CREATE INDEX IF NOT EXISTS idx_retirements_batch ON retirements(batch_id);
    CREATE INDEX IF NOT EXISTS idx_retirements_retiree ON retirements(retiree);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_timeline_unique ON audit_timeline(tx_hash, event_type, title);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_trades_unique ON trades(tx_hash, listing_id);
  `);
}

// ----------------------------------------------------------------------------
// DB Operations
// ----------------------------------------------------------------------------

export const dbOps = {
  // Verifiers
  upsertVerifier(v: VerifierRecord) {
    const stmt = db.prepare(`
      INSERT INTO verifiers (address, name, accreditation_ref, metadata_uri, active, added_at, updated_at)
      VALUES (@address, @name, @accreditation_ref, @metadata_uri, @active, @added_at, @updated_at)
      ON CONFLICT(address) DO UPDATE SET
        name = excluded.name,
        accreditation_ref = excluded.accreditation_ref,
        metadata_uri = excluded.metadata_uri,
        active = excluded.active,
        updated_at = excluded.updated_at
    `);
    stmt.run(v);
  },

  getAllVerifiers(): VerifierRecord[] {
    return db.prepare("SELECT * FROM verifiers ORDER BY added_at DESC").all() as VerifierRecord[];
  },

  getVerifier(address: string): VerifierRecord | undefined {
    return db.prepare("SELECT * FROM verifiers WHERE LOWER(address) = LOWER(?)").get(address) as VerifierRecord | undefined;
  },

  // Projects
  insertProject(p: ProjectRecord) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO projects (
        project_id, developer, name, methodology, country, vintage_start, vintage_end,
        external_registry, external_project_id, ipfs_document_hash, status, registered_at
      ) VALUES (
        @project_id, @developer, @name, @methodology, @country, @vintage_start, @vintage_end,
        @external_registry, @external_project_id, @ipfs_document_hash, @status, @registered_at
      )
    `);
    stmt.run(p);
  },

  updateProjectStatus(
    projectId: number,
    status: string,
    verifier?: string,
    reportHash?: string,
    estimatedMaxTonnes?: string,
    estimatedMaxTonnesNum?: number,
    comments?: string,
    verifiedAt?: number
  ) {
    const stmt = db.prepare(`
      UPDATE projects SET
        status = ?,
        verifier = COALESCE(?, verifier),
        report_hash = COALESCE(?, report_hash),
        estimated_max_tonnes = COALESCE(?, estimated_max_tonnes),
        estimated_max_tonnes_num = COALESCE(?, estimated_max_tonnes_num),
        verification_comments = COALESCE(?, verification_comments),
        verified_at = COALESCE(?, verified_at)
      WHERE project_id = ?
    `);
    stmt.run(
      status,
      verifier || null,
      reportHash || null,
      estimatedMaxTonnes || null,
      estimatedMaxTonnesNum || null,
      comments || null,
      verifiedAt || null,
      projectId
    );
  },

  getProjects(status?: string): ProjectRecord[] {
    if (status) {
      return db.prepare("SELECT * FROM projects WHERE status = ? ORDER BY project_id DESC").all(status) as ProjectRecord[];
    }
    return db.prepare("SELECT * FROM projects ORDER BY project_id DESC").all() as ProjectRecord[];
  },

  getProject(id: number): ProjectRecord | undefined {
    return db.prepare("SELECT * FROM projects WHERE project_id = ?").get(id) as ProjectRecord | undefined;
  },

  // Batches
  insertBatch(b: BatchRecord) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO credit_batches (
        batch_id, project_id, vintage, quantity_issued, quantity_issued_tonnes,
        serial_number_start, serial_number_end, ipfs_issuance_proof, recipient,
        issued_at, total_retired, total_retired_tonnes
      ) VALUES (
        @batch_id, @project_id, @vintage, @quantity_issued, @quantity_issued_tonnes,
        @serial_number_start, @serial_number_end, @ipfs_issuance_proof, @recipient,
        @issued_at, @total_retired, @total_retired_tonnes
      )
    `);
    stmt.run(b);
  },

  updateBatchRetired(batchId: number, retiredAmountWei: string, retiredAmountTonnes: number) {
    const stmt = db.prepare(`
      UPDATE credit_batches SET
        total_retired = ?,
        total_retired_tonnes = ?
      WHERE batch_id = ?
    `);
    stmt.run(retiredAmountWei, retiredAmountTonnes, batchId);
  },

  getBatches(): BatchRecord[] {
    return db.prepare("SELECT * FROM credit_batches ORDER BY batch_id DESC").all() as BatchRecord[];
  },

  getBatch(batchId: number): BatchRecord | undefined {
    return db.prepare("SELECT * FROM credit_batches WHERE batch_id = ?").get(batchId) as BatchRecord | undefined;
  },

  getBatchesByProject(projectId: number): BatchRecord[] {
    return db.prepare("SELECT * FROM credit_batches WHERE project_id = ? ORDER BY vintage ASC").all(projectId) as BatchRecord[];
  },

  // Token Balances
  updateBalance(account: string, batchId: number, balanceWei: string, balanceTonnes: number) {
    const stmt = db.prepare(`
      INSERT INTO token_balances (account, batch_id, balance, balance_tonnes)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(account, batch_id) DO UPDATE SET
        balance = excluded.balance,
        balance_tonnes = excluded.balance_tonnes
    `);
    stmt.run(account.toLowerCase(), batchId, balanceWei, balanceTonnes);
  },

  getBalancesForBatch(batchId: number): TokenBalanceRecord[] {
    return db.prepare(`
      SELECT * FROM token_balances
      WHERE batch_id = ? AND balance_tonnes > 0
      ORDER BY balance_tonnes DESC
    `).all(batchId) as TokenBalanceRecord[];
  },

  getBalancesForAccount(account: string): TokenBalanceRecord[] {
    return db.prepare(`
      SELECT * FROM token_balances
      WHERE LOWER(account) = LOWER(?) AND balance_tonnes > 0
    `).all(account) as TokenBalanceRecord[];
  },

  // Listings
  upsertListing(l: ListingRecord) {
    const stmt = db.prepare(`
      INSERT INTO listings (
        listing_id, seller, batch_id, quantity, quantity_tonnes,
        price_per_unit, price_per_unit_formatted, payment_token, active, created_at, updated_at
      ) VALUES (
        @listing_id, @seller, @batch_id, @quantity, @quantity_tonnes,
        @price_per_unit, @price_per_unit_formatted, @payment_token, @active, @created_at, @updated_at
      )
      ON CONFLICT(listing_id) DO UPDATE SET
        quantity = excluded.quantity,
        quantity_tonnes = excluded.quantity_tonnes,
        price_per_unit = excluded.price_per_unit,
        price_per_unit_formatted = excluded.price_per_unit_formatted,
        active = excluded.active,
        updated_at = excluded.updated_at
    `);
    stmt.run(l);
  },

  getActiveListings(): (ListingRecord & { project_name: string; vintage: number; country: string })[] {
    return db.prepare(`
      SELECT l.*, p.name as project_name, b.vintage, p.country
      FROM listings l
      JOIN credit_batches b ON l.batch_id = b.batch_id
      JOIN projects p ON b.project_id = p.project_id
      WHERE l.active = 1 AND l.quantity_tonnes > 0
      ORDER BY l.listing_id DESC
    `).all() as any[];
  },

  getListing(id: number): ListingRecord | undefined {
    return db.prepare("SELECT * FROM listings WHERE listing_id = ?").get(id) as ListingRecord | undefined;
  },

  // Trades
  insertTrade(t: TradeRecord) {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO trades (
        listing_id, buyer, batch_id, quantity, quantity_tonnes,
        total_price, total_price_formatted, platform_fee, payment_token, timestamp, tx_hash
      ) VALUES (
        @listing_id, @buyer, @batch_id, @quantity, @quantity_tonnes,
        @total_price, @total_price_formatted, @platform_fee, @payment_token, @timestamp, @tx_hash
      )
    `);
    stmt.run(t);
  },

  getTrades(limit = 50): TradeRecord[] {
    return db.prepare("SELECT * FROM trades ORDER BY timestamp DESC LIMIT ?").all(limit) as TradeRecord[];
  },

  // Retirements
  insertRetirement(r: RetirementRecord) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO retirements (
        retirement_id, retiree, beneficiary_name, retirement_reason,
        batch_id, amount, amount_tonnes, timestamp, external_registry_ref, certificate_hash, tx_hash
      ) VALUES (
        @retirement_id, @retiree, @beneficiary_name, @retirement_reason,
        @batch_id, @amount, @amount_tonnes, @timestamp, @external_registry_ref, @certificate_hash, @tx_hash
      )
    `);
    stmt.run(r);
  },

  getRetirements(): (RetirementRecord & { project_name: string; vintage: number })[] {
    return db.prepare(`
      SELECT r.*, p.name as project_name, b.vintage
      FROM retirements r
      JOIN credit_batches b ON r.batch_id = b.batch_id
      JOIN projects p ON b.project_id = p.project_id
      ORDER BY r.retirement_id DESC
    `).all() as any[];
  },

  getRetirement(id: number): (RetirementRecord & { project_name: string; methodology: string; vintage: number; country: string }) | undefined {
    return db.prepare(`
      SELECT r.*, p.name as project_name, p.methodology, b.vintage, p.country, p.external_registry, p.external_project_id
      FROM retirements r
      JOIN credit_batches b ON r.batch_id = b.batch_id
      JOIN projects p ON b.project_id = p.project_id
      WHERE r.retirement_id = ?
    `).get(id) as any;
  },

  // Timeline
  insertTimelineEvent(e: TimelineEventRecord) {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO audit_timeline (
        batch_id, project_id, event_type, actor, title, description, data_json, timestamp, tx_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      e.batch_id ?? null,
      e.project_id ?? null,
      e.event_type,
      e.actor,
      e.title,
      e.description,
      e.data_json,
      e.timestamp,
      e.tx_hash
    );
  },

  getTimelineForBatch(batchId: number): TimelineEventRecord[] {
    // Get project ID for this batch
    const batch = db.prepare("SELECT project_id FROM credit_batches WHERE batch_id = ?").get(batchId) as { project_id: number } | undefined;
    const projectId = batch?.project_id;

    if (projectId) {
      return db.prepare(`
        SELECT * FROM audit_timeline
        WHERE batch_id = ? OR (project_id = ? AND batch_id IS NULL)
        ORDER BY timestamp ASC, id ASC
      `).all(batchId, projectId) as TimelineEventRecord[];
    }

    return db.prepare(`
      SELECT * FROM audit_timeline
      WHERE batch_id = ?
      ORDER BY timestamp ASC, id ASC
    `).all(batchId) as TimelineEventRecord[];
  },

  getTimelineForProject(projectId: number): TimelineEventRecord[] {
    return db.prepare(`
      SELECT * FROM audit_timeline
      WHERE project_id = ?
      ORDER BY timestamp ASC, id ASC
    `).all(projectId) as TimelineEventRecord[];
  },

  // Global Search
  search(query: string) {
    const q = `%${query.trim()}%`;
    const num = Number(query.trim());
    const isNum = !isNaN(num);

    const projects = db.prepare(`
      SELECT * FROM projects
      WHERE name LIKE ?
         OR external_project_id LIKE ?
         OR external_registry LIKE ?
         OR country LIKE ?
         OR methodology LIKE ?
         OR LOWER(developer) = LOWER(?)
         ${isNum ? "OR project_id = ?" : ""}
      LIMIT 10
    `).all(isNum ? [q, q, q, q, q, query.trim(), num] : [q, q, q, q, q, query.trim()]) as ProjectRecord[];

    const batches = db.prepare(`
      SELECT b.*, p.name as project_name, p.country, p.external_registry
      FROM credit_batches b
      JOIN projects p ON b.project_id = p.project_id
      WHERE serial_number_start LIKE ?
         OR serial_number_end LIKE ?
         ${isNum ? "OR b.batch_id = ? OR b.vintage = ?" : ""}
      LIMIT 10
    `).all(isNum ? [q, q, num, num] : [q, q]) as any[];

    const retirements = db.prepare(`
      SELECT r.*, p.name as project_name
      FROM retirements r
      JOIN credit_batches b ON r.batch_id = b.batch_id
      JOIN projects p ON b.project_id = p.project_id
      WHERE beneficiary_name LIKE ?
         OR external_registry_ref LIKE ?
         OR LOWER(retiree) = LOWER(?)
         ${isNum ? "OR retirement_id = ?" : ""}
      LIMIT 10
    `).all(isNum ? [q, q, query.trim(), num] : [q, q, query.trim()]) as any[];

    return { projects, batches, retirements };
  },

  // Stats
  getStats(): GlobalStats {
    const totalProjects = (db.prepare("SELECT COUNT(*) as c FROM projects").get() as any).c;
    const verifiedProjects = (db.prepare("SELECT COUNT(*) as c FROM projects WHERE status = 'Verified'").get() as any).c;

    const tonnesRow = db.prepare(`
      SELECT
        COALESCE(SUM(quantity_issued_tonnes), 0) as issued,
        COALESCE(SUM(total_retired_tonnes), 0) as retired
      FROM credit_batches
    `).get() as any;

    const totalTonnesIssued = tonnesRow.issued;
    const totalTonnesRetired = tonnesRow.retired;
    const activeCreditsInCirculation = Math.max(0, totalTonnesIssued - totalTonnesRetired);

    const activeListingsCount = (db.prepare("SELECT COUNT(*) as c FROM listings WHERE active = 1 AND quantity_tonnes > 0").get() as any).c;
    const totalTradesCount = (db.prepare("SELECT COUNT(*) as c FROM trades").get() as any).c;

    const volumeEthRow = db.prepare("SELECT COALESCE(SUM(total_price_formatted), 0) as v FROM trades WHERE payment_token = '0x0000000000000000000000000000000000000000'").get() as any;
    const volumeUsdcRow = db.prepare("SELECT COALESCE(SUM(total_price_formatted), 0) as v FROM trades WHERE payment_token != '0x0000000000000000000000000000000000000000'").get() as any;

    const totalVerifiersCount = (db.prepare("SELECT COUNT(*) as c FROM verifiers WHERE active = 1").get() as any).c;

    return {
      totalProjects,
      verifiedProjects,
      totalTonnesIssued,
      totalTonnesRetired,
      activeCreditsInCirculation,
      activeListingsCount,
      totalTradesCount,
      totalTradeVolumeEth: volumeEthRow.v,
      totalTradeVolumeUsdc: volumeUsdcRow.v,
      totalVerifiersCount,
    };
  },
};
