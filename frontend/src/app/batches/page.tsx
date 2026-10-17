"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { fetchBatches } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { Tag, ArrowRight, Globe, Layers } from "lucide-react";

export default function BatchesPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchBatches();
        setBatches(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal-400 mb-1">
          <Tag className="w-4 h-4" />
          ERC-1155 Token Batches
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Verified Carbon Credit Batches
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-2xl">
          Each batch represents a discrete, independently verified vintage year of credits backed by external serial number ranges.
        </p>
      </div>

      {/* Batches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {batches.map((batch) => {
          const issued = batch.quantity_issued_tonnes;
          const retired = batch.total_retired_tonnes;
          const remaining = Math.max(0, issued - retired);
          const percentRetired = issued > 0 ? Math.round((retired / issued) * 100) : 0;

          return (
            <div
              key={batch.batch_id}
              className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 shadow-xl backdrop-blur-sm transition flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
                    Token ID #{batch.batch_id}
                  </span>
                  <span className="text-xs font-semibold text-slate-300">
                    Vintage {batch.vintage}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition leading-snug">
                    {batch.project_name}
                  </h3>
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{batch.country}</span>
                    <span>•</span>
                    <span className="text-slate-300">{batch.external_registry}</span>
                  </div>
                </div>

                {/* External Serial Range Tracker */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 text-xs">
                  <div className="text-[10px] uppercase text-slate-400 font-semibold tracking-wider">
                    Anti-Double-Counting Serial Range
                  </div>
                  <div className="font-mono text-slate-300 text-[11px] truncate">
                    {batch.serial_number_start} → {batch.serial_number_end.split("-").slice(-1)[0]}
                  </div>
                </div>

                {/* Issuance and Retirement Stats */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Remaining unretired: <strong className="text-white font-mono">{remaining.toLocaleString()} t</strong></span>
                    <span className="text-purple-400 font-mono font-medium">{retired.toLocaleString()} t ({percentRetired}%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                      style={{ width: `${Math.min(100, percentRetired)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                <Link
                  href={`/batches/${batch.batch_id}`}
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition"
                >
                  <span>Inspect Lifecycle Timeline</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <span className="text-[11px] text-slate-400 font-mono">
                  {issued.toLocaleString()} t issued
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
