import React from "react";
import { CheckCircle2, Clock, AlertTriangle, XCircle, ShieldOff, Sparkles } from "lucide-react";

interface StatusBadgeProps {
  status: "Verified" | "UnderReview" | "Pending" | "Suspended" | "Rejected" | "Retired" | "Active" | string;
  size?: "sm" | "md" | "lg";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const normalized = (status || "").toLowerCase();

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5 gap-1",
    md: "text-xs px-2.5 py-1 gap-1.5",
    lg: "text-sm px-3.5 py-1.5 gap-2",
  }[size];

  if (normalized === "verified" || normalized === "active") {
    return (
      <span className={`inline-flex items-center font-medium rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 ${sizeClasses}`}>
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        {status}
      </span>
    );
  }

  if (normalized === "underreview" || normalized === "under review") {
    return (
      <span className={`inline-flex items-center font-medium rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 ${sizeClasses}`}>
        <Clock className="w-3.5 h-3.5 text-amber-400" />
        Under Review
      </span>
    );
  }

  if (normalized === "pending") {
    return (
      <span className={`inline-flex items-center font-medium rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 ${sizeClasses}`}>
        <Clock className="w-3.5 h-3.5 text-blue-400" />
        Pending
      </span>
    );
  }

  if (normalized === "suspended") {
    return (
      <span className={`inline-flex items-center font-medium rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 ${sizeClasses}`}>
        <ShieldOff className="w-3.5 h-3.5 text-rose-400" />
        Suspended
      </span>
    );
  }

  if (normalized === "rejected") {
    return (
      <span className={`inline-flex items-center font-medium rounded-full bg-red-500/15 text-red-300 border border-red-500/30 ${sizeClasses}`}>
        <XCircle className="w-3.5 h-3.5 text-red-400" />
        Rejected
      </span>
    );
  }

  if (normalized === "retired") {
    return (
      <span className={`inline-flex items-center font-medium rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 ${sizeClasses}`}>
        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
        Retired (Burned)
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center font-medium rounded-full bg-slate-800 text-slate-300 border border-slate-700 ${sizeClasses}`}>
      {status}
    </span>
  );
}

export default StatusBadge;
