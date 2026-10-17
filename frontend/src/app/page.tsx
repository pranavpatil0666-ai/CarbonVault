"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { SearchBar } from "@/components/SearchBar";
import { StatusBadge } from "@/components/StatusBadge";
import { fetchStats, fetchProjects, fetchBatches, fetchRetirements } from "@/lib/api";
import {
  ShieldCheck,
  TrendingUp,
  Flame,
  Layers,
  ArrowRight,
  ExternalLink,
  Award,
  Lock,
  Globe,
  FileCheck2,
  AlertCircle,
  Sparkles,
} from "lucide-react";

export default function Home() {
  const [stats, setStats] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [retirements, setRetirements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [s, p, b, r] = await Promise.all([
          fetchStats().catch(() => null),
          fetchProjects().catch(() => []),
          fetchBatches().catch(() => []),
          fetchRetirements().catch(() => []),
        ]);
        setStats(s);
        setProjects(p || []);
        setBatches(b || []);
        setRetirements(r || []);
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" />
          Public Verification Dashboard • No Wallet Required
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Transparent Carbon Credit <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            Lifecycle & Provenance Ledger
          </span>
        </h1>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          Audit every stage of verified carbon credits on-chain: from developer registration and independent ISO-accredited audit attestation to issuance caps, non-custodial trading, and permanent retirement.
        </p>

        {/* Global Search Bar */}
        <div className="pt-4">
          <SearchBar />
        </div>
      </div>

      {/* Protocol Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Issued Tonnes</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white mt-2 font-mono">
            {stats ? stats.totalTonnesIssued.toLocaleString() : "180,000"}
          </div>
          <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1 font-medium">
            <span>Verified CO2e (1 tonne = 1 credit)</span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Permanently Retired</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-purple-400 mt-2 font-mono">
            {stats ? stats.totalTonnesRetired.toLocaleString() : "9,000"}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1 font-medium">
            <span>Irreversibly burned on-chain</span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Circulation</span>
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-teal-400 mt-2 font-mono">
            {stats ? stats.activeCreditsInCirculation.toLocaleString() : "171,000"}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1 font-medium">
            <span>Held in wallets & escrow</span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Audited Projects</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white mt-2 font-mono">
            {stats ? `${stats.verifiedProjects} / ${stats.totalProjects}` : "2 / 3"}
          </div>
          <div className="text-xs text-blue-400 mt-1 flex items-center gap-1 font-medium">
            <span>Anchored to Verra / Gold Standard</span>
          </div>
        </div>
      </div>

      {/* Core Principle / Trust Model Callout */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-emerald-800/40 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>Core Principle: On-Chain Scope & Offline Trust Anchors</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Blockchains do not inspect forests or calibrate direct air capture filters. Real-world additionality and carbon validity are certified by authorized third-party auditors (SGS, DNV) under established registries (Verra, Gold Standard). CarbonVault guarantees that once certified, credits cannot be double-issued, serial ranges cannot be forged, and retired credits cannot be transferred or resold.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              href="/verifier"
              className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-medium transition"
            >
              Auditor Queue
            </Link>
            <Link
              href="/marketplace"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl text-xs font-medium transition"
            >
              Spot Marketplace
            </Link>
          </div>
        </div>
      </div>

      {/* Verified Credit Batches & Provenance Links */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Verified Credit Batches
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Each ERC-1155 token ID represents one verified vintage batch linked to external serial numbers.
            </p>
          </div>
          <Link
            href="/batches"
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
          >
            <span>View All Batches</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {batches.slice(0, 3).map((batch) => {
            const issued = batch.quantity_issued_tonnes;
            const retired = batch.total_retired_tonnes;
            const remaining = Math.max(0, issued - retired);
            const retiredPercent = issued > 0 ? Math.round((retired / issued) * 100) : 0;

            return (
              <div
                key={batch.batch_id}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition flex flex-col justify-between group shadow-lg"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
                      Token ID #{batch.batch_id}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      Vintage {batch.vintage}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-semibold text-white text-base group-hover:text-emerald-400 transition">
                      {batch.project_name || `Project #${batch.project_id}`}
                    </h3>
                    <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                      <span>{batch.country}</span>
                      <span>•</span>
                      <span className="text-slate-300 font-medium">{batch.external_registry}</span>
                    </div>
                  </div>

                  {/* Anti-double-counting serial numbers */}
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80 text-[11px] font-mono text-slate-400">
                    <div className="text-[10px] uppercase text-slate-400 font-semibold tracking-wider mb-0.5">
                      External Serial Range
                    </div>
                    <div className="truncate text-slate-300 font-semibold">
                      {batch.serial_number_start} → {batch.serial_number_end.split("-").slice(-1)[0]}
                    </div>
                  </div>

                  {/* Issuance & Retirement progress bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Remaining: <strong className="text-white font-mono">{remaining.toLocaleString()} t</strong></span>
                      <span className="text-purple-400 font-mono font-medium">{retired.toLocaleString()} t retired ({retiredPercent}%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                        style={{ width: `${Math.min(100, retiredPercent)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <Link
                    href={`/batches/${batch.batch_id}`}
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 group-hover:translate-x-0.5 transition"
                  >
                    <span>Inspect Full Provenance</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <span className="text-[11px] text-slate-400 font-mono">
                    {issued.toLocaleString()} t cap
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Projects Directory Snapshot */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Registered Carbon Projects
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Anchored to external registries with IPFS Project Design Documents (PDDs) and auditor verification reports.
            </p>
          </div>
          <Link
            href="/projects"
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
          >
            <span>Explore All Projects</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Project Name & ID</th>
                  <th className="px-5 py-3.5 font-semibold">External Registry</th>
                  <th className="px-5 py-3.5 font-semibold">Methodology</th>
                  <th className="px-5 py-3.5 font-semibold">Country</th>
                  <th className="px-5 py-3.5 font-semibold">Approved Cap</th>
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {projects.map((proj) => (
                  <tr key={proj.project_id} className="hover:bg-slate-850/50 transition">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-white text-sm">
                        {proj.name}
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        ID #{proj.project_id} • Developer: {proj.developer.slice(0, 6)}...{proj.developer.slice(-4)}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-slate-200">
                        <Globe className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{proj.external_registry}</span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">
                        {proj.external_project_id}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs font-mono text-slate-300">
                      {proj.methodology.split(" ")[0]}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-300">
                      {proj.country}
                    </td>
                    <td className="px-5 py-4 font-mono text-sm text-white">
                      {proj.estimated_max_tonnes_num
                        ? `${proj.estimated_max_tonnes_num.toLocaleString()} t`
                        : "Pending audit"}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={proj.status} size="sm" />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/projects/${proj.project_id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
                      >
                        <span>View</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Public Retirement Certificates Ticker */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Award className="w-6 h-6 text-purple-400" />
              Recent Retirement Certificates
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Permanently burned credits generating cryptographic, tamper-evident retirement certificates.
            </p>
          </div>
          <Link
            href="/portfolio"
            className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition"
          >
            <span>Retire Credits</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {retirements.slice(0, 2).map((r) => (
            <div
              key={r.retirement_id}
              className="bg-slate-900/70 border border-purple-900/30 hover:border-purple-800/60 rounded-2xl p-5 backdrop-blur-sm transition shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30">
                    Certificate #{r.retirement_id}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(r.timestamp * 1000).toLocaleDateString(undefined, { dateStyle: "medium" })}
                  </span>
                </div>
                <h4 className="text-base font-bold text-white">
                  {r.beneficiary_name}
                </h4>
                <p className="text-xs text-slate-300 mt-1 italic">
                  &ldquo;{r.retirement_reason || "Corporate Net-Zero Neutralization"}&rdquo;
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400">Amount Retired: </span>
                  <strong className="text-purple-400 font-mono text-sm">{r.amount_tonnes.toLocaleString()} tonnes</strong>
                </div>
                <Link
                  href={`/certificates/${r.retirement_id}`}
                  className="text-purple-300 hover:text-purple-200 font-semibold flex items-center gap-1"
                >
                  <span>Verify Certificate</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
