"use client";

import React, { useState } from "react";
import { ShieldAlert, Info, X } from "lucide-react";
import { CORE_PRINCIPLE_DISCLAIMER } from "@/config/contracts";

export function DisclaimerBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border-b border-emerald-800/40 text-emerald-100 px-4 py-2.5 text-xs sm:text-sm">
      <div className="max-w-7xl mx-auto flex items-start sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
          <p className="leading-snug text-slate-300">
            <strong className="text-emerald-300 font-semibold mr-1.5">
              Protocol Scope & Limits:
            </strong>
            The blockchain does <span className="underline decoration-emerald-500 font-medium text-white">not</span> establish physical carbon validity or additionality. CarbonVault records an auditable, non-double-issuing ledger for credits independently verified by accredited third parties and anchored to external registries (e.g. Verra VCS, Gold Standard).
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-slate-400 hover:text-white p-1 shrink-0 rounded transition"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
