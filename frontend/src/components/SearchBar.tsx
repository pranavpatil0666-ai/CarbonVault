"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, ArrowRight, ShieldCheck, Tag, Award, X } from "lucide-react";
import { searchCarbonVault } from "@/lib/api";
import { StatusBadge } from "./StatusBadge";

export function SearchBar({ placeholder = "Search by Project ID, Batch #, Serial Range, Registry ID (VCS-1122), or Wallet..." }: { placeholder?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    projects: any[];
    batches: any[];
    retirements: any[];
  } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchCarbonVault(query);
        setResults(data);
        setIsOpen(true);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const hasResults =
    results &&
    (results.projects.length > 0 || results.batches.length > 0 || results.retirements.length > 0);

  return (
    <div ref={wrapperRef} className="relative w-full max-w-3xl mx-auto">
      <div className="relative flex items-center">
        <Search className="absolute left-4 w-5 h-5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (hasResults) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full pl-12 pr-12 py-3.5 bg-slate-900/90 hover:bg-slate-900 focus:bg-slate-900 text-white placeholder-slate-400 text-sm sm:text-base rounded-2xl border border-slate-700/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-xl backdrop-blur-md transition-all outline-none"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults(null);
              setIsOpen(false);
            }}
            className="absolute right-4 text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {loading && (
          <Loader2 className="absolute right-10 w-4 h-4 text-emerald-400 animate-spin" />
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden z-50 max-h-[70vh] overflow-y-auto">
          {!hasResults && !loading && (
            <div className="p-6 text-center text-slate-400 text-sm">
              No matching on-chain records found for &ldquo;{query}&rdquo;.
            </div>
          )}

          {results?.projects && results.projects.length > 0 && (
            <div className="p-3 border-b border-slate-800">
              <div className="px-3 py-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Projects ({results.projects.length})
              </div>
              <div className="space-y-1 mt-1">
                {results.projects.map((p) => (
                  <button
                    key={p.project_id}
                    onClick={() => {
                      setIsOpen(false);
                      router.push(`/projects/${p.project_id}`);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-800/80 transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-medium text-white text-sm flex items-center gap-2">
                        <span>{p.name}</span>
                        <StatusBadge status={p.status} size="sm" />
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {p.external_registry} • ID: <span className="text-slate-300 font-mono">{p.external_project_id}</span> • {p.country}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {results?.batches && results.batches.length > 0 && (
            <div className="p-3 border-b border-slate-800">
              <div className="px-3 py-1.5 text-xs font-semibold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                Credit Batches ({results.batches.length})
              </div>
              <div className="space-y-1 mt-1">
                {results.batches.map((b) => (
                  <button
                    key={b.batch_id}
                    onClick={() => {
                      setIsOpen(false);
                      router.push(`/batches/${b.batch_id}`);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-800/80 transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-medium text-white text-sm flex items-center gap-2">
                        <span>Batch #{b.batch_id} • Vintage {b.vintage}</span>
                        <span className="text-xs text-emerald-400 font-mono">
                          {b.quantity_issued_tonnes.toLocaleString()} tonnes CO2e
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 font-mono">
                        Serials: {b.serial_number_start} → {b.serial_number_end}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-teal-400 group-hover:translate-x-0.5 transition" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {results?.retirements && results.retirements.length > 0 && (
            <div className="p-3">
              <div className="px-3 py-1.5 text-xs font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5" />
                Permanent Retirements ({results.retirements.length})
              </div>
              <div className="space-y-1 mt-1">
                {results.retirements.map((r) => (
                  <button
                    key={r.retirement_id}
                    onClick={() => {
                      setIsOpen(false);
                      router.push(`/certificates/${r.retirement_id}`);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-800/80 transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-medium text-white text-sm flex items-center gap-2">
                        <span>Certificate #{r.retirement_id}: {r.beneficiary_name}</span>
                        <span className="text-xs text-purple-400 font-mono">
                          {r.amount_tonnes.toLocaleString()} tonnes
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Retiree: <span className="font-mono text-slate-300">{r.retiree.slice(0, 8)}...</span> • {new Date(r.timestamp * 1000).toLocaleDateString()}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-0.5 transition" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
