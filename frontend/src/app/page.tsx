"use client";

import { ConnectButton } from "@/components/wallet/ConnectButton";
import { ShieldCheck } from "lucide-react";

/**
 * Home page shell for the Provenance & Authenticity Verification Platform.
 *
 * TODO (next phase): Replace this shell with:
 *   - <UploadPanel />      — drag & drop image upload → POST /api/register
 *   - <VerifyPanel />      — upload to verify → POST /api/verify
 *   - <QRDisplay />        — renders QR code from assetId after registration
 *   - <AnchorButton />     — calls ProvenanceRegistry.anchorHash() on Monad
 */
export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center">

      {/* Navbar */}
      <nav className="w-full max-w-7xl px-6 py-4 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">Vertilens</span>
        </div>
        <div>
          <ConnectButton />
        </div>
      </nav>

      {/* Main Content */}
      <div className="w-full max-w-7xl px-6 py-12 md:py-24 flex flex-col items-center flex-1">
        <div className="text-center max-w-3xl mb-12">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
            Digital Content Provenance
          </h1>
          <p className="text-lg md:text-xl text-slate-400">
            Register. Anchor. Verify. Detect tampering in seconds.
          </p>
        </div>

        {/* Upload + Verify panels go here in the next phase */}
        <div className="w-full max-w-3xl rounded-xl border border-slate-800 bg-slate-900/50 p-12 text-center text-slate-500">
          UI coming next phase — APIs are live at <code className="text-emerald-400">/api/register</code> and <code className="text-emerald-400">/api/verify</code>
        </div>
      </div>

      <footer className="w-full py-6 text-center text-sm text-slate-600 border-t border-slate-900 mt-auto">
        <p>Vertilens · Nexora &apos;26 Hackathon</p>
      </footer>
    </main>
  );
}
