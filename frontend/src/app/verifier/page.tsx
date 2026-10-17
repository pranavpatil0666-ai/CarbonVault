"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useConnect } from "wagmi";
import { 
  ShieldCheck, 
  FileCheck2, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ExternalLink, 
  Building2, 
  Search, 
  PauseCircle, 
  PlayCircle,
  FileText,
  BadgeAlert,
  Wallet
} from "lucide-react";
import { fetchProjects, fetchVerifiers } from "@/lib/api";
import { CONTRACT_ADDRESSES, PROJECT_REGISTRY_ABI, TARGET_CHAIN_ID } from "@/config/contracts";
import StatusBadge from "@/components/StatusBadge";
import { switchToLocalhost } from "@/lib/network";

export default function VerifierPage() {
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const { connectors, connect } = useConnect();
  const [projects, setProjects] = useState<any[]>([]);
  const [verifiers, setVerifiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const handleConnect = () => {
    const injectedConnector = connectors.find((c) => c.id === "injected") || connectors[0];
    if (injectedConnector) {
      connect({ connector: injectedConnector });
    }
  };

  // Selected Action State
  const [actionType, setActionType] = useState<"verify" | "reject" | "suspend" | "unsuspend" | null>(null);
  const [targetProject, setTargetProject] = useState<any | null>(null);

  // Form Fields
  const [reportHash, setReportHash] = useState("ipfs://bafybeiaudit-sgs-val-2024");
  const [estimatedTonnes, setEstimatedTonnes] = useState("250000");
  const [comments, setComments] = useState("Methodology VM0007 baseline verified via multi-spectral satellite imagery and historical PRODES validation.");
  const [suspendReason, setSuspendReason] = useState("");

  // Contract write hook
  const { 
    data: txHash, 
    writeContract, 
    isPending: isTxPending, 
    error: txError 
  } = useWriteContract();

  const { isLoading: isTxWaiting, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [projData, verifData] = await Promise.all([
        fetchProjects(),
        fetchVerifiers(),
      ]);
      setProjects(projData);
      setVerifiers(verifData);
    } catch (err) {
      console.error("Error loading verifier data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    if (isTxSuccess) {
      setActionType(null);
      setTargetProject(null);
    }
  }, [isTxSuccess]);

  // Check if current connected user is a registered verifier
  const currentVerifier = verifiers.find((v) => {
    const vAddr = v.address || v.verifier_address;
    return Boolean(address && vAddr && vAddr.toLowerCase() === address.toLowerCase() && v.active);
  });

  const handleStartReview = async (projectId: number) => {
    if (chain && chain.id !== TARGET_CHAIN_ID) {
      if (switchChain) switchChain({ chainId: TARGET_CHAIN_ID });
      return;
    }
    if (!writeContract) return;
    writeContract({
      address: CONTRACT_ADDRESSES.projectRegistry,
      abi: PROJECT_REGISTRY_ABI,
      functionName: "startReview",
      args: [BigInt(projectId)],
    });
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (chain && chain.id !== TARGET_CHAIN_ID) {
      if (switchChain) switchChain({ chainId: TARGET_CHAIN_ID });
      return;
    }
    if (!writeContract || !targetProject) return;

    writeContract({
      address: CONTRACT_ADDRESSES.projectRegistry,
      abi: PROJECT_REGISTRY_ABI,
      functionName: "verifyProject",
      args: [
        BigInt(targetProject.project_id),
        reportHash,
        BigInt(estimatedTonnes),
        comments,
      ],
    });
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (chain && chain.id !== TARGET_CHAIN_ID) {
      if (switchChain) switchChain({ chainId: TARGET_CHAIN_ID });
      return;
    }
    if (!writeContract || !targetProject) return;

    writeContract({
      address: CONTRACT_ADDRESSES.projectRegistry,
      abi: PROJECT_REGISTRY_ABI,
      functionName: "rejectProject",
      args: [
        BigInt(targetProject.project_id),
        reportHash,
        comments,
      ],
    });
  };

  const handleSuspendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (chain && chain.id !== TARGET_CHAIN_ID) {
      if (switchChain) switchChain({ chainId: TARGET_CHAIN_ID });
      return;
    }
    if (!writeContract || !targetProject) return;

    writeContract({
      address: CONTRACT_ADDRESSES.projectRegistry,
      abi: PROJECT_REGISTRY_ABI,
      functionName: "suspendProject",
      args: [
        BigInt(targetProject.project_id),
        suspendReason || "Third-party audit flag: potential baseline calculation discrepancy",
      ],
    });
  };

  const handleUnsuspendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (chain && chain.id !== TARGET_CHAIN_ID) {
      if (switchChain) switchChain({ chainId: TARGET_CHAIN_ID });
      return;
    }
    if (!writeContract || !targetProject) return;

    writeContract({
      address: CONTRACT_ADDRESSES.projectRegistry,
      abi: PROJECT_REGISTRY_ABI,
      functionName: "unsuspendProject",
      args: [
        BigInt(targetProject.project_id),
        suspendReason || "Dispute resolved and baseline calculations re-attested.",
      ],
    });
  };

  // Filter queues
  const reviewQueue = projects.filter(
    (p) => p.status === "Pending" || p.status === "UnderReview"
  );
  const activeProjects = projects.filter(
    (p) => p.status === "Verified" || p.status === "Suspended"
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
                <ShieldCheck className="w-6 h-6" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Auditor &amp; Verifier Review Queue
              </h1>
            </div>
            <p className="text-slate-400 text-sm sm:text-base max-w-2xl leading-relaxed">
              Authorized Designated Operational Entities (DOEs) and ISO 14065 accredited verifiers audit conservation Project Design Documents (PDDs), establish maximum issuance tonnes caps, and enforce dispute suspensions.
            </p>
          </div>

          {/* Verifier Status Card */}
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl min-w-[280px]">
            <div className="text-xs uppercase font-semibold text-slate-500 tracking-wider mb-1">
              Verifier Authorization Status
            </div>
            {currentVerifier ? (
              <div>
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  {currentVerifier.name}
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Ref: {currentVerifier.accreditation_ref}
                </div>
              </div>
            ) : isConnected ? (
              <div>
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs">
                  <BadgeAlert className="w-4 h-4" />
                  Connected address is not an authorized verifier
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Connect as SGS (Seed Verifier #1) or DNV (Seed Verifier #2) to sign transactions.
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400">Connect wallet to check verifier role.</div>
            )}
          </div>
        </div>

        {/* Core Principle Notice */}
        <div className="mt-6 flex items-start gap-3 p-4 bg-blue-950/20 border border-blue-500/20 rounded-xl text-xs sm:text-sm text-blue-200/90">
          <FileCheck2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-blue-300">Auditor Attestation Principle:</strong> Smart contracts do not verify real-world additionality; they record your cryptographic attestation, publish your audit report hash, and strictly bound token issuance to your approved capacity limit.
          </div>
        </div>
      </div>

      {/* Action Notification */}
      {txError && (
        <div className="p-4 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{txError.message}</span>
        </div>
      )}

      {isTxSuccess && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <strong>Transaction Executed Successfully!</strong> Project status and cap updated on-chain.
            <div className="font-mono text-[11px] text-slate-400 mt-1 break-all">Tx: {txHash}</div>
          </div>
        </div>
      )}

      {/* Review Queue (Pending & UnderReview) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              Pending Verification Queue ({reviewQueue.length})
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              Projects awaiting technical audit and issuance cap attestation.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10 text-slate-500">Loading audit queue...</div>
        ) : reviewQueue.length === 0 ? (
          <div className="text-center py-12 bg-slate-950/40 rounded-xl border border-slate-800/80">
            <CheckCircle2 className="w-10 h-10 text-emerald-500/40 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-300">All Project Audits Cleared</h3>
            <p className="text-xs text-slate-500 mt-1">There are no pending or under-review projects requiring verifier action.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reviewQueue.map((p) => (
              <div 
                key={p.project_id}
                className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-mono text-emerald-400 font-semibold">
                        Project #{p.project_id}
                      </div>
                      <h3 className="text-lg font-bold text-white mt-1 leading-snug">
                        {p.name}
                      </h3>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-900">
                    <div>
                      <span className="text-slate-500 block">Registry Anchor</span>
                      <span className="font-semibold text-slate-200">
                        {p.external_registry}: {p.external_project_id}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Host Country</span>
                      <span className="font-semibold text-slate-200">{p.country}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Methodology</span>
                      <span className="font-semibold text-slate-200">{p.methodology}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Vintages</span>
                      <span className="font-semibold text-slate-200">{p.vintage_start} – {p.vintage_end}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 text-xs">
                    <span className="text-slate-400 block text-[11px] mb-1 font-semibold uppercase tracking-wider">
                      Design Document (PDD Hash)
                    </span>
                    <span className="font-mono text-emerald-400 text-[11px] break-all block">
                      {p.ipfs_document_hash}
                    </span>
                  </div>
                </div>

                <div className="pt-5 mt-5 border-t border-slate-800 flex items-center gap-2">
                  {p.status === "Pending" && (
                    <button
                      onClick={() => handleStartReview(p.project_id)}
                      disabled={!isConnected || isTxPending || isTxWaiting}
                      className="px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      Start Review
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setTargetProject(p);
                      setActionType("verify");
                    }}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-900/20"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Verify &amp; Set Cap
                  </button>
                  <button
                    onClick={() => {
                      setTargetProject(p);
                      setActionType("reject");
                    }}
                    className="px-3 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Project Dispute & Suspension Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Audit Suspension &amp; Reinstatement Management
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Suspend trading and transfers on-chain if external registry invalidation, land tenure disputes, or leakage irregularities occur.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Project</th>
                <th className="py-3 px-4">Registry Anchor</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Approved Cap</th>
                <th className="py-3 px-4">Issued</th>
                <th className="py-3 px-4 text-right">Emergency Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {activeProjects.map((p) => (
                <tr key={p.project_id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-white">
                    #{p.project_id}: {p.name}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-emerald-400">
                    {p.external_registry}: {p.external_project_id}
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="py-3.5 px-4 font-mono">
                    {p.estimated_max_tonnes ? `${p.estimated_max_tonnes.toLocaleString()} t` : "N/A"}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-400">
                    {p.cumulative_issued_tonnes?.toLocaleString() || 0} t
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {p.status === "Verified" ? (
                      <button
                        onClick={() => {
                          setTargetProject(p);
                          setActionType("suspend");
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 rounded-lg font-medium transition-colors cursor-pointer"
                      >
                        <PauseCircle className="w-3.5 h-3.5" /> Suspend
                      </button>
                    ) : p.status === "Suspended" ? (
                      <button
                        onClick={() => {
                          setTargetProject(p);
                          setActionType("unsuspend");
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 rounded-lg font-medium transition-colors cursor-pointer"
                      >
                        <PlayCircle className="w-3.5 h-3.5" /> Re-instate
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Authorized Verifiers Directory */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8">
        <h3 className="text-base font-bold text-white mb-2">Registered Authorized Verifiers</h3>
        <p className="text-xs text-slate-400 mb-6">
          Independent auditors authorized in <code className="text-slate-300">VerifierRegistry.sol</code> by governance.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {verifiers.map((v) => (
            <div key={v.verifier_address} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm">{v.name}</span>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Active Auditor
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Accreditation: <span className="text-slate-200 font-medium">{v.accreditation_ref}</span>
              </div>
              <div className="font-mono text-[11px] text-slate-500 truncate">
                Address: {v.verifier_address}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Verification Modal */}
      {actionType === "verify" && targetProject && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-xl w-full space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Attest &amp; Approve Project
              </h3>
              <button 
                onClick={() => setActionType(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-1">
              <div className="font-semibold text-white">#{targetProject.project_id}: {targetProject.name}</div>
              <div className="text-slate-400">{targetProject.external_registry} {targetProject.external_project_id} • {targetProject.country}</div>
            </div>

            <form onSubmit={handleVerifySubmit} className="space-y-4">
              {!isConnected ? (
                <div className="p-4 bg-amber-950/40 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <BadgeAlert className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>Wallet disconnected. Please connect your authorized auditor wallet to sign.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleConnect}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs shrink-0 cursor-pointer shadow flex items-center justify-center gap-1.5"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    Connect Wallet
                  </button>
                </div>
              ) : chain && chain.id !== TARGET_CHAIN_ID ? (
                <div className="p-4 bg-amber-950/40 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>Wallet is on {chain.name}. Switch to Sepolia to interact with contracts.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => switchChain && switchChain({ chainId: TARGET_CHAIN_ID })}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg text-xs shrink-0 cursor-pointer shadow"
                  >
                    Switch to Sepolia
                  </button>
                </div>
              ) : !currentVerifier ? (
                <div className="p-3.5 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-semibold">Unauthorized Address ({address?.slice(0, 6)}...{address?.slice(-4)})</strong>
                    <span>Only authorized verifiers registered on Sepolia can attest projects. Please switch to your authorized verifier account (0xaF10...84D6).</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Signing as accredited auditor: <strong>{currentVerifier.name}</strong> ({address?.slice(0, 6)}...{address?.slice(-4)})
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Audited Maximum Issuance Cap (Tonnes) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={estimatedTonnes}
                  onChange={(e) => setEstimatedTonnes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-semibold text-emerald-400 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">Smart contracts enforce cumulative issuance never exceeds this ceiling.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Audit Report IPFS CID *
                </label>
                <input
                  type="text"
                  required
                  value={reportHash}
                  onChange={(e) => setReportHash(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Verification Comments / Audit Summary *
                </label>
                <textarea
                  required
                  rows={3}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActionType(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                {!isConnected ? (
                  <button
                    type="button"
                    onClick={handleConnect}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/30"
                  >
                    <Wallet className="w-4 h-4" />
                    Connect Wallet to Sign
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!currentVerifier || isTxPending || isTxWaiting}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/30"
                  >
                    {isTxPending || isTxWaiting ? <Clock className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Sign Verification On-Chain
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {actionType === "reject" && targetProject && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-xl w-full space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-400" />
                Reject Project Verification
              </h3>
              <button 
                onClick={() => setActionType(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              {!isConnected ? (
                <div className="p-4 bg-amber-950/40 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <BadgeAlert className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>Wallet disconnected. Please connect your authorized auditor wallet to sign.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleConnect}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs shrink-0 cursor-pointer shadow flex items-center justify-center gap-1.5"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    Connect Wallet
                  </button>
                </div>
              ) : null}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Negative Finding Audit Report (IPFS CID) *
                </label>
                <input
                  type="text"
                  required
                  value={reportHash}
                  onChange={(e) => setReportHash(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Rejection Rationale *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detail the failure to satisfy additionality, baseline criteria, or carbon permanence requirements."
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActionType(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                {!isConnected ? (
                  <button
                    type="button"
                    onClick={handleConnect}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/30"
                  >
                    <Wallet className="w-4 h-4" />
                    Connect Wallet to Sign
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!currentVerifier || isTxPending || isTxWaiting}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-900/30"
                  >
                    {isTxPending || isTxWaiting ? <Clock className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    Sign Project Rejection
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {(actionType === "suspend" || actionType === "unsuspend") && targetProject && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-xl w-full space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                {actionType === "suspend" ? "Suspend Project Trading" : "Reinstate Suspended Project"}
              </h3>
              <button 
                onClick={() => setActionType(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={actionType === "suspend" ? handleSuspendSubmit : handleUnsuspendSubmit} className="space-y-4">
              {!isConnected ? (
                <div className="p-4 bg-amber-950/40 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <BadgeAlert className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>Wallet disconnected. Please connect your authorized auditor wallet to sign.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleConnect}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs shrink-0 cursor-pointer shadow flex items-center justify-center gap-1.5"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    Connect Wallet
                  </button>
                </div>
              ) : null}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Action Justification / Registry Reference *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder={
                    actionType === "suspend" 
                      ? "Describe reason for freezing transfers (e.g. Verra registry hold, land dispute, audit review)..." 
                      : "Describe dispute resolution and audit verification reinstatement details..."
                  }
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActionType(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                {!isConnected ? (
                  <button
                    type="button"
                    onClick={handleConnect}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/30"
                  >
                    <Wallet className="w-4 h-4" />
                    Connect Wallet to Sign
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!currentVerifier || isTxPending || isTxWaiting}
                    className={`px-5 py-2.5 text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer shadow-lg disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed ${
                      actionType === "suspend" ? "bg-rose-600 hover:bg-rose-500 shadow-rose-900/30" : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30"
                    }`}
                  >
                    {isTxPending || isTxWaiting ? <Clock className="w-4 h-4 animate-spin" /> : null}
                    Confirm {actionType === "suspend" ? "Suspension" : "Reinstatement"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
