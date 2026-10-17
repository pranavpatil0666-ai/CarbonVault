"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { fetchListings } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { useAccount, useWriteContract, useSwitchChain } from "wagmi";
import { CONTRACT_ADDRESSES, MARKETPLACE_ABI, ERC20_ABI, TARGET_CHAIN_ID } from "@/config/contracts";
import { parseEther } from "viem";
import {
  ShoppingBag,
  Tag,
  ArrowRight,
  ShieldCheck,
  Globe,
  Coins,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import { switchToLocalhost } from "@/lib/network";

export default function MarketplacePage() {
  const { address, isConnected, chain } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { switchChain } = useSwitchChain();

  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Buy modal state
  const [selectedListing, setSelectedListing] = useState<any | null>(null);
  const [buyQuantity, setBuyQuantity] = useState<string>("100");
  const [isBuying, setIsBuying] = useState(false);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchListings();
        setListings(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [txSuccess]);

  const handleOpenBuy = (listing: any) => {
    setSelectedListing(listing);
    setBuyQuantity(Math.min(100, listing.quantity_tonnes).toString());
    setTxSuccess(null);
    setErrorMsg(null);
  };

  const handleExecuteBuy = async () => {
    if (!selectedListing) return;
    const qty = parseFloat(buyQuantity);
    if (isNaN(qty) || qty <= 0 || qty > selectedListing.quantity_tonnes) {
      setErrorMsg(`Please enter a valid quantity between 1 and ${selectedListing.quantity_tonnes} tonnes.`);
      return;
    }

    setIsBuying(true);
    setErrorMsg(null);

    if (chain && chain.id !== TARGET_CHAIN_ID) {
      if (switchChain) switchChain({ chainId: TARGET_CHAIN_ID });
      setIsBuying(false);
      return;
    }

    try {
      const isEth = selectedListing.payment_token === "0x0000000000000000000000000000000000000000";
      const rawListingQty = BigInt(selectedListing.quantity);
      const isRawScale = rawListingQty < BigInt("100000000000000");
      const rawBuyQty = isRawScale ? BigInt(Math.round(qty)) : parseEther(qty.toString());
      
      const rawPrice = BigInt(selectedListing.price_per_unit);
      // In Marketplace.sol: totalCost = (quantity * listing.pricePerUnit) / 1e18
      const totalCostWei = (rawBuyQty * rawPrice) / BigInt("1000000000000000000");

      if (isEth) {
        // Buy with ETH
        const hash = await writeContractAsync({
          address: CONTRACT_ADDRESSES.marketplace,
          abi: MARKETPLACE_ABI,
          functionName: "buyListing",
          args: [BigInt(selectedListing.listing_id), rawBuyQty],
          value: totalCostWei,
        });
        setTxSuccess(`Transaction confirmed! Bought ${qty} tonnes. Tx: ${hash.slice(0, 10)}...`);
      } else {
        // Approve USDC first (if totalCostWei > 0), then buyListing
        if (totalCostWei > 0n) {
          await writeContractAsync({
            address: CONTRACT_ADDRESSES.mockUsdc,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [CONTRACT_ADDRESSES.marketplace, totalCostWei],
          });
        }

        const hash = await writeContractAsync({
          address: CONTRACT_ADDRESSES.marketplace,
          abi: MARKETPLACE_ABI,
          functionName: "buyListing",
          args: [BigInt(selectedListing.listing_id), rawBuyQty],
        });
        setTxSuccess(`Transaction confirmed! Bought ${qty} tonnes. Tx: ${hash.slice(0, 10)}...`);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.shortMessage || err.message || "Purchase failed.");
    } finally {
      setIsBuying(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <ShoppingBag className="w-4 h-4" />
            Non-Custodial Escrow Order Book
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Verified Carbon Credit Marketplace
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Acquire verified carbon credit batches held in non-custodial smart contract escrow. Supports ETH and USDC settlement with atomic partial fills.
          </p>
        </div>

        <Link
          href="/portfolio"
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 rounded-xl text-xs font-semibold transition"
        >
          My Portfolio & List Credits
        </Link>
      </div>

      {/* Listings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {listings.map((l) => {
          const isEth = l.payment_token === "0x0000000000000000000000000000000000000000";
          const curSymbol = isEth ? "ETH" : "USDC";

          return (
            <div
              key={l.listing_id}
              className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 shadow-xl backdrop-blur-sm transition flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Listing #{l.listing_id}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">
                    Vintage {l.vintage}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white leading-snug">
                    {l.project_name}
                  </h3>
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{l.country}</span>
                    <span>•</span>
                    <span className="font-mono text-slate-300">Batch #{l.batch_id}</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/80 space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-slate-400">Unit Price</span>
                    <div className="text-xl font-black text-white font-mono">
                      {l.price_per_unit_formatted}{" "}
                      <span className="text-xs font-semibold text-emerald-400">{curSymbol}</span>
                      <span className="text-xs font-normal text-slate-400"> / tonne</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-900">
                    <span className="text-slate-400">Available Escrow:</span>
                    <strong className="text-slate-200 font-mono">
                      {l.quantity_tonnes.toLocaleString()} tonnes
                    </strong>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                <Link
                  href={`/batches/${l.batch_id}`}
                  className="text-xs text-slate-400 hover:text-white transition"
                >
                  Inspect Batch #{l.batch_id}
                </Link>

                <button
                  onClick={() => handleOpenBuy(l)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 transition active:scale-95"
                >
                  Buy Credits
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Buy Modal */}
      {selectedListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-emerald-400" />
                Purchase Carbon Credits
              </h3>
              <button
                onClick={() => setSelectedListing(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-400 space-y-1">
              <div>Project: <strong className="text-white">{selectedListing.project_name}</strong></div>
              <div>Batch: <span className="font-mono text-slate-200">#{selectedListing.batch_id} (Vintage {selectedListing.vintage})</span></div>
              <div>Available in Escrow: <span className="font-mono text-emerald-400 font-semibold">{selectedListing.quantity_tonnes.toLocaleString()} tonnes</span></div>
            </div>

            {/* Input Quantity */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Quantity to purchase (metric tonnes CO2e):
              </label>
              <input
                type="number"
                min="1"
                max={selectedListing.quantity_tonnes}
                value={buyQuantity}
                onChange={(e) => setBuyQuantity(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-sm focus:border-emerald-500 outline-none"
              />
            </div>

            {/* Price Breakdown */}
            {(() => {
              const qty = parseFloat(buyQuantity) || 0;
              const unitPrice = selectedListing.price_per_unit_formatted;
              const subtotal = qty * unitPrice;
              const isEth = selectedListing.payment_token === "0x0000000000000000000000000000000000000000";
              const cur = isEth ? "ETH" : "USDC";

              return (
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal:</span>
                    <span className="font-mono text-white">{subtotal.toFixed(4)} {cur}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Platform Fee (1.50% included):</span>
                    <span className="font-mono text-emerald-400">{(subtotal * 0.015).toFixed(4)} {cur}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-slate-900">
                    <span>Total Payment:</span>
                    <span className="font-mono text-emerald-400">{subtotal.toFixed(4)} {cur}</span>
                  </div>
                </div>
              );
            })()}

            {errorMsg && (
              <div className="p-3 bg-rose-950/30 border border-rose-800/50 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {txSuccess && (
              <div className="p-3 bg-emerald-950/30 border border-emerald-800/50 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{txSuccess}</span>
              </div>
            )}

            <button
              onClick={handleExecuteBuy}
              disabled={isBuying || !isConnected}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
            >
              {isBuying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing On-Chain Fill...</span>
                </>
              ) : !isConnected ? (
                <span>Connect Wallet to Buy</span>
              ) : (
                <span>Confirm Purchase</span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
