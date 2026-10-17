"use client";

import React from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { ShieldAlert, ArrowRight } from "lucide-react";
import { TARGET_CHAIN_ID, TARGET_NETWORK_NAME } from "@/config/contracts";

export function NetworkAlertBanner() {
  const { isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();

  // If not connected or connected to the target chain, do not show warning
  if (!isConnected || !chain || chain.id === TARGET_CHAIN_ID) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/90 border-b border-amber-500/40 px-4 py-3 text-xs">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-amber-200">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <strong className="text-amber-300 font-semibold">Network Notice:</strong> Wallet connected to{" "}
            <span className="font-mono text-white font-bold">{chain.name}</span> (Chain ID: {chain.id}). CarbonVault contracts are deployed on{" "}
            <span className="font-mono text-emerald-400 font-bold uppercase">{TARGET_NETWORK_NAME} (Chain ID: {TARGET_CHAIN_ID})</span>.
          </div>
        </div>

        <button
          onClick={() => {
            if (switchChain) {
              switchChain({ chainId: TARGET_CHAIN_ID });
            }
          }}
          className="shrink-0 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-md shadow-emerald-900/40 cursor-pointer"
        >
          Switch to {TARGET_NETWORK_NAME.toUpperCase()} <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
