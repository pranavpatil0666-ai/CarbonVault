"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from "wagmi";
import { 
  Building2, 
  FileText, 
  Coins, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink, 
  ShieldCheck, 
  Layers, 
  ArrowRight,
  Info,
  Clock,
  Sparkles
} from "lucide-react";
import { fetchProjects } from "@/lib/api";
import { CONTRACT_ADDRESSES, PROJECT_REGISTRY_ABI, CREDIT_REGISTRY_ABI, TARGET_CHAIN_ID } from "@/config/contracts";
import StatusBadge from "@/components/StatusBadge";
import { switchToLocalhost } from "@/lib/network";

export default function DeveloperPage() {
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const [activeTab, setActiveTab] = useState<"register" | "issue">("register");
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Registration Form State
  const [regForm, setRegForm] = useState({
    name: "",
    methodology: "",
    country: "",
    vintageStart: "2021",
    vintageEnd: "2030",
    externalRegistry: "Verra VCS",
    externalProjectId: "",
    ipfsDocumentHash: "ipfs://bafybeic7r3v5tumucumaque-pdd-v1",
  });

  // Issuance Form State
  const [selectedProjectId, setSelectedProjectId] = useState<number | "">("");
  const [issueForm, setIssueForm] = useState({
    vintage: "2023",
    quantity: "",
    serialStart: "",
    serialEnd: "",
    issuanceProof: "ipfs://bafybeih5tq-registry-issuance-statement-v1",
    recipient: "",
  });

  // Contract write hooks
  const { 
    data: regHash, 
    writeContract: writeRegister, 
    isPending: isRegPending, 
    error: regError 
  } = useWriteContract();

  const { 
    data: issueHash, 
    writeContract: writeIssue, 
    isPending: isIssuePending, 
    error: issueError 
  } = useWriteContract();

  const { isLoading: isRegWaiting, isSuccess: isRegSuccess } = useWaitForTransactionReceipt({
    hash: regHash,
  });

  const { isLoading: isIssueWaiting, isSuccess: isIssueSuccess } = useWaitForTransactionReceipt({
    hash: issueHash,
  });

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await fetchProjects();
      setProjects(data);
      if (data.length > 0 && selectedProjectId === "") {
        const verifiedOnes = data.filter((p: any) => p.status === "Verified");
        if (verifiedOnes.length > 0) {
          setSelectedProjectId(verifiedOnes[0].project_id);
        }
      }
    } catch (err) {
      console.error("Error loading projects:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [isRegSuccess, isIssueSuccess]);

  useEffect(() => {
    if (address && !issueForm.recipient) {
      setIssueForm((prev) => ({ ...prev, recipient: address }));
    }
  }, [address]);

  // Selected project calculation
  const selectedProject = projects.find((p) => p.project_id === Number(selectedProjectId));
  const remainingIssuable = selectedProject
    ? Math.max(0, (selectedProject.estimated_max_tonnes || 0) - (selectedProject.cumulative_issued_tonnes || 0))
    : 0;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (chain && chain.id !== TARGET_CHAIN_ID) {
      if (switchChain) switchChain({ chainId: TARGET_CHAIN_ID });
      return;
    }
    if (!writeRegister) return;

    writeRegister({
      address: CONTRACT_ADDRESSES.projectRegistry,
      abi: PROJECT_REGISTRY_ABI,
      functionName: "registerProject",
      args: [
        regForm.name,
        regForm.methodology,
        regForm.country,
        Number(regForm.vintageStart),
        Number(regForm.vintageEnd),
        regForm.externalRegistry,
        regForm.externalProjectId,
        regForm.ipfsDocumentHash,
      ],
    });
  };

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (chain && chain.id !== TARGET_CHAIN_ID) {
      if (switchChain) switchChain({ chainId: TARGET_CHAIN_ID });
      return;
    }
    if (!writeIssue || !selectedProjectId) return;

    writeIssue({
      address: CONTRACT_ADDRESSES.creditRegistry,
      abi: CREDIT_REGISTRY_ABI,
      functionName: "issueBatch",
      args: [
        BigInt(selectedProjectId),
        Number(issueForm.vintage),
        BigInt(issueForm.quantity),
        issueForm.serialStart,
        issueForm.serialEnd,
        issueForm.issuanceProof,
        (issueForm.recipient || address) as `0x${string}`,
      ],
    });
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                <Building2 className="w-6 h-6" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Project Developer Hub
              </h1>
            </div>
            <p className="text-slate-400 text-sm sm:text-base max-w-2xl leading-relaxed">
              Register conservation initiatives anchored to recognized registries (Verra, Gold Standard). Once independently attested by an authorized verifier, mint ERC-1155 batches subject to strict cryptographic cap enforcement.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 p-2 rounded-xl">
            <button
              onClick={() => setActiveTab("register")}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "register"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              1. Register Project
            </button>
            <button
              onClick={() => setActiveTab("issue")}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "issue"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              2. Issue Batches
            </button>
          </div>
        </div>

        {/* Notice on Role & Integrity */}
        <div className="mt-6 flex items-start gap-3 p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-xl text-xs sm:text-sm text-emerald-200/90">
          <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-emerald-300">Auditable Issuance Enforcement:</strong> Registering a project enters it into <span className="font-semibold text-white">Pending</span> status. No tokens can be minted until an accredited verifier reviews the Project Design Document (PDD) and establishes an immutable maximum tonnes cap.
          </div>
        </div>
      </div>

      {!isConnected && (
        <div className="bg-amber-950/30 border border-amber-500/30 p-6 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <h3 className="font-semibold text-white">Wallet Not Connected</h3>
              <p className="text-slate-400 text-sm">Connect your web3 wallet to submit transactions to the Sepolia / Local EVM network.</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {activeTab === "register" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                Register New Carbon Project
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                Establish the cryptographic anchor between your external registry listing and CarbonVault on-chain state.
              </p>
            </div>

            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Project Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tumucumaque Mountains National Park REDD+"
                  value={regForm.name}
                  onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Methodology *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. VM0007 / ACM0002"
                    value={regForm.methodology}
                    onChange={(e) => setRegForm({ ...regForm, methodology: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Host Country *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Brazil / Kenya / Iceland"
                    value={regForm.country}
                    onChange={(e) => setRegForm({ ...regForm, country: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Vintage Start Year *
                  </label>
                  <input
                    type="number"
                    min="1990"
                    max="2050"
                    required
                    value={regForm.vintageStart}
                    onChange={(e) => setRegForm({ ...regForm, vintageStart: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Vintage End Year *
                  </label>
                  <input
                    type="number"
                    min="1990"
                    max="2050"
                    required
                    value={regForm.vintageEnd}
                    onChange={(e) => setRegForm({ ...regForm, vintageEnd: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    External Registry *
                  </label>
                  <select
                    value={regForm.externalRegistry}
                    onChange={(e) => setRegForm({ ...regForm, externalRegistry: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="Verra VCS">Verra (VCS)</option>
                    <option value="Gold Standard">Gold Standard</option>
                    <option value="Climate Action Reserve">Climate Action Reserve (CAR)</option>
                    <option value="American Carbon Registry">American Carbon Registry (ACR)</option>
                    <option value="Plan Vivo">Plan Vivo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    External Project ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. VCS-1122 or GS-7740"
                    value={regForm.externalProjectId}
                    onChange={(e) => setRegForm({ ...regForm, externalProjectId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Double registration of identical IDs is rejected on-chain.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Project Design Document (IPFS CID) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ipfs://bafybeic..."
                  value={regForm.ipfsDocumentHash}
                  onChange={(e) => setRegForm({ ...regForm, ipfsDocumentHash: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-emerald-400 focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <p className="text-[11px] text-slate-500 mt-1">Cryptographic hash of the public validation report & methodology filing.</p>
              </div>

              {regError && (
                <div className="p-4 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{regError.message}</span>
                </div>
              )}

              {isRegSuccess && (
                <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Registration Successful!</strong> Your project has been submitted to the auditor review queue.
                    <div className="font-mono text-[11px] text-slate-400 mt-1 break-all">Tx: {regHash}</div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!isConnected || isRegPending || isRegWaiting}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isRegPending || isRegWaiting ? (
                  <>
                    <Clock className="w-5 h-5 animate-spin" />
                    Submitting Registration to Blockchain...
                  </>
                ) : (
                  <>
                    <Building2 className="w-5 h-5" />
                    Submit Project for Auditor Review
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Sidebar Guidelines */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Anti-Collision Verification
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                CarbonVault uses a deterministic hash constraint to prevent duplicate on-chain listings:
              </p>
              <div className="mt-3 bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-300">
                keccak256(externalRegistry, externalProjectId)
              </div>
              <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                If another developer has already claimed this project identifier, the contract transaction will revert with <code className="text-rose-300">ProjectAlreadyRegistered</code>.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-base font-bold text-white flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-amber-400" />
                Quick Demo Values
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Click below to populate sample conservation initiative data:
              </p>
              <button
                type="button"
                onClick={() => {
                  const rand = Math.floor(1000 + Math.random() * 9000);
                  setRegForm({
                    name: `Rimba Raya Peatland Conservation #${rand}`,
                    methodology: "VM0004 - Avoided Deforestation",
                    country: "Indonesia",
                    vintageStart: "2022",
                    vintageEnd: "2031",
                    externalRegistry: "Verra VCS",
                    externalProjectId: `VCS-${rand}`,
                    ipfsDocumentHash: `ipfs://bafybeir${rand}rimba-raya-pdd-summary`,
                  });
                }}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg transition-colors border border-slate-700"
              >
                Autofill Peatland Project
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Issuance Tab */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-emerald-400" />
                Issue ERC-1155 Credit Batch
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                Tokenize verified tonnes for a specific vintage year under an auditor-approved project.
              </p>
            </div>

            <form onSubmit={handleIssue} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Select Verified Project *
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="">-- Choose a Verified Project --</option>
                  {projects
                    .filter((p) => p.status === "Verified")
                    .map((p) => (
                      <option key={p.project_id} value={p.project_id}>
                        #{p.project_id}: {p.name} ({p.external_registry} {p.external_project_id})
                      </option>
                    ))}
                </select>
              </div>

              {selectedProject && (
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Auditor Cap (Max Tonnes):</span>
                    <span className="font-semibold text-white">{selectedProject.estimated_max_tonnes?.toLocaleString()} tCO₂e</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Cumulative Issued:</span>
                    <span className="font-semibold text-emerald-400">{selectedProject.cumulative_issued_tonnes?.toLocaleString()} tCO₂e</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Remaining Issuable Tonnes:</span>
                    <span className="font-bold text-amber-400">{remainingIssuable.toLocaleString()} tCO₂e</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, ((selectedProject.cumulative_issued_tonnes || 0) / (selectedProject.estimated_max_tonnes || 1)) * 100)}%`
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Vintage Year *
                  </label>
                  <input
                    type="number"
                    min="1990"
                    max="2050"
                    required
                    value={issueForm.vintage}
                    onChange={(e) => setIssueForm({ ...issueForm, vintage: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Quantity to Mint (Tonnes) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={remainingIssuable || undefined}
                    required
                    placeholder="e.g. 50000"
                    value={issueForm.quantity}
                    onChange={(e) => setIssueForm({ ...issueForm, quantity: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Must not exceed remaining issuable: {remainingIssuable.toLocaleString()} t</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    External Serial Range Start *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. VCS-1122-2023-00001"
                    value={issueForm.serialStart}
                    onChange={(e) => setIssueForm({ ...issueForm, serialStart: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-emerald-400 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    External Serial Range End *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. VCS-1122-2023-50000"
                    value={issueForm.serialEnd}
                    onChange={(e) => setIssueForm({ ...issueForm, serialEnd: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-emerald-400 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Registry Issuance Statement (IPFS CID) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ipfs://bafybeih..."
                  value={issueForm.issuanceProof}
                  onChange={(e) => setIssueForm({ ...issueForm, issuanceProof: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-emerald-400 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Recipient Address *
                </label>
                <input
                  type="text"
                  required
                  value={issueForm.recipient}
                  onChange={(e) => setIssueForm({ ...issueForm, recipient: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {issueError && (
                <div className="p-4 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{issueError.message}</span>
                </div>
              )}

              {isIssueSuccess && (
                <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Batch Issued Successfully!</strong> ERC-1155 tokens minted to recipient.
                    <div className="font-mono text-[11px] text-slate-400 mt-1 break-all">Tx: {issueHash}</div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!isConnected || !selectedProjectId || isIssuePending || isIssueWaiting || Number(issueForm.quantity) > remainingIssuable}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isIssuePending || isIssueWaiting ? (
                  <>
                    <Clock className="w-5 h-5 animate-spin" />
                    Minting Batch Tokens on Ethereum...
                  </>
                ) : (
                  <>
                    <Coins className="w-5 h-5" />
                    Mint ERC-1155 Credit Batch
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Issuance Sidebar */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-base font-bold text-white flex items-center gap-2 mb-3">
                <Layers className="w-5 h-5 text-emerald-400" />
                Anti-Double Issuance
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Smart contract enforces two cryptographic invariants:
              </p>
              <ul className="text-xs text-slate-300 space-y-2 mt-3 list-disc pl-4">
                <li>
                  <strong>Issuance Cap:</strong> Total cumulative issuance across all batches for a project cannot exceed the verifier&apos;s attested cap.
                </li>
                <li>
                  <strong>Serial Uniqueness:</strong> The serial number range is hashed. Minting an identical serial range reverts with <code className="text-rose-300">SerialRangeAlreadyIssued</code>.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Existing Projects Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-white">Registered Carbon Projects</h3>
            <p className="text-xs text-slate-400">All conservation initiatives registered in CarbonVault.</p>
          </div>
          <Link href="/projects" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
            View All in Public Directory <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-10 text-slate-500">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm">No registered projects found yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Registry Anchor</th>
                  <th className="py-3 px-4">Country</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Auditor Cap</th>
                  <th className="py-3 px-4">Issued</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {projects.map((p) => (
                  <tr key={p.project_id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-white">#{p.project_id}</td>
                    <td className="py-3.5 px-4 font-medium text-white max-w-xs truncate">{p.name}</td>
                    <td className="py-3.5 px-4 font-mono text-emerald-400">
                      {p.external_registry}: {p.external_project_id}
                    </td>
                    <td className="py-3.5 px-4">{p.country}</td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      {p.estimated_max_tonnes ? `${p.estimated_max_tonnes.toLocaleString()} t` : "Pending"}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-emerald-400">
                      {p.cumulative_issued_tonnes?.toLocaleString() || 0} t
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/projects/${p.project_id}`}
                        className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold"
                      >
                        Details <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
