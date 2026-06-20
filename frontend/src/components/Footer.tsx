"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowDown, ShieldCheck, ShieldAlert, SearchX } from "lucide-react";

export function Footer() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <footer className="w-full border-t border-zinc-900 bg-black py-12 relative z-10">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12 text-sm">
          
          {/* Left Column */}
          <div className="flex flex-col gap-4">
            <h4 className="text-white font-bold tracking-widest uppercase mb-2">Veritas &copy; 2026</h4>
            <div className="text-zinc-400 space-y-4">
              <p className="font-medium text-zinc-300">
                Digital Content Provenance &amp;<br />
                Authenticity Verification
              </p>
              <p className="text-xs leading-relaxed">
                Built for secure ownership,<br />
                verification and trust.
              </p>
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="mt-4 text-left w-fit text-lime-500 hover:text-lime-400 hover:underline underline-offset-4 font-mono text-xs tracking-wider transition-colors"
            >
              [ View Architecture Walkthrough ]
            </button>
          </div>

          {/* Center Column */}
          <div className="flex flex-col gap-4">
            <h4 className="text-zinc-500 font-bold tracking-widest uppercase mb-2 text-xs">Tech Stack</h4>
            <ul className="text-zinc-400 space-y-3 font-mono text-xs">
              <li className="flex items-center gap-2"><div className="w-1 h-1 bg-zinc-700 rounded-full"/> Monad Testnet</li>
              <li className="flex items-center gap-2"><div className="w-1 h-1 bg-zinc-700 rounded-full"/> Next.js</li>
              <li className="flex items-center gap-2"><div className="w-1 h-1 bg-zinc-700 rounded-full"/> Supabase</li>
              <li className="flex items-center gap-2"><div className="w-1 h-1 bg-zinc-700 rounded-full"/> Gemini AI</li>
              <li className="flex items-center gap-2"><div className="w-1 h-1 bg-zinc-700 rounded-full"/> Solidity</li>
              <li className="flex items-center gap-2"><div className="w-1 h-1 bg-zinc-700 rounded-full"/> Wagmi + RainbowKit</li>
            </ul>
          </div>

          {/* Right Column */}
          <div className="flex flex-col gap-4">
            <h4 className="text-zinc-500 font-bold tracking-widest uppercase mb-2 text-xs">System Status</h4>
            <ul className="text-zinc-300 space-y-3 font-mono text-xs">
              <li className="flex items-center gap-3">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-lime-500"></span>
                </div>
                Network Online
              </li>
              <li className="flex items-center gap-3">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-lime-500"></span>
                </div>
                AI Engine Active
              </li>
              <li className="flex items-center gap-3">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-lime-500"></span>
                </div>
                Storage Connected
              </li>
              <li className="flex items-center gap-3">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-lime-500"></span>
                </div>
                Blockchain Verified
              </li>
            </ul>
          </div>

        </div>
      </footer>

      {/* Architecture Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0a0a0a] border border-zinc-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative custom-scrollbar"
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="sticky top-6 float-right mr-6 p-2 bg-zinc-900 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors z-20"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-8 md:p-12 space-y-16">
                
                {/* Header */}
                <div className="text-center space-y-4">
                  <h2 className="text-3xl font-bold text-white tracking-tight uppercase">System Architecture</h2>
                  <p className="text-lime-500 font-mono text-sm tracking-widest">VERITAS PLATFORM ENGINE</p>
                </div>

                {/* Section 1: How it works */}
                <section>
                  <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4 border-b border-zinc-800 pb-2">How Veritas Works</h3>
                  <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-lg text-zinc-300 leading-relaxed text-sm">
                    Veritas creates tamper-evident provenance records for digital content by combining cryptographic hashing, blockchain anchoring, perceptual similarity analysis, and AI-powered forensic explanations.
                  </div>
                </section>

                {/* Section 2: Register Flow */}
                <section>
                  <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4 border-b border-zinc-800 pb-2">Register Flow</h3>
                  <div className="flex flex-col items-center gap-2 bg-black border border-zinc-800 rounded-lg p-8">
                    <FlowStep text="User Upload" />
                    <FlowArrow />
                    <FlowStep text="Generate SHA-256 Fingerprint" />
                    <FlowArrow />
                    <FlowStep text="Store Metadata in Supabase" />
                    <FlowArrow />
                    <FlowStep text="Anchor Hash on Monad Blockchain" highlight />
                    <FlowArrow />
                    <FlowStep text="Generate Trace ID & QR Certificate" />
                    <FlowArrow />
                    <FlowStep text="Asset Becomes Permanently Verifiable" highlight />
                  </div>
                </section>

                {/* Section 3: Verify Flow */}
                <section>
                  <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4 border-b border-zinc-800 pb-2">Verify Flow</h3>
                  <div className="flex flex-col items-center gap-2 bg-black border border-zinc-800 rounded-lg p-8">
                    <FlowStep text="Upload Asset" />
                    <FlowArrow />
                    <FlowStep text="Generate New Fingerprint" />
                    <FlowArrow />
                    <FlowStep text="Exact SHA-256 Match Check" />
                    <FlowArrow />
                    <FlowStep text="Perceptual Hash Similarity Analysis" highlight />
                    <FlowArrow />
                    <FlowStep text="Blockchain Provenance Lookup" />
                    <FlowArrow />
                    <FlowStep text="Gemini AI Forensic Analysis" highlight />
                    <FlowArrow />
                    
                    <div className="grid grid-cols-3 gap-4 w-full max-w-lg mt-4">
                      <div className="bg-lime-950/30 border border-lime-500/30 rounded p-3 text-center text-lime-500 text-xs font-bold">Authentic</div>
                      <div className="bg-red-950/30 border border-red-500/30 rounded p-3 text-center text-red-500 text-xs font-bold">Tampered</div>
                      <div className="bg-amber-950/30 border border-amber-500/30 rounded p-3 text-center text-amber-500 text-xs font-bold">Not Found</div>
                    </div>
                  </div>
                </section>

                {/* Section 4: Verification States */}
                <section>
                  <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4 border-b border-zinc-800 pb-2">Verification States</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Authentic */}
                    <div className="bg-lime-950/10 border border-lime-500/30 rounded-xl p-6 shadow-[0_0_20px_rgba(132,204,22,0.05)] relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-lime-600 to-lime-400" />
                      <ShieldCheck className="w-8 h-8 text-lime-500 mb-4" />
                      <h4 className="text-lime-500 font-bold mb-3 tracking-widest text-xs uppercase">Authentic</h4>
                      <div className="text-zinc-400 text-xs space-y-2">
                        <p>Blockchain record found.</p>
                        <p>Content matches registered fingerprint.</p>
                      </div>
                    </div>

                    {/* Tampered */}
                    <div className="bg-red-950/10 border border-red-500/30 rounded-xl p-6 shadow-[0_0_20px_rgba(239,68,68,0.05)] relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-400" />
                      <ShieldAlert className="w-8 h-8 text-red-500 mb-4" />
                      <h4 className="text-red-500 font-bold mb-3 tracking-widest text-xs uppercase">Tampered</h4>
                      <div className="text-zinc-400 text-xs space-y-2">
                        <p>Blockchain record found.</p>
                        <p>Content differs from registered fingerprint.</p>
                        <p className="text-red-400/80 mt-4 border-t border-red-500/20 pt-2">AI identifies structural or visual modifications.</p>
                      </div>
                    </div>

                    {/* Not Found */}
                    <div className="bg-amber-950/10 border border-amber-500/30 rounded-xl p-6 shadow-[0_0_20px_rgba(245,158,11,0.05)] relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-600 to-amber-400" />
                      <SearchX className="w-8 h-8 text-amber-500 mb-4" />
                      <h4 className="text-amber-500 font-bold mb-3 tracking-widest text-xs uppercase">Not Found</h4>
                      <div className="text-zinc-400 text-xs space-y-2">
                        <p>No matching provenance record exists.</p>
                        <p>Asset has never been registered on Veritas.</p>
                      </div>
                    </div>
                  </div>
                </section>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

// Helper components for the flow diagrams
function FlowStep({ text, highlight = false }: { text: string; highlight?: boolean }) {
  return (
    <div className={`px-6 py-3 rounded-lg border text-sm font-medium w-full max-w-sm text-center transition-colors ${
      highlight 
        ? "bg-lime-500/10 border-lime-500/50 text-lime-400 shadow-[0_0_15px_rgba(132,204,22,0.1)]" 
        : "bg-zinc-900 border-zinc-800 text-zinc-300"
    }`}>
      {text}
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="py-2 text-zinc-600">
      <ArrowDown className="w-5 h-5" />
    </div>
  );
}
