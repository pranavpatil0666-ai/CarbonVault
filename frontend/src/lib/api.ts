export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/stats`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export async function fetchProjects(status?: string) {
  const url = status ? `${API_BASE}/projects?status=${status}` : `${API_BASE}/projects`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch projects");
  return res.json();
}

export async function fetchProject(id: number) {
  const res = await fetch(`${API_BASE}/projects/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch project");
  return res.json();
}

export async function fetchBatches() {
  const res = await fetch(`${API_BASE}/batches`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch batches");
  return res.json();
}

export async function fetchBatch(id: number) {
  const res = await fetch(`${API_BASE}/batches/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch batch");
  return res.json();
}

export async function fetchBatchTimeline(id: number) {
  const res = await fetch(`${API_BASE}/batches/${id}/timeline`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch timeline");
  return res.json();
}

export async function fetchListings() {
  const res = await fetch(`${API_BASE}/listings`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch listings");
  return res.json();
}

export async function fetchRetirements() {
  const res = await fetch(`${API_BASE}/retirements`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch retirements");
  return res.json();
}

export async function fetchRetirementCertificate(id: number) {
  const res = await fetch(`${API_BASE}/retirements/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch retirement certificate");
  return res.json();
}

export async function searchCarbonVault(query: string) {
  const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to search");
  return res.json();
}

export async function fetchVerifiers() {
  const res = await fetch(`${API_BASE}/verifiers`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch verifiers");
  return res.json();
}

export async function fetchPortfolio(address: string) {
  const res = await fetch(`${API_BASE}/addresses/${address}/portfolio`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch portfolio");
  return res.json();
}

export async function fetchDocument(cid: string) {
  const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(cid)}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch document");
  return res.json();
}
