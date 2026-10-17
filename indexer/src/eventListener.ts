import { ethers } from "ethers";
import * as path from "path";
import * as fs from "fs";
import { dbOps } from "./db";

// Load deployments
const deploymentsPath = path.join(__dirname, "../../deployments.json");
if (!fs.existsSync(deploymentsPath)) {
  console.warn("⚠️ Warning: deployments.json not found. Run deploy/seed script first.");
}

function loadArtifact(contractName: string): any {
  const artifactPath = path.join(
    __dirname,
    `../../artifacts/contracts/${contractName}.sol/${contractName}.json`
  );
  if (fs.existsSync(artifactPath)) {
    return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  }
  throw new Error(`Artifact not found for ${contractName}`);
}

function parseTonnesFromRaw(raw: bigint | string | number): number {
  if (raw === undefined || raw === null) return 0;
  const b = BigInt(raw.toString());
  if (b >= 100000000000000n) {
    return Number(ethers.formatEther(b));
  }
  return Number(b);
}

function parsePriceFromRaw(rawPrice: bigint | string | number, paymentToken: string): number {
  if (rawPrice === undefined || rawPrice === null) return 0;
  const b = BigInt(rawPrice.toString());
  const isEth = paymentToken === ethers.ZeroAddress || paymentToken === "0x0000000000000000000000000000000000000000";
  if (isEth) {
    return Number(ethers.formatEther(b));
  }
  if (b >= 100000000000000n) {
    return Number(ethers.formatEther(b));
  }
  return Number(b) / 1e6;
}

export class CarbonVaultEventListener {
  private provider: ethers.JsonRpcProvider;
  private deployment: any;
  private isListening = false;
  private lastSyncedBlock: number | null = null;

  constructor(rpcUrl?: string) {
    let url = rpcUrl || process.env.RPC_URL;
    if (!url) {
      const dep = this.getDeployment();
      if (dep && (dep.chainId === 11155111 || dep.network === "sepolia")) {
        url = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
      } else {
        url = "http://127.0.0.1:8545";
      }
    }
    this.provider = new ethers.JsonRpcProvider(url);
  }

  public getDeployment(): any {
    if (!this.deployment && fs.existsSync(deploymentsPath)) {
      this.deployment = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
    }
    return this.deployment;
  }

  public async syncAll(fromBlock?: number): Promise<void> {
    const deployment = this.getDeployment();
    if (!deployment) {
      console.warn("Cannot sync events: deployments.json not found.");
      return;
    }

    const currentBlock = await this.provider.getBlockNumber();
    const startFrom = fromBlock !== undefined 
      ? fromBlock 
      : (this.lastSyncedBlock !== null ? this.lastSyncedBlock + 1 : (deployment.startBlock || 0));

    if (startFrom > currentBlock) {
      return;
    }

    console.log(`📡 Syncing CarbonVault contracts from block ${startFrom} to ${currentBlock}...`);

    await this.syncVerifierRegistry(deployment.verifierRegistry, startFrom, currentBlock);
    await this.syncProjectRegistry(deployment.projectRegistry, startFrom, currentBlock);
    await this.syncCreditRegistry(deployment.creditRegistry, startFrom, currentBlock);
    await this.syncMarketplace(deployment.marketplace, startFrom, currentBlock);
    await this.syncRetirementManager(deployment.retirementManager, startFrom, currentBlock);

    this.lastSyncedBlock = currentBlock;
    console.log(`✅ CarbonVault historical sync complete up to block ${currentBlock}.`);
  }

  private async syncVerifierRegistry(address: string, fromBlock: number, toBlock: number) {
    const artifact = loadArtifact("VerifierRegistry");
    const contract = new ethers.Contract(address, artifact.abi, this.provider);

    // VerifierAdded
    const addedFilter = contract.filters.VerifierAdded();
    const addedEvents = await contract.queryFilter(addedFilter, fromBlock, toBlock);
    for (const event of addedEvents) {
      const e = event as ethers.EventLog;
      const [verifierAddress, name, accreditationRef, metadataURI, timestamp] = e.args;
      const ts = Number(timestamp);

      dbOps.upsertVerifier({
        address: verifierAddress,
        name,
        accreditation_ref: accreditationRef,
        metadata_uri: metadataURI,
        active: 1,
        added_at: ts,
        updated_at: ts,
      });

      dbOps.insertTimelineEvent({
        event_type: "ProjectUnderReview", // auditor authorized
        actor: verifierAddress,
        title: `Verifier Accredited: ${name}`,
        description: `Independent auditor accredited (${accreditationRef}). Credentials anchored on-chain.`,
        data_json: JSON.stringify({ verifierAddress, name, accreditationRef, metadataURI }),
        timestamp: ts,
        tx_hash: e.transactionHash,
      });
    }

    // VerifierUpdated
    const updatedFilter = contract.filters.VerifierUpdated();
    const updatedEvents = await contract.queryFilter(updatedFilter, fromBlock, toBlock);
    for (const event of updatedEvents) {
      const e = event as ethers.EventLog;
      const [verifierAddress, active, metadataURI, timestamp] = e.args;
      const existing = dbOps.getVerifier(verifierAddress);
      if (existing) {
        dbOps.upsertVerifier({
          ...existing,
          active: active ? 1 : 0,
          metadata_uri: metadataURI,
          updated_at: Number(timestamp),
        });
      }
    }

    // VerifierRemoved
    const removedFilter = contract.filters.VerifierRemoved();
    const removedEvents = await contract.queryFilter(removedFilter, fromBlock, toBlock);
    for (const event of removedEvents) {
      const e = event as ethers.EventLog;
      const [verifierAddress, timestamp] = e.args;
      const existing = dbOps.getVerifier(verifierAddress);
      if (existing) {
        dbOps.upsertVerifier({
          ...existing,
          active: 0,
          updated_at: Number(timestamp),
        });
      }
    }
  }

  private async syncProjectRegistry(address: string, fromBlock: number, toBlock: number) {
    const artifact = loadArtifact("ProjectRegistry");
    const contract = new ethers.Contract(address, artifact.abi, this.provider);

    // ProjectRegistered
    const regFilter = contract.filters.ProjectRegistered();
    const regEvents = await contract.queryFilter(regFilter, fromBlock, toBlock);
    for (const event of regEvents) {
      const e = event as ethers.EventLog;
      const [projectId, developer, name, externalRegistry, externalProjectId, ipfsDocumentHash, timestamp] = e.args;
      const pId = Number(projectId);
      const ts = Number(timestamp);

      // Fetch on-chain project struct for extra fields (country, methodology, vintageStart, vintageEnd)
      let methodology = "Unknown";
      let country = "Unknown";
      let vintageStart = 2020;
      let vintageEnd = 2030;
      try {
        const onChainProj = await contract.getProject(pId);
        methodology = onChainProj.methodology;
        country = onChainProj.country;
        vintageStart = Number(onChainProj.vintageStart);
        vintageEnd = Number(onChainProj.vintageEnd);
      } catch (err) {
        console.warn(`Could not read on-chain project ${pId}:`, err);
      }

      dbOps.insertProject({
        project_id: pId,
        developer,
        name,
        methodology,
        country,
        vintage_start: vintageStart,
        vintage_end: vintageEnd,
        external_registry: externalRegistry,
        external_project_id: externalProjectId,
        ipfs_document_hash: ipfsDocumentHash,
        status: "Pending",
        registered_at: ts,
      });

      dbOps.insertTimelineEvent({
        project_id: pId,
        event_type: "ProjectRegistered",
        actor: developer,
        title: `Project Registered: ${name}`,
        description: `Project registered and anchored to ${externalRegistry} (${externalProjectId}). PDD submitted to IPFS.`,
        data_json: JSON.stringify({ externalRegistry, externalProjectId, ipfsDocumentHash, country, methodology }),
        timestamp: ts,
        tx_hash: e.transactionHash,
      });
    }

    // ProjectUnderReview
    const reviewFilter = contract.filters.ProjectUnderReview();
    const reviewEvents = await contract.queryFilter(reviewFilter, fromBlock, toBlock);
    for (const event of reviewEvents) {
      const e = event as ethers.EventLog;
      const [projectId, verifier, timestamp] = e.args;
      const pId = Number(projectId);
      const ts = Number(timestamp);

      dbOps.updateProjectStatus(pId, "UnderReview", verifier);

      const verifierObj = dbOps.getVerifier(verifier);
      const vName = verifierObj?.name || verifier;

      dbOps.insertTimelineEvent({
        project_id: pId,
        event_type: "ProjectUnderReview",
        actor: verifier,
        title: `Under Review by ${vName}`,
        description: `Independent verifier ${vName} commenced technical validation & PDD audit.`,
        data_json: JSON.stringify({ verifier, vName }),
        timestamp: ts,
        tx_hash: e.transactionHash,
      });
    }

    // ProjectVerified
    const verifiedFilter = contract.filters.ProjectVerified();
    const verifiedEvents = await contract.queryFilter(verifiedFilter, fromBlock, toBlock);
    for (const event of verifiedEvents) {
      const e = event as ethers.EventLog;
      const [projectId, verifier, reportHash, estimatedMaxTonnes, timestamp] = e.args;
      const pId = Number(projectId);
      const ts = Number(timestamp);
      const maxTonnesStr = estimatedMaxTonnes.toString();
      const maxTonnesNum = parseTonnesFromRaw(estimatedMaxTonnes);

      dbOps.updateProjectStatus(
        pId,
        "Verified",
        verifier,
        reportHash,
        maxTonnesStr,
        maxTonnesNum,
        "Auditor approved verification",
        ts
      );

      const verifierObj = dbOps.getVerifier(verifier);
      const vName = verifierObj?.name || verifier;

      dbOps.insertTimelineEvent({
        project_id: pId,
        event_type: "ProjectVerified",
        actor: verifier,
        title: `Project Verified & Cap Approved (${maxTonnesNum.toLocaleString()} tonnes)`,
        description: `Auditor ${vName} certified project eligibility and approved a lifetime issuance cap of ${maxTonnesNum.toLocaleString()} tonnes CO2e.`,
        data_json: JSON.stringify({ verifier, vName, reportHash, maxTonnesNum }),
        timestamp: ts,
        tx_hash: e.transactionHash,
      });
    }

    // ProjectSuspended
    const suspendedFilter = contract.filters.ProjectSuspended();
    const suspendedEvents = await contract.queryFilter(suspendedFilter, fromBlock, toBlock);
    for (const event of suspendedEvents) {
      const e = event as ethers.EventLog;
      const [projectId, actor, reason, timestamp] = e.args;
      const pId = Number(projectId);
      const ts = Number(timestamp);

      dbOps.updateProjectStatus(pId, "Suspended");

      dbOps.insertTimelineEvent({
        project_id: pId,
        event_type: "ProjectSuspended",
        actor,
        title: `Project Suspended`,
        description: `Project suspended due to: "${reason}". Transfers and new trading are locked.`,
        data_json: JSON.stringify({ actor, reason }),
        timestamp: ts,
        tx_hash: e.transactionHash,
      });
    }

    // ProjectUnsuspended
    const unsuspendedFilter = contract.filters.ProjectUnsuspended();
    const unsuspendedEvents = await contract.queryFilter(unsuspendedFilter, fromBlock, toBlock);
    for (const event of unsuspendedEvents) {
      const e = event as ethers.EventLog;
      const [projectId, actor, reason, timestamp] = e.args;
      const pId = Number(projectId);
      const ts = Number(timestamp);

      dbOps.updateProjectStatus(pId, "Verified");

      dbOps.insertTimelineEvent({
        project_id: pId,
        event_type: "ProjectUnsuspended",
        actor,
        title: `Project Unsuspended / Restored`,
        description: `Project restored to Verified status. Reason: "${reason}". Transfers resumed.`,
        data_json: JSON.stringify({ actor, reason }),
        timestamp: ts,
        tx_hash: e.transactionHash,
      });
    }
  }

  private async syncCreditRegistry(address: string, fromBlock: number, toBlock: number) {
    const artifact = loadArtifact("CreditRegistry");
    const contract = new ethers.Contract(address, artifact.abi, this.provider);

    // BatchIssued
    const batchFilter = contract.filters.BatchIssued();
    const batchEvents = await contract.queryFilter(batchFilter, fromBlock, toBlock);
    for (const event of batchEvents) {
      const e = event as ethers.EventLog;
      const [batchId, projectId, vintage, quantity, serialNumberStart, serialNumberEnd, recipient, timestamp] = e.args;
      const bId = Number(batchId);
      const pId = Number(projectId);
      const v = Number(vintage);
      const ts = Number(timestamp);
      const qtyStr = quantity.toString();
      const qtyTonnes = parseTonnesFromRaw(quantity);

      // Get batch struct from contract for ipfs proof
      let ipfsProof = "ipfs://QmDefaultProof";
      try {
        const onChainBatch = await contract.getBatch(bId);
        ipfsProof = onChainBatch.ipfsIssuanceProof;
      } catch (err) {
        // fallback
      }

      dbOps.insertBatch({
        batch_id: bId,
        project_id: pId,
        vintage: v,
        quantity_issued: qtyStr,
        quantity_issued_tonnes: qtyTonnes,
        serial_number_start: serialNumberStart,
        serial_number_end: serialNumberEnd,
        ipfs_issuance_proof: ipfsProof,
        recipient,
        issued_at: ts,
        total_retired: "0",
        total_retired_tonnes: 0,
      });

      // Update recipient balance
      try {
        const bal = await contract.balanceOf(recipient, bId);
        dbOps.updateBalance(recipient, bId, bal.toString(), parseTonnesFromRaw(bal));
      } catch (err) {
        dbOps.updateBalance(recipient, bId, qtyStr, qtyTonnes);
      }

      dbOps.insertTimelineEvent({
        batch_id: bId,
        project_id: pId,
        event_type: "BatchIssued",
        actor: recipient,
        title: `Credit Batch #${bId} Issued (${qtyTonnes.toLocaleString()} tonnes)`,
        description: `Vintage ${v} batch minted with serial range ${serialNumberStart} - ${serialNumberEnd}. Anti-double-issuance verified.`,
        data_json: JSON.stringify({ batchId: bId, vintage: v, quantity: qtyTonnes, serialNumberStart, serialNumberEnd, ipfsProof }),
        timestamp: ts,
        tx_hash: e.transactionHash,
      });
    }

    // TransferSingle (custody updates)
    const transferFilter = contract.filters.TransferSingle();
    const transferEvents = await contract.queryFilter(transferFilter, fromBlock, toBlock);
    for (const event of transferEvents) {
      const e = event as ethers.EventLog;
      const [, from, to, id, value] = e.args;
      const bId = Number(id);
      const valTonnes = parseTonnesFromRaw(value);

      // If not mint (from != 0) and not burn (to != 0)
      if (from !== ethers.ZeroAddress && to !== ethers.ZeroAddress) {
        // Update balances for both accounts
        try {
          const fromBal = await contract.balanceOf(from, bId);
          dbOps.updateBalance(from, bId, fromBal.toString(), parseTonnesFromRaw(fromBal));
          const toBal = await contract.balanceOf(to, bId);
          dbOps.updateBalance(to, bId, toBal.toString(), parseTonnesFromRaw(toBal));
        } catch (err) {}

        const block = await this.provider.getBlock(e.blockNumber);
        const ts = block ? block.timestamp : Math.floor(Date.now() / 1000);

        dbOps.insertTimelineEvent({
          batch_id: bId,
          event_type: "TokenTransferred",
          actor: from,
          title: `Credits Transferred (${valTonnes.toLocaleString()} tonnes)`,
          description: `${valTonnes.toLocaleString()} tonnes transferred from ${from.slice(0, 6)}...${from.slice(-4)} to ${to.slice(0, 6)}...${to.slice(-4)}.`,
          data_json: JSON.stringify({ from, to, value: valTonnes }),
          timestamp: ts,
          tx_hash: e.transactionHash,
        });
      }
    }
  }

  private async syncMarketplace(address: string, fromBlock: number, toBlock: number) {
    const artifact = loadArtifact("Marketplace");
    const contract = new ethers.Contract(address, artifact.abi, this.provider);

    // ListingCreated
    const listFilter = contract.filters.ListingCreated();
    const listEvents = await contract.queryFilter(listFilter, fromBlock, toBlock);
    for (const event of listEvents) {
      const e = event as ethers.EventLog;
      const [listingId, seller, batchId, quantity, pricePerUnit, paymentToken, timestamp] = e.args;
      const lId = Number(listingId);
      const bId = Number(batchId);
      const qtyTonnes = parseTonnesFromRaw(quantity);
      const priceFormatted = parsePriceFromRaw(pricePerUnit, paymentToken);
      const ts = Number(timestamp);

      dbOps.upsertListing({
        listing_id: lId,
        seller,
        batch_id: bId,
        quantity: quantity.toString(),
        quantity_tonnes: qtyTonnes,
        price_per_unit: pricePerUnit.toString(),
        price_per_unit_formatted: priceFormatted,
        payment_token: paymentToken,
        active: 1,
        created_at: ts,
        updated_at: ts,
      });

      const isEth = paymentToken === ethers.ZeroAddress;
      const curSymbol = isEth ? "ETH" : "USDC";

      dbOps.insertTimelineEvent({
        batch_id: bId,
        event_type: "ListingCreated",
        actor: seller,
        title: `Market Listing Created #${lId}`,
        description: `Seller placed ${qtyTonnes.toLocaleString()} tonnes in escrow @ ${priceFormatted} ${curSymbol}/tonne.`,
        data_json: JSON.stringify({ listingId: lId, quantity: qtyTonnes, pricePerUnit: priceFormatted, paymentToken }),
        timestamp: ts,
        tx_hash: e.transactionHash,
      });
    }

    // ListingFilled
    const filledFilter = contract.filters.ListingFilled();
    const filledEvents = await contract.queryFilter(filledFilter, fromBlock, toBlock);
    for (const event of filledEvents) {
      const e = event as ethers.EventLog;
      const [listingId, buyer, quantity, totalPrice, platformFee, timestamp] = e.args;
      const lId = Number(listingId);
      const listing = dbOps.getListing(lId);
      const bId = listing?.batch_id || 0;
      const paymentToken = listing?.paymentToken || listing?.payment_token || ethers.ZeroAddress;
      const qtyTonnes = parseTonnesFromRaw(quantity);
      const priceFormatted = parsePriceFromRaw(totalPrice, paymentToken);
      const ts = Number(timestamp);

      dbOps.insertTrade({
        listing_id: lId,
        buyer,
        batch_id: bId,
        quantity: quantity.toString(),
        quantity_tonnes: qtyTonnes,
        total_price: totalPrice.toString(),
        total_price_formatted: priceFormatted,
        platform_fee: platformFee.toString(),
        payment_token: paymentToken,
        timestamp: ts,
        tx_hash: e.transactionHash,
      });

      // Update listing remaining quantity
      try {
        const onChainListing = await contract.getListing(lId);
        dbOps.upsertListing({
          listing_id: lId,
          seller: onChainListing.seller,
          batch_id: Number(onChainListing.batchId),
          quantity: onChainListing.quantity.toString(),
          quantity_tonnes: parseTonnesFromRaw(onChainListing.quantity),
          price_per_unit: onChainListing.pricePerUnit.toString(),
          price_per_unit_formatted: parsePriceFromRaw(onChainListing.pricePerUnit, onChainListing.paymentToken),
          payment_token: onChainListing.paymentToken,
          active: onChainListing.active ? 1 : 0,
          created_at: listing ? listing.created_at : ts,
          updated_at: ts,
        });
      } catch (err) {}

      const isEth = paymentToken === ethers.ZeroAddress;
      const curSymbol = isEth ? "ETH" : "USDC";

      dbOps.insertTimelineEvent({
        batch_id: bId,
        event_type: "TradeExecuted",
        actor: buyer,
        title: `Credits Purchased (${qtyTonnes.toLocaleString()} tonnes)`,
        description: `Buyer acquired ${qtyTonnes.toLocaleString()} tonnes for ${priceFormatted.toFixed(4)} ${curSymbol}. Non-custodial escrow settled atomically.`,
        data_json: JSON.stringify({ listingId: lId, buyer, quantity: qtyTonnes, totalPrice: priceFormatted, platformFee: platformFee.toString() }),
        timestamp: ts,
        tx_hash: e.transactionHash,
      });
    }

    // ListingCancelled
    const cancelFilter = contract.filters.ListingCancelled();
    const cancelEvents = await contract.queryFilter(cancelFilter, fromBlock, toBlock);
    for (const event of cancelEvents) {
      const e = event as ethers.EventLog;
      const [listingId, seller, timestamp] = e.args;
      const lId = Number(listingId);
      const ts = Number(timestamp);

      const listing = dbOps.getListing(lId);
      if (listing) {
        dbOps.upsertListing({
          ...listing,
          active: 0,
          quantity: "0",
          quantity_tonnes: 0,
          updated_at: ts,
        });
      }
    }
  }

  private async syncRetirementManager(address: string, fromBlock: number, toBlock: number) {
    const artifact = loadArtifact("RetirementManager");
    const contract = new ethers.Contract(address, artifact.abi, this.provider);

    // CreditsRetired
    const retFilter = contract.filters.CreditsRetired();
    const retEvents = await contract.queryFilter(retFilter, fromBlock, toBlock);
    for (const event of retEvents) {
      const e = event as ethers.EventLog;
      const [retirementId, retiree, beneficiaryName, batchId, amount, timestamp, certificateHash, externalRegistryRef] = e.args;
      const rId = Number(retirementId);
      const bId = Number(batchId);
      const amountTonnes = parseTonnesFromRaw(amount);
      const ts = Number(timestamp);

      dbOps.insertRetirement({
        retirement_id: rId,
        retiree,
        beneficiary_name: beneficiaryName,
        retirement_reason: "", // Will populate from certificate query if needed
        batch_id: bId,
        amount: amount.toString(),
        amount_tonnes: amountTonnes,
        timestamp: ts,
        external_registry_ref: externalRegistryRef,
        certificate_hash: certificateHash,
        tx_hash: e.transactionHash,
      });

      // Fetch on-chain certificate for retirement reason
      try {
        const cert = await contract.getCertificate(rId);
        dbOps.insertRetirement({
          retirement_id: rId,
          retiree,
          beneficiary_name: beneficiaryName,
          retirement_reason: cert.retirementReason,
          batch_id: bId,
          amount: amount.toString(),
          amount_tonnes: amountTonnes,
          timestamp: ts,
          external_registry_ref: externalRegistryRef,
          certificate_hash: certificateHash,
          tx_hash: e.transactionHash,
        });
      } catch (err) {}

      // Update total retired for batch
      const batch = dbOps.getBatch(bId);
      if (batch) {
        const newTotalRetiredTonnes = batch.total_retired_tonnes + amountTonnes;
        const newTotalRetiredWei = (BigInt(batch.total_retired || "0") + BigInt(amount.toString())).toString();
        dbOps.updateBatchRetired(bId, newTotalRetiredWei, newTotalRetiredTonnes);
      }

      dbOps.insertTimelineEvent({
        batch_id: bId,
        event_type: "CreditsRetired",
        actor: retiree,
        title: `Credits Permanently Retired #${rId} (${amountTonnes.toLocaleString()} tonnes)`,
        description: `Beneficiary: ${beneficiaryName}. Tokens burned irreversibly. Cryptographic certificate issued with hash ${certificateHash.slice(0, 10)}...`,
        data_json: JSON.stringify({ retirementId: rId, beneficiaryName, amountTonnes, externalRegistryRef, certificateHash }),
        timestamp: ts,
        tx_hash: e.transactionHash,
      });
    }
  }
}
