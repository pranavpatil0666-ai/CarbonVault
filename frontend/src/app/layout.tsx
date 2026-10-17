import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { NetworkAlertBanner } from "@/components/NetworkAlertBanner";
import Link from "next/link";
import { ShieldCheck, ExternalLink, Globe2 } from "lucide-react";

export const metadata: Metadata = {
  title: "CarbonVault | Transparent On-Chain Carbon Credit Ledger & Marketplace",
  description: "Auditable lifecycle tracking of verified carbon credits anchored to established registries (Verra, Gold Standard).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 flex flex-col min-h-screen antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
        <Providers>
          <DisclaimerBanner />
          <Navbar />
          <NetworkAlertBanner />
          <main className="flex-1">{children}</main>
          <footer className="bg-slate-950 border-t border-slate-900 py-12 px-4 sm:px-6 lg:px-8 mt-20 text-xs text-slate-400">
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
              <div className="space-y-3 md:col-span-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-white text-sm">CarbonVault Protocol</span>
                </div>
                <p className="text-slate-400 leading-relaxed max-w-lg">
                  CarbonVault provides an immutable, transparent registry recording the complete lifecycle of third-party attested carbon credits. The blockchain does not establish real-world additionality; it prevents double-issuance, enforces verifier-approved caps, and verifies irreversible on-chain retirements.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-slate-200 text-sm mb-3">Anchored Registries</h4>
                <ul className="space-y-2 text-slate-400">
                  <li className="flex items-center gap-1.5 hover:text-white transition">
                    <Globe2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Verra Verified Carbon Standard (VCS)</span>
                  </li>
                  <li className="flex items-center gap-1.5 hover:text-white transition">
                    <Globe2 className="w-3.5 h-3.5 text-teal-400" />
                    <span>Gold Standard for the Global Goals</span>
                  </li>
                  <li className="flex items-center gap-1.5 hover:text-white transition">
                    <Globe2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Climate Action Reserve (CAR)</span>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-slate-200 text-sm mb-3">Protocols & Portals</h4>
                <ul className="space-y-2 text-slate-400">
                  <li><Link href="/projects" className="hover:text-emerald-400 transition">Projects Directory</Link></li>
                  <li><Link href="/marketplace" className="hover:text-emerald-400 transition">Spot Marketplace</Link></li>
                  <li><Link href="/developer" className="hover:text-emerald-400 transition">Developer Registration</Link></li>
                  <li><Link href="/verifier" className="hover:text-emerald-400 transition">Auditor Review Queue</Link></li>
                  <li><Link href="/portfolio" className="hover:text-emerald-400 transition">Retirement Certificates</Link></li>
                </ul>
              </div>
            </div>

            <div className="max-w-7xl mx-auto pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                &copy; 2026 CarbonVault Protocol. Open-source under MIT License.
              </div>
              <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
                <span>Hardhat Localhost #31337</span>
                <span>•</span>
                <span>Sepolia Testnet #11155111</span>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
