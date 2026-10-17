import React from "react";
import {
  FileText,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Tag,
  ShoppingBag,
  ArrowRightLeft,
  Flame,
  ExternalLink,
  FileCheck,
  CheckCircle2,
} from "lucide-react";

export interface TimelineEvent {
  id?: number;
  batch_id?: number | null;
  project_id?: number | null;
  event_type: string;
  actor: string;
  title: string;
  description: string;
  data_json?: string;
  timestamp: number;
  tx_hash: string;
}

interface ProvenanceTimelineProps {
  events: TimelineEvent[];
}

export function ProvenanceTimeline({ events }: ProvenanceTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-400 text-sm">
        No provenance timeline events recorded yet.
      </div>
    );
  }

  const getEventBadge = (type: string) => {
    switch (type) {
      case "ProjectRegistered":
        return {
          icon: FileText,
          bg: "bg-blue-500/10 text-blue-400 border-blue-500/20",
          ring: "ring-blue-500/30",
          label: "1. Registration",
        };
      case "ProjectUnderReview":
        return {
          icon: Clock,
          bg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
          ring: "ring-amber-500/30",
          label: "2. Technical Review",
        };
      case "ProjectVerified":
        return {
          icon: ShieldCheck,
          bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          ring: "ring-emerald-500/30",
          label: "3. Independent Verification",
        };
      case "BatchIssued":
        return {
          icon: Tag,
          bg: "bg-teal-500/10 text-teal-400 border-teal-500/20",
          ring: "ring-teal-500/30",
          label: "4. Credit Issuance",
        };
      case "ListingCreated":
        return {
          icon: ShoppingBag,
          bg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
          ring: "ring-cyan-500/30",
          label: "Market Escrow",
        };
      case "TradeExecuted":
      case "TokenTransferred":
        return {
          icon: ArrowRightLeft,
          bg: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
          ring: "ring-indigo-500/30",
          label: "Custody Transfer",
        };
      case "CreditsRetired":
        return {
          icon: Flame,
          bg: "bg-purple-500/10 text-purple-400 border-purple-500/20",
          ring: "ring-purple-500/30",
          label: "5. Permanent Retirement",
        };
      case "ProjectSuspended":
        return {
          icon: ShieldAlert,
          bg: "bg-rose-500/10 text-rose-400 border-rose-500/20",
          ring: "ring-rose-500/30",
          label: "Project Suspended",
        };
      default:
        return {
          icon: CheckCircle2,
          bg: "bg-slate-800 text-slate-300 border-slate-700",
          ring: "ring-slate-700",
          label: "Lifecycle Event",
        };
    }
  };

  return (
    <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-emerald-500 before:via-teal-500 before:to-purple-500">
      {events.map((ev, index) => {
        const badge = getEventBadge(ev.event_type);
        const Icon = badge.icon;
        let parsedData: any = {};
        if (ev.data_json) {
          try {
            parsedData = JSON.parse(ev.data_json);
          } catch (e) {}
        }

        return (
          <div key={index} className="relative group">
            {/* Timeline node icon */}
            <div
              className={`absolute -left-6 sm:-left-8 top-1 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-slate-950 border ${badge.ring} shadow-md group-hover:scale-110 transition`}
            >
              <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>

            {/* Event Content Card */}
            <div className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-lg backdrop-blur-sm transition">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badge.bg}`}
                  >
                    {badge.label}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {new Date(ev.timestamp * 1000).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>

                {ev.tx_hash && (
                  <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1 hover:text-emerald-400">
                    Tx: {ev.tx_hash.slice(0, 10)}...{ev.tx_hash.slice(-4)}
                  </span>
                )}
              </div>

              <h4 className="text-base font-semibold text-white tracking-tight">
                {ev.title}
              </h4>
              <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                {ev.description}
              </p>

              {/* Structured Metadata callouts */}
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap gap-2 text-xs">
                {parsedData.externalRegistry && (
                  <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300 flex items-center gap-1.5">
                    <span className="text-slate-400">Registry Anchor:</span>
                    <strong className="text-emerald-400">{parsedData.externalRegistry} ({parsedData.externalProjectId})</strong>
                  </span>
                )}

                {parsedData.reportHash && (
                  <a
                    href={`/api/documents/${encodeURIComponent(parsedData.reportHash)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-emerald-950/40 hover:bg-emerald-900/50 px-2.5 py-1 rounded-lg border border-emerald-800/50 text-emerald-300 flex items-center gap-1.5 transition"
                  >
                    <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Audit Report CID</span>
                    <ExternalLink className="w-3 h-3 text-emerald-400" />
                  </a>
                )}

                {parsedData.ipfsDocumentHash && (
                  <a
                    href={`/api/documents/${encodeURIComponent(parsedData.ipfsDocumentHash)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-blue-950/40 hover:bg-blue-900/50 px-2.5 py-1 rounded-lg border border-blue-800/50 text-blue-300 flex items-center gap-1.5 transition"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    <span>PDD Document CID</span>
                    <ExternalLink className="w-3 h-3 text-blue-400" />
                  </a>
                )}

                {parsedData.serialNumberStart && (
                  <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 font-mono text-slate-300">
                    Serials: {parsedData.serialNumberStart} → {parsedData.serialNumberEnd}
                  </span>
                )}

                {parsedData.beneficiaryName && (
                  <span className="bg-purple-950/40 px-2.5 py-1 rounded-lg border border-purple-800/50 text-purple-300 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-purple-400" />
                    <span>Beneficiary: <strong>{parsedData.beneficiaryName}</strong></span>
                  </span>
                )}

                {parsedData.certificateHash && (
                  <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 font-mono text-slate-400 truncate max-w-xs">
                    Cert: {parsedData.certificateHash.slice(0, 14)}...
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
