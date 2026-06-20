"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Cpu,
  Fingerprint,
  Activity,
  ArrowLeft,
  ArrowRight,
  Upload,
  Link2,
  Search,
} from "lucide-react";

export default function AboutPage() {
  const [showSplash, setShowSplash] = useState(true);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const splashTimer = setTimeout(() => setShowSplash(false), 2600);
    const contentTimer = setTimeout(() => setShowContent(true), 2800);
    return () => {
      clearTimeout(splashTimer);
      clearTimeout(contentTimer);
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-zinc-300 relative overflow-x-hidden font-sans">

      {/* ── Splash Animation ──────────────────────────────────────── */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="about-splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.6, ease: "easeInOut" } }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center gap-6"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.8, type: "spring", bounce: 0.5 }}
              className="w-24 h-24 drop-shadow-[0_0_40px_rgba(132,204,22,0.6)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Veritas" className="w-full h-full object-contain" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="text-center"
            >
              <span className="text-4xl font-black tracking-[0.2em] text-white uppercase">
                VERITAS
              </span>
              <p className="text-lime-500 text-sm font-mono mt-2 tracking-widest">
                PROVENANCE LAYER
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showContent && (
          <motion.div
            key="about-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="min-h-screen"
          >
            {/* Ambient background */}
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(132,204,22,0.06),transparent_60%)] pointer-events-none" />

            {/* Navbar */}
            <nav className="w-full px-8 py-6 flex items-center justify-between border-b border-zinc-900 relative z-10">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Veritas Logo" className="w-9 h-9 drop-shadow-[0_0_12px_rgba(132,204,22,0.4)]" />
                <span className="text-lg font-bold tracking-tight text-white">Veritas</span>
              </div>
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-lime-400 transition-colors font-medium group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Back to App
              </Link>
            </nav>

            <div className="max-w-5xl mx-auto px-6 pt-16 pb-24 relative z-10">

              {/* ── Hero Description ─────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="mb-20 max-w-3xl"
              >
                <div className="inline-flex items-center px-3 py-1 rounded-full border border-zinc-800 bg-zinc-950 mb-6 text-xs font-mono text-lime-500 tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-lime-500 mr-2 animate-pulse" />
                  0x.PROVENANCE-LAYER · NEXORA &apos;26
                </div>
                <h1 className="text-5xl md:text-6xl font-black text-white mb-6 leading-tight tracking-tight">
                  What is <span className="text-lime-400">Veritas</span>?
                </h1>
                <p className="text-lg text-zinc-400 leading-relaxed mb-6">
                  Veritas is a <strong className="text-white">digital content provenance platform</strong> that lets you prove the origin and integrity of any image — permanently and without trust in a central authority.
                </p>
                <p className="text-base text-zinc-500 leading-relaxed">
                  Every file you upload gets its own cryptographic fingerprint (SHA-256 + perceptual hash), which is anchored directly onto the <span className="text-lime-400 font-medium">Monad blockchain</span>. Later, anyone can upload that file — or a suspected copy — and instantly know if it&apos;s the original, a manipulated version, or completely unregistered.
                </p>
              </motion.div>

              {/* ── How to Use ───────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mb-20"
              >
                <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                  <span className="w-8 h-[2px] bg-lime-500" />
                  How to Use
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      step: "01",
                      icon: Upload,
                      title: "Register",
                      desc: "Go to the main page and drag & drop your image into the Register Asset panel. The system computes SHA-256 + perceptual hash and stores them in the database.",
                    },
                    {
                      step: "02",
                      icon: Link2,
                      title: "Anchor",
                      desc: 'Click "Anchor to Blockchain". The cryptographic fingerprint is written to the Monad Testnet ProvenanceRegistry smart contract — creating an immutable, timestamped record.',
                    },
                    {
                      step: "03",
                      icon: Search,
                      title: "Verify",
                      desc: 'Switch to "Verify Authenticity" and upload any image. Veritas checks both hashes and reports whether it\'s an original, a tampered copy, or unregistered.',
                    },
                  ].map(({ step, icon: Icon, title, desc }) => (
                    <div
                      key={step}
                      className="bg-[#0a0a0a] border border-zinc-800 rounded-xl p-7 hover:border-lime-500/30 transition-colors group"
                    >
                      <div className="flex items-center justify-between mb-5">
                        <span className="text-4xl font-black text-zinc-800 group-hover:text-zinc-700 transition-colors font-mono">
                          {step}
                        </span>
                        <Icon className="w-7 h-7 text-lime-500" strokeWidth={1.5} />
                      </div>
                      <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
                      <p className="text-zinc-500 text-sm leading-relaxed">{desc}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* ── Architecture Pillars ─────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mb-20"
              >
                <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                  <span className="w-8 h-[2px] bg-lime-500" />
                  System Architecture
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    {
                      icon: ShieldCheck,
                      title: "Digital Content Provenance",
                      desc: "Every registered asset generates a deterministic SHA-256 fingerprint alongside a 256-bit perceptual hash (aHash). This dual-layer approach secures both the exact binary data and the visual semantic structure, ensuring provenance cannot be bypassed by superficial edits.",
                    },
                    {
                      icon: Fingerprint,
                      title: "Cryptographic Identity",
                      desc: "Asset hashes are bound to an immutable on-chain record. The metadata — including the time of minting and the transaction hash — forms a permanent proof of ownership that is independently verifiable without relying on a centralised database.",
                    },
                    {
                      icon: Cpu,
                      title: "AI Forensic Analysis",
                      desc: "During verification, assets undergo Hamming distance comparisons against the registered baseline. If tampering is detected, Gemini 1.5 Pro analyses the specific deviations to provide a human-readable forensic report explaining the likely nature of the modification.",
                    },
                    {
                      icon: Activity,
                      title: "Monad Blockchain Anchoring",
                      desc: "Asset hashes are anchored directly to the Monad Testnet via the ProvenanceRegistry smart contract. Leveraging Monad's extreme throughput and parallel execution, the platform provides real-time, low-latency finality for all provenance records.",
                    },
                  ].map(({ icon: Icon, title, desc }) => (
                    <div
                      key={title}
                      className="bg-[#0a0a0a] border border-zinc-800 rounded-xl p-8 hover:border-lime-500/30 transition-colors group"
                    >
                      <Icon className="w-10 h-10 text-lime-500 mb-5 group-hover:drop-shadow-[0_0_12px_rgba(132,204,22,0.5)] transition-all" strokeWidth={1.5} />
                      <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
                      <p className="text-zinc-400 text-sm leading-relaxed">{desc}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* ── CTA ──────────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="text-center border border-zinc-800 rounded-2xl p-12 bg-[#0a0a0a] hover:border-lime-500/20 transition-colors"
              >
                <p className="text-zinc-500 text-sm font-mono mb-4 tracking-widest">READY TO BEGIN?</p>
                <h2 className="text-3xl font-black text-white mb-4">Register Your First Asset</h2>
                <p className="text-zinc-400 mb-8 max-w-md mx-auto text-sm">
                  Your image. Your proof. Permanently on-chain.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 bg-lime-500 hover:bg-lime-400 text-black font-bold px-8 py-3 rounded-lg transition-all shadow-[0_0_20px_rgba(132,204,22,0.3)] hover:shadow-[0_0_30px_rgba(132,204,22,0.5)] text-sm"
                >
                  Open the App
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </div>

            {/* Footer */}
            <footer className="text-center py-8 text-xs text-zinc-700 border-t border-zinc-900">
              Veritas · Veritas &apos;26 Hackathon
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
