import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initDatabase } from "./db";
import { apiRouter } from "./api";
import { CarbonVaultEventListener } from "./eventListener";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Mount API routes
app.use("/api", apiRouter);

// Initialize DB and launch listener
async function main() {
  console.log("=================================================");
  console.log("⚡ Starting CarbonVault Event Indexer & REST API");
  console.log("=================================================");

  initDatabase();
  console.log("✓ SQLite database initialized.");

  const listener = new CarbonVaultEventListener();

  // Try initial sync
  try {
    await listener.syncAll();
  } catch (err: any) {
    console.warn(`Initial sync deferred (RPC not yet active or node restarting): ${err.message}`);
  }

  // Periodic polling sync every 6 seconds to catch new blocks / events
  setInterval(async () => {
    try {
      await listener.syncAll();
    } catch (err) {
      // quiet poll error
    }
  }, 6000);

  app.listen(PORT, () => {
    console.log(`🚀 CarbonVault REST API listening on http://localhost:${PORT}`);
    console.log(`📊 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`📈 Protocol Stats: http://localhost:${PORT}/api/stats`);
    console.log(`🔎 Universal Search: http://localhost:${PORT}/api/search?q=Amazon`);
    console.log(`📜 Projects Explorer: http://localhost:${PORT}/api/projects`);
    console.log(`🏷️ Credit Batches: http://localhost:${PORT}/api/batches`);
    console.log(`🛒 Marketplace Listings: http://localhost:${PORT}/api/listings`);
    console.log(`🏅 Retirement Certificates: http://localhost:${PORT}/api/retirements`);
    console.log("=================================================");
  });
}

main().catch((err) => {
  console.error("Fatal error starting indexer:", err);
  process.exit(1);
});
