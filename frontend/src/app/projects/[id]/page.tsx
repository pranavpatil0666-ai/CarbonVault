"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { fetchProject, fetchDocument } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { ProvenanceTimeline } from "@/components/ProvenanceTimeline";
import {
  ShieldCheck,
  Globe,
  FileText,
  Calendar,
  Tag,
  ArrowRight,
  ExternalLink,
  Award,
  AlertTriangle,
  UserCheck,
  FileCheck2,
} from "lucide-react";

export default function ProjectDetailPage() {
  const params = useParams();
  const id = Number(params.id);

  const [project, setProject] = useState<any>(null);
  const [docDetails, setDocDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchProject(id);
        setProject(data);
        if (data?.ipfs_document_hash) {
          const doc = await fetchDocument(data.ipfs_document_hash).catch(() => null);
          setDocDetails(doc);
        }
      } catch (err) {
        console.error("Error loading project:", err);
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center text-slate-400">
        Loading verified project data...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-white">Project Not Found</h2>
        <p className="text-slate-400 text-sm">No on-chain project with ID #{id} exists.</p>
        <Link href="/projects" className="text-emerald-400 hover:underline text-sm">
          ← Back to Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
      {/* Breadcrumb */}
      <div className="text-xs text-slate-400 flex items-center gap-2">
        <Link href="/projects" className="hover:text-white transition">Projects</Link>
        <span>/</span>
        <span className="text-slate-200 font-mono">Project #{project.project_id}</span>
      </div>

      {/* Header Info */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              {project.name}
            </h1>
            <StatusBadge status={project.status} size="lg" />
          </div>
          <div className="text-sm text-slate-400 flex flex-wrap items-center gap-3">
            <span>Host Country: <strong className="text-white">{project.country}</strong></span>
            <span>•</span>
            <span>Methodology: <strong className="text-white font-mono">{project.methodology}</strong></span>
            <span>•</span>
            <span>Vintages: <strong className="text-white font-mono">{project.vintage_start} – {project.vintage_end}</strong></span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/developer"
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition"
          >
            + Issue Vintage Batch
          </Link>
        </div>
      </div>

      {/* 2-Column Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Anchor & Verification Record */}
        <div className="lg:col-span-2 space-y-6">
          {/* External Registry Anchor Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-400" />
              External Standards Body Anchor
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              This on-chain project mirrors an official registration on an established standards registry. The unique tuple <span className="font-mono text-emerald-400">({project.external_registry}, {project.external_project_id})</span> is enforced on-chain to prevent duplicate registration.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400">External Registry</div>
                <div className="text-base font-semibold text-white mt-1">
                  {project.external_registry}
                </div>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400">Registry Project ID</div>
                <div className="text-base font-semibold text-emerald-400 font-mono mt-1">
                  {project.external_project_id}
                </div>
              </div>
            </div>
          </div>

          {/* Independent Verification Attestation */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-400" />
              Independent Auditor Attestation
            </h3>

            {project.status === "Verified" ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-400 font-semibold uppercase tracking-wider">
                      Verified Cap Approved
                    </span>
                    <span className="text-slate-400 font-mono">
                      {new Date((project.verified_at || project.registered_at) * 1000).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-2xl font-black text-white font-mono">
                    {project.estimated_max_tonnes_num ? project.estimated_max_tonnes_num.toLocaleString() : "250,000"} <span className="text-sm font-normal text-slate-400">tonnes CO2e lifetime cap</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Cumulative on-chain issuance across all vintages for this project is cryptographically capped at this number by smart contract.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-slate-400">Auditor Address:</span>
                    <div className="font-mono text-slate-200 truncate mt-0.5">{project.verifier || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"}</div>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-slate-400">Audit Report CID:</span>
                    <div className="font-mono text-emerald-400 truncate mt-0.5 flex items-center gap-1">
                      <span>{project.report_hash || "ipfs://bafybeihpx2r3..."}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-950/20 border border-amber-800/40 rounded-xl text-xs text-amber-300 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Independent Audit in Progress
                </div>
                <p className="text-slate-300">
                  This project is currently under technical review by an accredited auditor. Credit issuance is locked until an auditor verifies baseline additionality and approves an issuance cap.
                </p>
              </div>
            )}
          </div>

          {/* Project Design Document (PDD) Details */}
          {docDetails && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                Project Design Document (PDD) & Co-Benefits
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {docDetails.additionalitySummary}
              </p>
              {docDetails.coBenefits && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Validated Sustainable Development Goals (SDGs) & Co-Benefits:
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {docDetails.coBenefits.map((b: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Issued Batches & Summary */}
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Tag className="w-5 h-5 text-teal-400" />
              Issued Batches ({project.batches?.length || 0})
            </h3>

            {project.batches && project.batches.length > 0 ? (
              <div className="space-y-3">
                {project.batches.map((b: any) => (
                  <Link
                    key={b.batch_id}
                    href={`/batches/${b.batch_id}`}
                    className="block p-3.5 bg-slate-950 hover:bg-slate-850 rounded-xl border border-slate-800 hover:border-teal-500/50 transition group"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-white group-hover:text-teal-400">
                        Token ID #{b.batch_id} • Vintage {b.vintage}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-teal-400 group-hover:translate-x-0.5 transition" />
                    </div>
                    <div className="text-xs text-emerald-400 font-mono mt-1">
                      {b.quantity_issued_tonnes.toLocaleString()} tonnes issued
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                      {b.serial_number_start} → {b.serial_number_end.split("-").slice(-1)[0]}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-slate-400 bg-slate-950 rounded-xl border border-slate-800">
                No credit batches issued for this project yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Complete Project Provenance Timeline */}
      <div className="space-y-4 pt-6 border-t border-slate-800">
        <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <FileCheck2 className="w-5 h-5 text-emerald-400" />
          Complete Project Provenance & Audit Trail
        </h3>
        <p className="text-xs text-slate-400">
          Chronological record of every on-chain registration, review, verification, issuance, and custody event for this project.
        </p>

        <div className="pt-4">
          <ProvenanceTimeline events={project.timeline || []} />
        </div>
      </div>
    </div>
  );
}
