"use client";

import { useState } from "react";
import { Search, ShieldAlert, ShieldCheck, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function VerifyPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<"authentic" | "tampered" | null>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFile = (f: File) => {
    setFile(f);
    setIsVerifying(true);
    setResult(null);

    // Simulate backend verification
    setTimeout(() => {
      setIsVerifying(false);
      setResult(Math.random() > 0.5 ? "authentic" : "tampered");
    }, 2000);
  };

  const reset = () => {
    setFile(null);
    setResult(null);
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-[#0a0a0a] border border-zinc-800 rounded-xl p-10 hover:border-lime-500/30 transition-colors duration-500 shadow-2xl">
      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center h-64 border border-dashed transition-all cursor-pointer rounded-lg ${
              isDragging ? "border-lime-500 bg-lime-500/5 shadow-[inset_0_0_20px_rgba(132,204,22,0.1)]" : "border-zinc-800 hover:border-lime-500/50 bg-black"
            }`}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.onchange = (e: any) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0]);
                }
              };
              input.click();
            }}
          >
            <Search className={`w-12 h-12 mb-4 transition-colors ${isDragging ? "text-lime-500" : "text-lime-500/70 drop-shadow-[0_0_8px_rgba(132,204,22,0.4)]"}`} strokeWidth={1.5} />
            <h3 className="text-white text-lg font-medium mb-1">Inspect Provenance</h3>
            <p className="text-zinc-500 text-sm">Upload a file to run cryptographic & perceptual checks</p>
          </motion.div>
        ) : isVerifying ? (
          <motion.div
            key="verifying"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center h-64 border border-zinc-800 bg-black rounded-lg"
          >
            <div className="w-14 h-14 border-[3px] border-zinc-800 border-t-lime-500 rounded-full animate-spin mb-6 shadow-[0_0_15px_rgba(132,204,22,0.2)]" />
            <p className="text-zinc-200 font-medium tracking-wide">Validating Asset...</p>
            <p className="text-lime-500 text-xs font-mono mt-2 drop-shadow-[0_0_5px_rgba(132,204,22,0.8)]">Computing Proof Score Algorithm</p>
          </motion.div>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center"
          >
            {result === "authentic" ? (
              <div className="w-full bg-lime-950/10 border border-lime-500/30 rounded-lg p-10 text-center relative overflow-hidden shadow-[0_0_30px_rgba(132,204,22,0.05)]">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-lime-600 to-lime-400" />
                <ShieldCheck className="w-20 h-20 text-lime-500 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(132,204,22,0.6)]" strokeWidth={1.5} />
                <h3 className="text-3xl font-bold text-white mb-3 tracking-tight">Expert Validation Passed</h3>
                <p className="text-zinc-400 text-base mb-8 max-w-md mx-auto">
                  Exact cryptographic match found on the blockchain. The asset is a verified original.
                </p>
                <div className="inline-block bg-black border border-zinc-800 rounded-lg p-5 text-left w-full max-w-sm hover:border-lime-500/30 transition-colors">
                  <div className="mb-3">
                    <span className="text-zinc-500 text-xs font-medium block mb-1">Asset Trace ID</span>
                    <span className="font-mono text-sm text-lime-400 drop-shadow-[0_0_2px_rgba(132,204,22,0.5)]">f47ac10b-58cc-4372-a567-0e02b2c3d479</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-xs font-medium block mb-1">Timestamp</span>
                    <span className="font-mono text-sm text-zinc-300">{new Date().toISOString()}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full bg-red-950/10 border border-red-500/30 rounded-lg p-10 text-center relative overflow-hidden shadow-[0_0_30px_rgba(239,68,68,0.05)]">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-400" />
                <ShieldAlert className="w-20 h-20 text-red-500 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(239,68,68,0.6)]" strokeWidth={1.5} />
                <h3 className="text-3xl font-bold text-white mb-3 tracking-tight">Validation Failed</h3>
                <p className="text-zinc-400 text-base mb-8 max-w-md mx-auto">
                  No exact match found. The Proof Score Algorithm shows strong perceptual similarity to a registered asset, indicating unauthorised modification.
                </p>
                <div className="inline-block bg-black border border-zinc-800 rounded-lg p-5 text-left w-full max-w-sm hover:border-red-500/30 transition-colors">
                  <div>
                    <span className="text-zinc-500 text-xs font-medium block mb-1">Anomaly Detected</span>
                    <span className="font-mono text-sm text-red-400 drop-shadow-[0_0_2px_rgba(239,68,68,0.5)]">Hamming Distance Deviation: 10 bits</span>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={reset}
              className="mt-8 flex items-center gap-2 text-sm text-zinc-500 hover:text-lime-400 transition-colors font-medium"
            >
              <RefreshCw className="w-4 h-4" strokeWidth={2} />
              Validate Another Asset
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
