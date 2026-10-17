"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSwitchChain } from "wagmi";
import { parseEther } from "viem";
import { 
  Flame, 
  Tag, 
  Coins, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ExternalLink, 
  Layers, 
  Award, 
  ShieldCheck, 
  Wallet,
  ArrowUpRight,
  Info
} from "lucide-react";
import { fetchPortfolio } from "@/lib/api";
import { 
  CONTRACT_ADDRESSES, 
  CREDIT_REGISTRY_ABI, 
  MARKETPLACE_ABI, 
  RETIREMENT_MANAGER_ABI,
  TARGET_CHAIN_ID
} from "@/config/contracts";
import StatusBadge from "@/components/StatusBadge";
import { switchToLocalhost } from "@/lib/network";

export default function PortfolioPage() {
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const [portfolio, setPortfolio] = useState<any>({
    balances: [],
    projects: [],
    listings: [],
    retirements: [],
  });
  const [loading, setLoading] = useState(true);

  // Modals
  const [retireModalOpen, setRetireModalOpen] = useState(false);
  const [listModalOpen, setListModalOpen] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<any | null>(null);

  // Retirement Form
  const [retireAmount, setRetireAmount] = useState("");
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [retirementReason, setRetirementReason] = useState("");
  const [externalRegistryRef, setExternalRegistryRef] = useState("");

  // Listing Form
  const [listQuantity, setListQuantity] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [listToken, setListToken] = useState<"ETH" | "USDC">("USDC");

  // Contract Calls
  const { 
    data: retireHash, 
    writeContract: writeRetire, 
    isPending: isRetirePending, 
    error: retireError 
  } = useWriteContract();

  const { 
    data: listHash, 
    writeContract: writeList, 
    isPending: isListPending, 
    error: listError 
  } = useWriteContract();

  const { 
    data: approveHash, 
    writeContract: writeApprove, 
    isPending: isApprovePending 
  } = useWriteContract();

  const { 
    data: cancelHash, 
    writeContract: writeCancel, 
    isPending: isCancelPending 
  } = useWriteContract();

  const { isLoading: isRetireWaiting, isSuccess: isRetireSuccess } = useWaitForTransactionReceipt({
    hash: retireHash,
  });

  const { isLoading: isListWaiting, isSuccess: isListSuccess } = useWaitForTransactionReceipt({
    hash: listHash,
  });

  const { isLoading: isCancelWaiting, isSuccess: isCancelSuccess } = useWaitForTransactionReceipt({
    hash: cancelHash,
  });

  // Check if marketplace has approval for all
  const { data: isApprovedForAll } = useReadContract({
    address: CONTRACT_ADDRESSES.creditRegistry,
    abi: CREDIT_REGISTRY_ABI,
    functionName: "isApprovedForAll",
    args: address ? [address, CONTRACT_ADDRESSES.marketplace] : undefined,
  });

  const loadData = async () => {
    if (!address) return;
    try {
      setLoading(true);
      const data = await fetchPortfolio(address);
      setPortfolio(data);
    } catch (err) {
      console.error("Error loading portfolio:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && address) {
      loadData();
    }
  }, [address, isConnected, isRetireSuccess, isListSuccess, isCancelSuccess]);

  const handleRetireSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (chain && chain.id !== TARGET_CHAIN_ID) {
      if (switchChain) switchChain({ chainId: TARGET_CHAIN_ID });
      return;
    }
    if (!writeRetire || !selectedHolding) return;

    writeRetire({
      address: CONTRACT_ADDRESSES.retirementManager,
      abi: RETIREMENT_MANAGER_ABI,
      functionName: "retireCredits",
      args: [
        BigInt(selectedHolding.batch_id),
        BigInt(retireAmount),
        beneficiaryName,
        retirementReason,
        externalRegistryRef || "N/A (Direct On-Chain Retirement)",
      ],
    });
  };

  const handleApproveMarketplace = async () => {
    if (chain && chain.id !== TARGET_CHAIN_ID) {
      if (switchChain) switchChain({ chainId: TARGET_CHAIN_ID });
      return;
    }
    if (!writeApprove) return;
    writeApprove({
      address: CONTRACT_ADDRESSES.creditRegistry,
      abi: CREDIT_REGISTRY_ABI,
      functionName: "setApprovalForAll",
      args: [CONTRACT_ADDRESSES.marketplace, true],
    });
  };

  const handleListSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (chain && chain.id !== TARGET_CHAIN_ID) {
      if (switchChain) switchChain({ chainId: TARGET_CHAIN_ID });
      return;
    }
    if (!writeList || !selectedHolding) return;

    const paymentTokenAddr =
      listToken === "ETH"
        ? "0x0000000000000000000000000000000000000000"
        : CONTRACT_ADDRESSES.mockUsdc;

    // USDC uses 6 decimals ($15 = 15_000_000), ETH uses 18 decimals
    const unitPriceWei =
      listToken === "ETH"
        ? parseEther(listPrice)
        : BigInt(Math.round(parseFloat(listPrice) * 1_000_000));

    writeList({
      address: CONTRACT_ADDRESSES.marketplace,
      abi: MARKETPLACE_ABI,
      functionName: "createListing",
      args: [
        BigInt(selectedHolding.batch_id),
        BigInt(listQuantity),
        unitPriceWei,
        paymentTokenAddr,
      ],
    });
  };

  const handleCancelListing = async (listingId: number) => {
    if (chain && chain.id !== TARGET_CHAIN_ID) {
      if (switchChain) switchChain({ chainId: TARGET_CHAIN_ID });
      return;
    }
    if (!writeCancel) return;
    writeCancel({
      address: CONTRACT_ADDRESSES.marketplace,
      abi: MARKETPLACE_ABI,
      functionName: "cancelListing",
      args: [BigInt(listingId)],
    });
  };

  // Aggregates
  const totalTonnesHeld = (portfolio.balances || []).reduce(
    (acc: number, b: any) => acc + (b.balance || 0),
    0
  );
  const totalTonnesRetired = (portfolio.retirements || []).reduce(
    (acc: number, r: any) => acc + (r.amount_tonnes || 0),
    0
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                <Wallet className="w-6 h-6" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Carbon Credit Portfolio &amp; Retirement
              </h1>
            </div>
            <p className="text-slate-400 text-sm sm:text-base max-w-2xl leading-relaxed">
              Manage your audited ERC-1155 carbon credit holdings. Liquidate batches on the transparent order book or permanently retire credits to mint tamper-proof ESG certificates.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-4">
            <div className="bg-slate-950 border border-slate-800 px-5 py-3 rounded-xl text-center">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Balance</div>
              <div className="text-xl font-bold text-emerald-400 font-mono mt-0.5">
                {totalTonnesHeld.toLocaleString()} t
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800 px-5 py-3 rounded-xl text-center">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Permanently Retired</div>
              <div className="text-xl font-bold text-amber-400 font-mono mt-0.5">
                {totalTonnesRetired.toLocaleString()} t
              </div>
            </div>
          </div>
        </div>

        {/* Retirement Explanation */}
        <div className="mt-6 flex items-start gap-3 p-4 bg-amber-950/20 border border-amber-500/20 rounded-xl text-xs sm:text-sm text-amber-200/90">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-amber-300">Permanent Burn Notice:</strong> When retiring carbon credits, the ERC-1155 tokens are permanently burned on Ethereum. A cryptographically unique certificate is generated with the beneficiary name and reason. Retired credits can never be re-transferred or resold.
          </div>
        </div>
      </div>

      {!isConnected && (
        <div className="bg-amber-950/30 border border-amber-500/30 p-6 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <h3 className="font-semibold text-white">Connect Wallet to View Holdings</h3>
              <p className="text-slate-400 text-sm">Please connect your web3 wallet to inspect your carbon credit balances and manage retirements.</p>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Notifications */}
      {retireError && (
        <div className="p-4 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>Retirement Error: {retireError.message}</span>
        </div>
      )}

      {isRetireSuccess && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <strong>Retirement Executed!</strong> Tokens burned and official certificate created.
            <div className="font-mono text-[11px] text-slate-400 mt-1 break-all">Tx: {retireHash}</div>
          </div>
        </div>
      )}

      {isListSuccess && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <strong>Marketplace Listing Created!</strong> Your batch is now live for buyers.
            <div className="font-mono text-[11px] text-slate-400 mt-1 break-all">Tx: {listHash}</div>
          </div>
        </div>
      )}

      {/* Held Credit Batches */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-emerald-400" />
              Held Credit Batches (ERC-1155)
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              Verified carbon tonnes currently held in your wallet address.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10 text-slate-500">Loading holdings...</div>
        ) : portfolio.balances.length === 0 ? (
          <div className="text-center py-12 bg-slate-950/40 rounded-xl border border-slate-800/80">
            <Coins className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-300">No Credit Holdings Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              You do not currently own any ERC-1155 carbon credit tokens. You can acquire credits in the marketplace or issue new batches if you are a developer.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <Link
                href="/marketplace"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5"
              >
                Browse Marketplace <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {portfolio.balances.map((h: any) => (
              <div
                key={h.batch_id}
                className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono font-semibold text-emerald-400">
                        Token #{h.batch_id} • Vintage {h.vintage}
                      </span>
                      <h3 className="text-base font-bold text-white mt-1 line-clamp-1">
                        {h.project_name || `Project #${h.project_id}`}
                      </h3>
                    </div>
                    <StatusBadge status={h.project_status || "Verified"} />
                  </div>

                  <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800/80 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-400">Your Balance:</span>
                      <span className="text-xl font-bold font-mono text-emerald-400">
                        {h.balance.toLocaleString()} <span className="text-xs text-slate-400 font-sans">tCO₂e</span>
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono truncate">
                      Serials: {h.serial_number_start} – {h.serial_number_end}
                    </div>
                  </div>
                </div>

                <div className="pt-5 mt-5 border-t border-slate-800 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setSelectedHolding(h);
                      setListQuantity(h.balance.toString());
                      setListModalOpen(true);
                    }}
                    disabled={h.project_status === "Suspended"}
                    className="py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Tag className="w-3.5 h-3.5 text-blue-400" />
                    List for Sale
                  </button>
                  <button
                    onClick={() => {
                      setSelectedHolding(h);
                      setRetireAmount(h.balance.toString());
                      setRetireModalOpen(true);
                    }}
                    className="py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-amber-900/20"
                  >
                    <Flame className="w-3.5 h-3.5" />
                    Retire Credits
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User's Active Marketplace Listings */}
      {portfolio.listings && portfolio.listings.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-blue-400" />
                Your Active Marketplace Listings
              </h2>
              <p className="text-slate-400 text-xs mt-1">
                Batches currently in non-custodial escrow for purchase.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Listing ID</th>
                  <th className="py-3 px-4">Batch / Project</th>
                  <th className="py-3 px-4">Available Quantity</th>
                  <th className="py-3 px-4">Unit Price</th>
                  <th className="py-3 px-4">Payment Token</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {portfolio.listings.map((l: any) => (
                  <tr key={l.listing_id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-white">#{l.listing_id}</td>
                    <td className="py-3.5 px-4 font-medium text-white">
                      Batch #{l.batch_id}: {l.project_name || `Project #${l.project_id}`}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-emerald-400">
                      {l.quantity_remaining.toLocaleString()} t
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-white">
                      {l.price_per_unit_formatted}
                    </td>
                    <td className="py-3.5 px-4 font-mono">{l.payment_symbol}</td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleCancelListing(l.listing_id)}
                        disabled={isCancelPending || isCancelWaiting}
                        className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Cancel Listing
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Historical Retirement Certificates */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              Retirement Certificates Issued ({portfolio.retirements?.length || 0})
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              Auditable on-chain proof of carbon retirement and corporate climate impact claims.
            </p>
          </div>
        </div>

        {portfolio.retirements && portfolio.retirements.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Cert #</th>
                  <th className="py-3 px-4">Beneficiary</th>
                  <th className="py-3 px-4">Amount Retired</th>
                  <th className="py-3 px-4">Batch / Project</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {portfolio.retirements.map((r: any) => (
                  <tr key={r.retirement_id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-amber-400">
                      CERT-{String(r.retirement_id).padStart(4, "0")}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {r.beneficiary_name}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                      {r.amount_tonnes.toLocaleString()} tCO₂e
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      Token #{r.batch_id} ({r.project_name || `Project #${r.project_id}`})
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(r.timestamp * 1000).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/certificates/${r.retirement_id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg font-semibold transition-colors"
                      >
                        View Certificate <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 text-xs">
            No retirement certificates recorded for this address yet.
          </div>
        )}
      </div>

      {/* Retire Modal */}
      {retireModalOpen && selectedHolding && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-lg w-full space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-400" />
                Permanently Retire Carbon Credits
              </h3>
              <button 
                onClick={() => setRetireModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-1">
              <div className="text-slate-400">Retiring from: <span className="font-semibold text-white">Batch #{selectedHolding.batch_id} (Vintage {selectedHolding.vintage})</span></div>
              <div className="text-slate-400">Available Balance: <span className="font-mono font-bold text-emerald-400">{selectedHolding.balance?.toLocaleString()} tCO₂e</span></div>
            </div>

            <form onSubmit={handleRetireSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Quantity to Retire (Tonnes) *
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedHolding.balance}
                  required
                  value={retireAmount}
                  onChange={(e) => setRetireAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-semibold text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Beneficiary Legal Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corporation, Inc."
                  value={beneficiaryName}
                  onChange={(e) => setBeneficiaryName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Retirement Reason / Climate Claim *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Q3 2026 Scope 1 & 2 Emissions Neutralization"
                  value={retirementReason}
                  onChange={(e) => setRetirementReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  External Registry Retirement Ref (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. VERRA-RET-2024-998234"
                  value={externalRegistryRef}
                  onChange={(e) => setExternalRegistryRef(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-emerald-400 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setRetireModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isConnected || isRetirePending || isRetireWaiting || Number(retireAmount) > selectedHolding.balance}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-900/30"
                >
                  {isRetirePending || isRetireWaiting ? <Clock className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
                  Confirm Permanent Retirement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Listing Modal */}
      {listModalOpen && selectedHolding && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-lg w-full space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-blue-400" />
                List Credits on Marketplace
              </h3>
              <button 
                onClick={() => setListModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {!isApprovedForAll && (
              <div className="p-4 bg-blue-950/30 border border-blue-500/30 rounded-xl space-y-2">
                <div className="text-xs text-blue-300">
                  <strong>Marketplace Escrow Approval:</strong> You must approve the Marketplace contract to handle transfers when buyers purchase your credits.
                </div>
                <button
                  type="button"
                  onClick={handleApproveMarketplace}
                  disabled={isApprovePending}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  {isApprovePending ? "Approving..." : "Approve Marketplace"}
                </button>
              </div>
            )}

            <form onSubmit={handleListSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Quantity to Sell *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={selectedHolding.balance}
                    required
                    value={listQuantity}
                    onChange={(e) => setListQuantity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-semibold text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Payment Asset *
                  </label>
                  <select
                    value={listToken}
                    onChange={(e) => setListToken(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="USDC">USDC (Mock Stablecoin)</option>
                    <option value="ETH">Native ETH</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Unit Price per Tonne ({listToken}) *
                </label>
                <input
                  type="text"
                  required
                  placeholder={listToken === "USDC" ? "15.00" : "0.005"}
                  value={listPrice}
                  onChange={(e) => setListPrice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-semibold text-emerald-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setListModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isConnected || isListPending || isListWaiting || !isApprovedForAll}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-900/30 disabled:cursor-not-allowed"
                >
                  {isListPending || isListWaiting ? <Clock className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
                  Create Marketplace Listing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
