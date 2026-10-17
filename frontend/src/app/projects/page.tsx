"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { fetchProjects } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { SearchBar } from "@/components/SearchBar";
import {
  Layers,
  Globe,
  Filter,
  ArrowRight,
  ShieldCheck,
  FileText,
  Calendar,
} from "lucide-react";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchProjects();
        setProjects(data || []);
        setFiltered(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (selectedStatus === "All") {
      setFiltered(projects);
    } else {
      setFiltered(projects.filter((p) => p.status.toLowerCase() === selectedStatus.toLowerCase()));
    }
  }, [selectedStatus, projects]);

  const statuses = ["All", "Verified", "UnderReview", "Pending", "Suspended"];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Layers className="w-4 h-4" />
            Registry Catalog
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Registered Carbon Projects
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Projects anchored to established standards bodies (Verra VCS, Gold Standard) and certified by accredited auditors.
          </p>
        </div>

        <Link
          href="/developer"
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 transition shrink-0"
        >
          + Register New Project
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-b border-slate-800 pb-4">
        <span className="text-xs text-slate-400 mr-2 flex items-center gap-1">
          <Filter className="w-3.5 h-3.5" /> Filter by Status:
        </span>
        {statuses.map((status) => (
          <button
            key={status}
            onClick={() => setSelectedStatus(status)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              selectedStatus === status
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            {status === "UnderReview" ? "Under Review" : status}
          </button>
        ))}
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((proj) => (
          <div
            key={proj.project_id}
            className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 shadow-xl backdrop-blur-sm transition flex flex-col justify-between group"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <StatusBadge status={proj.status} size="sm" />
                <span className="text-xs font-mono text-slate-400">
                  ID #{proj.project_id}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition leading-snug">
                  {proj.name}
                </h3>
                <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                  <span className="text-slate-300 font-medium">{proj.country}</span>
                  <span>•</span>
                  <span>{proj.methodology.split(" ")[0]}</span>
                </div>
              </div>

              {/* Anchor Details */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">External Registry:</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    {proj.external_registry}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Registry Project ID:</span>
                  <span className="font-mono text-white font-medium">{proj.external_project_id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Vintage Range:</span>
                  <span className="font-mono text-slate-300">{proj.vintage_start} – {proj.vintage_end}</span>
                </div>
                {proj.estimated_max_tonnes_num > 0 && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                    <span className="text-slate-400">Approved Cap:</span>
                    <span className="font-mono text-emerald-300 font-bold">
                      {proj.estimated_max_tonnes_num.toLocaleString()} t CO2e
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
              <Link
                href={`/projects/${proj.project_id}`}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition"
              >
                <span>View Full PDD & History</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <span className="text-[11px] text-slate-400">
                {new Date(proj.registered_at * 1000).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
