import { Router, Request, Response } from "express";
import { dbOps } from "./db";

export const apiRouter = Router();

/**
 * @route GET /api/health
 */
apiRouter.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "CarbonVault Event Indexer & Audit API",
    timestamp: new Date().toISOString(),
    corePrinciple: "The blockchain does not prove real-world carbon additionality. It records and provides immutable provenance for credits attested by accredited third parties."
  });
});

/**
 * @route GET /api/stats
 */
apiRouter.get("/stats", (req: Request, res: Response) => {
  try {
    const stats = dbOps.getStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /api/search?q=...
 */
apiRouter.get("/search", (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query || query.trim().length === 0) {
      return res.json({ projects: [], batches: [], retirements: [] });
    }
    const results = dbOps.search(query);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /api/projects
 */
apiRouter.get("/projects", (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const projects = dbOps.getProjects(status);
    res.json(projects);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /api/projects/:id
 */
apiRouter.get("/projects/:id", (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const project = dbOps.getProject(id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    const batches = dbOps.getBatchesByProject(id);
    const timeline = dbOps.getTimelineForProject(id);
    res.json({ ...project, batches, timeline });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /api/projects/:id/timeline
 */
apiRouter.get("/projects/:id/timeline", (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const timeline = dbOps.getTimelineForProject(id);
    res.json(timeline);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /api/batches
 */
apiRouter.get("/batches", (req: Request, res: Response) => {
  try {
    const batches = dbOps.getBatches();
    // Augment with project data
    const enriched = batches.map((b) => {
      const proj = dbOps.getProject(b.project_id);
      return {
        ...b,
        project_name: proj?.name || "Unknown Project",
        country: proj?.country || "Unknown",
        methodology: proj?.methodology || "Unknown",
        external_registry: proj?.external_registry || "Unknown",
        external_project_id: proj?.external_project_id || "Unknown",
        project_status: proj?.status || "Unknown",
      };
    });
    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /api/batches/:id
 */
apiRouter.get("/batches/:id", (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const batch = dbOps.getBatch(id);
    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }
    const project = dbOps.getProject(batch.project_id);
    const owners = dbOps.getBalancesForBatch(id);
    const timeline = dbOps.getTimelineForBatch(id);
    const retirements = dbOps.getRetirements().filter((r) => r.batch_id === id);

    res.json({
      ...batch,
      project,
      owners,
      timeline,
      retirements,
      remaining_unretired_tonnes: Math.max(0, batch.quantity_issued_tonnes - batch.total_retired_tonnes),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /api/batches/:id/timeline
 */
apiRouter.get("/batches/:id/timeline", (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const timeline = dbOps.getTimelineForBatch(id);
    res.json(timeline);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /api/listings
 */
apiRouter.get("/listings", (req: Request, res: Response) => {
  try {
    const listings = dbOps.getActiveListings();
    res.json(listings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /api/trades
 */
apiRouter.get("/trades", (req: Request, res: Response) => {
  try {
    const trades = dbOps.getTrades();
    res.json(trades);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /api/retirements
 */
apiRouter.get("/retirements", (req: Request, res: Response) => {
  try {
    const retirements = dbOps.getRetirements();
    res.json(retirements);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /api/retirements/:id
 */
apiRouter.get("/retirements/:id", (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const cert = dbOps.getRetirement(id);
    if (!cert) {
      return res.status(404).json({ error: "Retirement certificate not found" });
    }
    res.json(cert);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /api/verifiers
 */
apiRouter.get("/verifiers", (req: Request, res: Response) => {
  try {
    const verifiers = dbOps.getAllVerifiers();
    res.json(verifiers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /api/addresses/:address/portfolio
 */
apiRouter.get("/addresses/:address/portfolio", (req: Request, res: Response) => {
  try {
    const addr = req.params.address;
    const balances = dbOps.getBalancesForAccount(addr);
    const myProjects = dbOps.getProjects().filter((p) => p.developer.toLowerCase() === addr.toLowerCase());
    const myListings = dbOps.getActiveListings().filter((l) => l.seller.toLowerCase() === addr.toLowerCase());
    const myRetirements = dbOps.getRetirements().filter((r) => r.retiree.toLowerCase() === addr.toLowerCase());

    res.json({
      address: addr,
      balances,
      projects: myProjects,
      listings: myListings,
      retirements: myRetirements,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /api/documents/:cid
 * Mock IPFS gateway serving realistic project design documents and auditor validation summaries
 */
apiRouter.get("/documents/:cid", (req: Request, res: Response) => {
  const cid = req.params.cid;
  const docs: Record<string, any> = {
    "tumucumaque-pdd": {
      title: "Project Design Document (PDD) - Tumucumaque Mountains National Park REDD+",
      externalRegistry: "Verra VCS",
      externalProjectId: "VCS-1122",
      standard: "Verified Carbon Standard (VCS) Version 4.4",
      methodology: "VM0007 - REDD+ Methodology Framework",
      hostCountry: "Brazil (Amapá & Pará states)",
      projectProponent: "BioCarbon Biodiversity & Forest Conservation Ltd.",
      validator: "SGS Climate Solutions",
      projectAreaHectares: 3870000,
      creditingPeriod: "2021-01-01 to 2030-12-31",
      estimatedAnnualReductionsTonnes: 25000,
      additionalitySummary: "Baseline deforestation modeled using historical satellite imagery (PRODES 2010-2020). Additionality established via barrier analysis demonstrating lack of alternative private conservation funding.",
      coBenefits: ["Protection of 30+ IUCN Red List vulnerable species including Jaguar (Panthera onca) and Giant Armadillo", "Creation of sustainable non-timber forest product cooperatives with Wayampi indigenous communities"],
      ipfsCid: cid,
    },
    "kilifi-mangrove-pdd": {
      title: "Project Design Document (PDD) - Kilifi Mangrove Blue Carbon Initiative",
      externalRegistry: "Verra VCS",
      externalProjectId: "VCS-2450",
      standard: "Verified Carbon Standard (VCS) Blue Carbon Framework",
      methodology: "VM0033 - Methodology for Tidal Wetland and Seagrass Restoration",
      hostCountry: "Kenya (Kilifi & Lamu Creeks)",
      projectProponent: "East Africa Marine Conservation Trust",
      validator: "DNV Carbon Assurance Services",
      projectAreaHectares: 45000,
      creditingPeriod: "2022-01-01 to 2032-12-31",
      estimatedAnnualReductionsTonnes: 12000,
      additionalitySummary: "Soil organic carbon core sampling with isotopic depth profiling. Demonstrates net carbon storage in saline mangrove root mass and avoidance of mangrove timber poaching.",
      coBenefits: ["Rejuvenation of critical fish spawning grounds benefiting 4,200 artisanal fisher households", "Natural storm surge buffer defending coastal settlements against sea level rise"],
      ipfsCid: cid,
    },
    "hellisheidi-dac-pdd": {
      title: "Project Design Document (PDD) - Hellisheidi Geothermal Direct Air Capture & Mineralization",
      externalRegistry: "Gold Standard",
      externalProjectId: "GS-7740",
      standard: "Gold Standard Carbon Dioxide Removal (CDR)",
      methodology: "CDR001 - Direct Air Capture and Permanent Geological Storage",
      hostCountry: "Iceland (Hengill Volcanic System)",
      projectProponent: "Nordic Mineral Carbon Systems",
      validator: "SGS Climate Solutions",
      creditingPeriod: "2023-01-01 to 2035-12-31",
      estimatedAnnualReductionsTonnes: 10000,
      additionalitySummary: "High chemical cost per tonne captured requires voluntary carbon credit financing. CO2 dissolved in geothermal water and permanently reacted into solid calcite rock at 1,000m depth.",
      coBenefits: ["Zero freshwater consumption through closed-loop geothermal condensate utilization", "Pioneering verifiable permanence with >10,000 year mineralized storage"],
      ipfsCid: cid,
    },
  };

  // Find document by matching key in cid
  for (const [key, doc] of Object.entries(docs)) {
    if (cid.toLowerCase().includes(key) || cid.includes(key.split("-")[0])) {
      return res.json(doc);
    }
  }

  // Fallback generic document metadata
  res.json({
    title: `Attestation & Verification Document: ${cid}`,
    ipfsCid: cid,
    status: "Anchored on-chain in CarbonVault",
    notice: "This document is content-addressed on IPFS. Its hash is permanently inscribed on Ethereum for cryptographic tamper detection.",
    retrievedAt: new Date().toISOString(),
  });
});
