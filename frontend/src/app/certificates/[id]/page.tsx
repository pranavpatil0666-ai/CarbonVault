"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { 
  Award, 
  Flame, 
  CheckCircle2, 
  ShieldCheck, 
  Printer, 
  Share2, 
  ExternalLink, 
  ArrowLeft,
  Copy,
  Calendar,
  Building2,
  FileCheck2,
  Lock
} from "lucide-react";
import { fetchRetirementCertificate } from "@/lib/api";

export default function CertificatePage() {
  const params = useParams();
  const id = Number(params.id);

  const [cert, setCert] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadCert() {
      try {
        setLoading(true);
        const data = await fetchRetirementCertificate(id);
        setCert(data);
      } catch (err: any) {
        setError(err.message || "Failed to load retirement certificate");
      } finally {
        setLoading(false);
      }
    }
    if (id) {
      loadCert();
    }
  }, [id]);

  const copyHash = () => {
    if (cert?.certificate_hash) {
      navigator.clipboard.writeText(cert.certificate_hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400 max-w-4xl mx-auto space-y-4">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium">Verifying cryptographic certificate hash on-chain...</p>
      </div>
    );
  }

  if (error || !cert) {
    return (
      <div className="py-16 text-center max-w-md mx-auto space-y-4">
        <div className="w-14 h-14 bg-red-950/40 border border-red-500/30 text-red-400 rounded-2xl flex items-center justify-center mx-auto">
          ✕
        </div>
        <h2 className="text-xl font-bold text-white">Retirement Certificate Not Found</h2>
        <p className="text-slate-400 text-sm">
          No retirement record exists with ID #{id}. Please verify the certificate number.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-colors mt-2"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Nav & Action Bar */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/portfolio"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Portfolio
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Print / Export PDF
          </button>
          <Link
            href={`/batches/${cert.batch_id}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold rounded-xl border border-emerald-500/30 transition-colors"
          >
            Batch Provenance <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Official Certificate Layout */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-500/40 rounded-3xl p-8 sm:p-12 shadow-2xl shadow-black relative overflow-hidden print:border-black print:text-black print:bg-white">
        {/* Decorative corner patterns */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/5 rounded-br-full pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-tl-full pointer-events-none" />

        {/* Certificate Header */}
        <div className="text-center space-y-4 pb-8 border-b border-slate-800 print:border-slate-300">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-xs font-semibold uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4" /> Official Climate Action Certificate
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-serif print:text-black">
            Certificate of Carbon Credit Retirement
          </h1>

          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto print:text-slate-600">
            This certifies that verified greenhouse gas reduction credits have been permanently burned and taken out of circulation on Ethereum.
          </p>

          <div className="font-mono text-sm font-bold text-amber-400">
            Certificate ID: CERT-{String(cert.retirement_id).padStart(5, "0")}
          </div>
        </div>

        {/* Certificate Body */}
        <div className="py-8 space-y-8 text-center">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 print:text-slate-600">
              Presented to Beneficiary
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-white mt-1 font-serif print:text-black">
              {cert.beneficiary_name}
            </div>
          </div>

          {/* Retired Quantity Big Badge */}
          <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-6 max-w-md mx-auto print:bg-slate-100 print:border-slate-400">
            <span className="text-xs uppercase font-semibold text-amber-400 tracking-wider flex items-center justify-center gap-1.5 mb-1">
              <Flame className="w-4 h-4" /> Volume Permanently Retired
            </span>
            <div className="text-4xl sm:text-5xl font-black font-mono text-white tracking-tight print:text-black">
              {cert.amount_tonnes.toLocaleString()}
            </div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-1 block">
              Metric Tonnes of CO₂ Equivalent (tCO₂e)
            </span>
          </div>

          {/* Project Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left max-w-2xl mx-auto pt-4">
            <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 print:bg-slate-50 print:border-slate-300">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Project Name
              </span>
              <span className="text-sm font-bold text-white mt-0.5 block print:text-black">
                {cert.project_name || `Project #${cert.project_id}`}
              </span>
            </div>

            <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 print:bg-slate-50 print:border-slate-300">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Registry Anchor
              </span>
              <span className="text-sm font-bold font-mono text-emerald-400 mt-0.5 block print:text-emerald-700">
                {cert.external_registry}: {cert.external_project_id}
              </span>
            </div>

            <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 print:bg-slate-50 print:border-slate-300">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Batch &amp; Vintage
              </span>
              <span className="text-sm font-semibold text-white mt-0.5 block print:text-black">
                Batch #{cert.batch_id} • Vintage {cert.vintage || "Verified"}
              </span>
            </div>

            <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 print:bg-slate-50 print:border-slate-300">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Retirement Timestamp
              </span>
              <span className="text-sm font-semibold text-white mt-0.5 block print:text-black">
                {new Date(cert.timestamp * 1000).toUTCString()}
              </span>
            </div>
          </div>

          {/* Retirement Purpose */}
          <div className="max-w-2xl mx-auto p-4 bg-slate-900/40 rounded-xl border border-slate-800 text-left print:bg-slate-50 print:border-slate-300">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Purpose &amp; Corporate Climate Claim
            </span>
            <p className="text-sm text-slate-200 leading-relaxed print:text-black">
              &ldquo;{cert.retirement_reason}&rdquo;
            </p>
            {cert.external_registry_ref && cert.external_registry_ref !== "N/A (Direct On-Chain Retirement)" && (
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">External Registry Reference:</span>
                <span className="font-mono text-emerald-400 font-semibold">{cert.external_registry_ref}</span>
              </div>
            )}
          </div>

          {/* Cryptographic Proof Section */}
          <div className="max-w-2xl mx-auto p-4 bg-slate-950 rounded-xl border border-slate-800 text-left space-y-2 print:bg-white print:border-slate-300">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Immutable Certificate Hash
              </span>
              <button
                onClick={copyHash}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 print:hidden cursor-pointer"
              >
                <Copy className="w-3 h-3" /> {copied ? "Copied" : "Copy Hash"}
              </button>
            </div>
            <div className="font-mono text-xs text-slate-300 break-all select-all print:text-black">
              {cert.certificate_hash || "0x0000000000000000000000000000000000000000000000000000000000000000"}
            </div>
            <div className="text-[11px] text-slate-500 pt-1 flex items-center justify-between flex-wrap gap-2">
              <span>Retiree Wallet: <code className="text-slate-400">{cert.retiree}</code></span>
              <span>Smart Contract: <code className="text-slate-400">RetirementManager.sol</code></span>
            </div>
          </div>
        </div>

        {/* Certificate Disclaimer Footer */}
        <div className="pt-6 border-t border-slate-800 text-center text-[11px] text-slate-400 space-y-1 print:text-slate-500 print:border-slate-300">
          <p className="font-semibold text-slate-300 print:text-black">
            CarbonVault Protocol • Transparent Lifecycle Verification Standard
          </p>
          <p className="max-w-xl mx-auto">
            The blockchain verifies and records the permanent burn of these tokens. Physical carbon sequestration additionality was certified by independent verifiers and anchored to external voluntary market registries.
          </p>
        </div>
      </div>
    </div>
  );
}
