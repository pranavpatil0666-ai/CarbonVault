"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { fetchBatch, fetchDocument } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { ProvenanceTimeline } from "@/components/ProvenanceTimeline";
import {
  Tag,
  ShieldCheck,
  ShieldAlert,
  Globe,
  Flame,
  Award,
  Users,
  ExternalLink,
  Layers,
  ArrowRight,
  FileCheck2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

export default function BatchDetailPage() {
  const params = useParams();
  const id = Number(params.id);

  const [batch, setBatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchBatch(id);
        setBatch(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center text-slate-400">
        Loading batch provenance records...
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-white">Batch Not Found</h2>
        <p className="text-slate-400 text-sm">No credit batch with Token ID #{id} was found on-chain.</p>
        <Link href="/batches" className="text-emerald-400 hover:underline text-sm">
          ← Back to Batches
        </Link>
      </div>
    );
  }

  const issued = batch.quantity_issued_tonnes;
  const retired = batch.total_retired_tonnes;
  const remaining = Math.max(0, issued - retired);
  const isFullyRetired = remaining === 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
      {/* Breadcrumb */}
      <div className="text-xs text-slate-400 flex items-center gap-2">
        <Link href="/batches" className="hover:text-white transition">Credit Batches</Link>
        <span>/</span>
        <span className="text-slate-200 font-mono">Token ID #{batch.batch_id}</span>
      </div>

      {/* Main Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-3 py-1 rounded-xl bg-teal-500/10 text-teal-300 border border-teal-500/20 text-xs font-mono font-bold">
              ERC-1155 Batch #{batch.batch_id}
            </span>
            <span className="px-3 py-1 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">
              Vintage Year {batch.vintage}
            </span>
            {isFullyRetired ? (
              <StatusBadge status="Retired" size="md" />
            ) : (
              <StatusBadge status="Active" size="md" />
            )}
            {batch.project?.status === "Suspended" && (
              <StatusBadge status="Suspended" size="md" />
            )}
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            {batch.project?.name || `Project #${batch.project_id}`}
          </h1>

          <div className="text-xs sm:text-sm text-slate-400 flex flex-wrap items-center gap-3">
            <span>External Registry: <strong className="text-emerald-400">{batch.project?.external_registry}</strong> ({batch.project?.external_project_id})</span>
            <span>•</span>
            <span>Country: <strong className="text-white">{batch.project?.country}</strong></span>
            <span>•</span>
            <span>Methodology: <strong className="text-slate-300 font-mono">{batch.project?.methodology?.split(" ")[0]}</strong></span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/marketplace"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 transition"
          >
            Buy on Marketplace
          </Link>
          <Link
            href="/portfolio"
            className="px-4 py-2 bg-purple-900/40 hover:bg-purple-800/50 text-purple-300 border border-purple-700/50 rounded-xl text-xs font-semibold transition"
          >
            Retire These Credits
          </Link>
        </div>
      </div>

      {/* Scope Disclaimer Callout */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-start gap-3 text-xs text-slate-300">
        <AlertCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-white">Auditable Scope Notice: </strong>
          This page renders the full on-chain provenance timeline for Token ID #{batch.batch_id}. On-chain retirement permanently destroys the digital tokens on Ethereum, preventing double-spending within this platform. External off-chain registry retirements may be linked to mirrored certificates.
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Anti-Double-Counting Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Anti-Double-Counting Serial Range</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-slate-200 break-all space-y-1">
            <div><span className="text-slate-500">From:</span> {batch.serial_number_start}</div>
            <div><span className="text-slate-500">To:</span> {batch.serial_number_end}</div>
          </div>
          <p className="text-[11px] text-slate-400">
            Hash of serial range is registered in CreditRegistry. Reissuance of this exact range is blocked by contract.
          </p>
        </div>

        {/* Issuance vs Retirement */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Issuance & Retirement Status</span>
            <Flame className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-2xl font-black text-white font-mono">
                {remaining.toLocaleString()} <span className="text-xs text-slate-400 font-normal">t active</span>
              </div>
              <div className="text-xs text-purple-400 font-mono mt-0.5">
                {retired.toLocaleString()} tonnes burned (retired)
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 font-mono">Total Cap</span>
              <div className="text-sm font-bold text-slate-300 font-mono">{issued.toLocaleString()} t</div>
            </div>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
              style={{ width: `${issued > 0 ? (retired / issued) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Project & Attestation Links */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>External Proofs & Documents</span>
            <ExternalLink className="w-4 h-4 text-blue-400" />
          </div>
          <div className="space-y-2 text-xs">
            <Link
              href={`/projects/${batch.project_id}`}
              className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl hover:bg-slate-850 border border-slate-800 transition"
            >
              <span className="text-slate-300">View Project #{batch.project_id}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
            </Link>
            {batch.ipfs_issuance_proof && (
              <a
                href={`/api/documents/${encodeURIComponent(batch.ipfs_issuance_proof)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl hover:bg-slate-850 border border-slate-800 transition text-emerald-400"
              >
                <span>Issuance Attestation CID</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Current Holders Breakdown */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-400" />
          Current On-Chain Token Holders
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="uppercase bg-slate-950/80 text-slate-400 border-b border-slate-800 font-mono">
              <tr>
                <th className="px-4 py-3">Holder Account</th>
                <th className="px-4 py-3">Balance (Tonnes)</th>
                <th className="px-4 py-3">Share of Active Batch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {batch.owners && batch.owners.length > 0 ? (
                batch.owners.map((owner: any, i: number) => {
                  const share = remaining > 0 ? ((owner.balance_tonnes / remaining) * 100).toFixed(1) : "0";
                  return (
                    <tr key={i} className="hover:bg-slate-850/50">
                      <td className="px-4 py-3 font-mono text-white">
                        {owner.account}
                      </td>
                      <td className="px-4 py-3 font-mono text-emerald-400 font-semibold">
                        {owner.balance_tonnes.toLocaleString()} tonnes
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-400">
                        {share}%
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-center text-slate-400">
                    All credits in this batch are currently retired or held in escrow.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Chronological Provenance Timeline */}
      <div className="space-y-4 pt-6 border-t border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileCheck2 className="w-6 h-6 text-emerald-400" />
            Complete Credit Provenance & Custody Timeline
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Complete cryptographic audit trail: Project Registration → Auditor Verification → Batch Issuance → Custody Transfers & Sales → Permanent Retirement.
          </p>
        </div>

        <div className="pt-4">
          <ProvenanceTimeline events={batch.timeline || []} />
        </div>
      </div>
    </div>
  );
}
