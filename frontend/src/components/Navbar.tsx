"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { hardhat } from "viem/chains";
import {
  ShieldCheck,
  Compass,
  FileCheck2,
  Tag,
  ShoppingBag,
  Sparkles,
  Wallet,
  Check,
  ChevronDown,
  Layers,
  LogOut,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { switchToLocalhost } from "@/lib/network";
import { TARGET_CHAIN_ID, TARGET_NETWORK_NAME } from "@/config/contracts";

export function Navbar() {
  const pathname = usePathname();
  const { address, isConnected, chain } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const navLinks = [
    { name: "Explorer", href: "/", icon: Compass },
    { name: "Projects", href: "/projects", icon: Layers },
    { name: "Batches", href: "/batches", icon: Tag },
    { name: "Marketplace", href: "/marketplace", icon: ShoppingBag },
    { name: "Developer", href: "/developer", icon: FileCheck2 },
    { name: "Verifier Queue", href: "/verifier", icon: ShieldCheck },
    { name: "Portfolio & Retire", href: "/portfolio", icon: Sparkles },
  ];

  const handleConnect = () => {
    const injectedConnector = connectors.find((c) => c.id === "injected") || connectors[0];
    if (injectedConnector) {
      connect({ connector: injectedConnector });
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition">
            <ShieldCheck className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="font-bold text-white text-base tracking-tight leading-none flex items-center gap-1.5">
              <span>CarbonVault</span>
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Audited
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">
              Transparent Credit Ledger
            </div>
          </div>
        </Link>

        {/* Navigation Tabs */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-900"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {link.name}
              </Link>
            );
          })}
        </nav>

        {/* Right action / Wallet */}
        <div className="flex items-center gap-3">
          {/* Network indicator */}
          {isConnected && chain && chain.id !== TARGET_CHAIN_ID ? (
            <button
              onClick={() => {
                if (switchChain) switchChain({ chainId: TARGET_CHAIN_ID });
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-[11px] text-amber-300 hover:bg-amber-500/25 transition cursor-pointer"
              title={`Click to switch to ${TARGET_NETWORK_NAME}`}
            >
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>Switch to {TARGET_NETWORK_NAME.toUpperCase()}</span>
            </button>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{chain?.name || `${TARGET_NETWORK_NAME} (${TARGET_CHAIN_ID})`}</span>
            </div>
          )}

          {isConnected && address ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-emerald-500/50 text-xs text-white transition shadow-sm"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-mono">{address.slice(0, 6)}...{address.slice(-4)}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-50">
                  <div className="px-3 py-2 border-b border-slate-800 text-xs text-slate-400">
                    Connected Account
                    <div className="font-mono text-white text-[11px] mt-0.5 truncate">{address}</div>
                  </div>
                  <Link
                    href="/portfolio"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    My Holdings & Retire
                  </Link>
                  <button
                    onClick={() => {
                      disconnect();
                      setDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Disconnect Wallet
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={handleConnect}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition active:scale-95"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Connect Wallet</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile navigation row */}
      <div className="lg:hidden flex overflow-x-auto px-4 py-2 border-t border-slate-900 gap-2 scrollbar-none bg-slate-950">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
          return (
            <Link
              key={link.name}
              href={link.href}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs whitespace-nowrap shrink-0 transition ${
                isActive
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {link.name}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
