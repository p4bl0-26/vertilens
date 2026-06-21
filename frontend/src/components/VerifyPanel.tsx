"use client";

import { useState, useEffect } from "react";
import { Search, ShieldAlert, ShieldCheck, RefreshCw, SearchX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function VerifyPanel({ onThemeChange }: { onThemeChange?: (theme: "theme-lime" | "theme-red" | "theme-amber" | "") => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStep, setVerifyStep] = useState(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<{risk: string, confidence: number, reasons: string[]} | null>(null);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFile = async (f: File) => {
    setFile(f);
    setIsVerifying(true);
    setVerifyStep(1);
    setResult(null);
    setExplanation(null);
    setErrorMsg(null);
    setAiAnalysis(null);
    setIsAiAnalyzing(false);

    const formData = new FormData();
    formData.append("image", f);

    const enableAiAnalysis = process.env.NEXT_PUBLIC_ENABLE_AI_ANALYSIS === "true";
    
    if (enableAiAnalysis) {
      setIsAiAnalyzing(true);
      fetch("/api/ai-analysis", {
        method: "POST",
        body: formData,
      })
        .then((res) => res.json())
        .then((data) => {
          setAiAnalysis(data);
        })
        .catch((err) => {
          console.error("AI Analysis failed:", err);
          setAiAnalysis({
            risk: "UNKNOWN",
            confidence: 0,
            reasons: ["AI analysis unavailable"]
          });
        })
        .finally(() => {
          setIsAiAnalyzing(false);
        });
    }
    // Simulate pipeline progress for UX while single API executes
    const t1 = setTimeout(() => setVerifyStep(2), 1500);
    const t2 = setTimeout(() => setVerifyStep(3), 3500);

    try {
      // 1. Run Verification
      const verifyRes = await fetch("/api/verify", {
        method: "POST",
        body: formData,
      });
      
      clearTimeout(t1);
      clearTimeout(t2);
      let verifyData;
      try {
        verifyData = await verifyRes.json();
      } catch {
        throw new Error("Server returned an invalid response. The file might be too large or the server is down.");
      }

      if (!verifyRes.ok || !verifyData?.success) {
        throw new Error(verifyData?.error?.message || "Verification failed");
      }

      setResult(verifyData.data);
      
      if (verifyData.data.status === "VERIFIED_ORIGINAL") {
        setExplanation("Exact cryptographic match found on the blockchain. The asset is a verified original.");
        setIsVerifying(false);
      } else if (verifyData.data.status === "LIKELY_TAMPERED") {
        setVerifyStep(4);
        setExplanation("Requesting AI forensic analysis...");
        try {
          const matched = verifyData.data.matchedAsset;
          const explainPayload = {
            originalAsset: {
              id: matched.id,
              filename: matched.filename,
              storagePath: matched.storage_path,
              sha256: matched.sha256,
              ahash: matched.ahash,
              width: matched.width,
              height: matched.height,
              fileSize: matched.file_size,
              imageUrl: "https://placeholder.supabase.co/storage/v1/object/public/assets/" + matched.storage_path,
              registeredAt: matched.created_at,
              txHash: matched.tx_hash,
              contractAddress: matched.contract_address,
              anchoredAt: matched.anchored_at,
            },
            uploadedAsset: {
              filename: f.name,
              sha256: verifyData.data.uploadedSha256 || "0000000000000000000000000000000000000000000000000000000000000000",
              ahash: verifyData.data.uploadedAhash || "0000000000000000000000000000000000000000000000000000000000000000",
              width: null,
              height: null,
              fileSize: f.size,
              mimeType: f.type,
            },
            hammingDistance: verifyData.data.hammingDistance,
            tamperLevel: verifyData.data.tamperLevel
          };

          const explainRes = await fetch("/api/explain", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(explainPayload),
          });

          let explainData;
          try {
            explainData = await explainRes.json();
          } catch {
            throw new Error("AI response was invalid.");
          }

          if (explainRes.ok && explainData?.success) {
            setExplanation(explainData.data.explanation);
          } else {
            setExplanation(verifyData.data.tamperDescription || "AI analysis failed.");
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          console.error("AI Explanation Error:", err);
          setExplanation("AI Forensic explanation unavailable. The asset exhibits structural differences.");
        }
        setIsVerifying(false);
      } else {
        // NOT_REGISTERED
        setIsVerifying(false);
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
      setIsVerifying(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setAiAnalysis(null);
    setIsAiAnalyzing(false);
    onThemeChange?.("");
  };

  const isNotFound = result?.status === "NOT_REGISTERED";
  const isAuthentic = result?.status === "VERIFIED_ORIGINAL" || result?.tamperLevel === "IDENTICAL" || result?.tamperLevel === "LIKELY_ORIGINAL";
  const isTampered = result && !isNotFound && !isAuthentic;

  // React to result changes and update theme
  useEffect(() => {
    if (!onThemeChange) return;
    if (!result) onThemeChange("");
    else if (isNotFound) onThemeChange("theme-amber");
    else if (isAuthentic) onThemeChange("theme-lime");
    else onThemeChange("theme-red");
  }, [result, isNotFound, isAuthentic, onThemeChange]);

  let wrapperClasses = "w-full max-w-4xl mx-auto border rounded-xl p-6 md:p-10 transition-colors duration-700 shadow-2xl relative overflow-hidden ";
  if (isTampered) {
    wrapperClasses += "bg-[#1a0505] border-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.15)]";
  } else if (isNotFound) {
    wrapperClasses += "bg-[#0a0a0a] border-amber-500/30 hover:border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.1)]";
  } else if (isAuthentic) {
    wrapperClasses += "bg-[#0a0a0a] border-lime-500/30 hover:border-lime-500/50 shadow-[0_0_30px_rgba(132,204,22,0.1)]";
  } else {
    wrapperClasses += "bg-[#0a0a0a] border-zinc-800 hover:border-lime-500/30";
  }

  const similarity = result?.hammingDistance !== undefined 
    ? ((256 - result.hammingDistance) / 256 * 100).toFixed(1)
    : "0.0";
  const tamperConfidence = result?.hammingDistance !== undefined
    ? (100 - parseFloat(similarity)).toFixed(1)
    : "100.0";

  return (
    <div className={wrapperClasses}>
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
            className={`flex flex-col items-center justify-center h-80 border border-dashed transition-all cursor-pointer rounded-lg ${
              isDragging ? "border-lime-500 bg-lime-500/5 shadow-[inset_0_0_20px_rgba(132,204,22,0.1)]" : "border-zinc-800 hover:border-lime-500/50 bg-black"
            }`}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              input.onchange = (e: any) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0]);
                }
              };
              input.click();
            }}
          >
            <Search className={`w-20 h-20 mb-6 transition-colors ${isDragging ? "text-lime-500" : "text-lime-500/70 drop-shadow-[0_0_8px_rgba(132,204,22,0.4)]"}`} strokeWidth={1.5} />
            <h3 className="text-white text-2xl font-medium mb-2">Inspect Provenance</h3>
            <p className="text-zinc-500 text-base">Upload a file to run cryptographic & perceptual checks</p>
          </motion.div>
        ) : isVerifying ? (
          <motion.div
            key="verifying"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center h-80 border border-brand-500/20 bg-[#0a0a0a] rounded-lg shadow-[0_0_30px_rgba(var(--brand-500),0.05)] relative overflow-hidden"
          >
            {/* Animated scanning line */}
            <motion.div 
              className="absolute top-0 left-0 w-full h-1 bg-brand-500 shadow-[0_0_15px_rgba(var(--brand-500),1)]"
              animate={{ top: ["0%", "100%", "0%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
            
            <div className="w-full max-w-sm px-6">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h4 className="text-zinc-500 text-xs font-bold tracking-widest uppercase mb-1">Investigation Pipeline</h4>
                  <div className="text-brand-500 font-mono text-lg font-bold">Step {verifyStep}/4</div>
                </div>
                <div className="w-8 h-8 border-[3px] border-zinc-800 border-t-brand-500 rounded-full animate-spin shadow-[0_0_10px_rgba(var(--brand-500),0.3)]" />
              </div>

              <div className="space-y-4">
                {[
                  { id: 1, label: "Generating Fingerprint" },
                  { id: 2, label: "Checking Blockchain Record" },
                  { id: 3, label: "Running Similarity Analysis" },
                  { id: 4, label: "Generating AI Forensic Report" },
                ].map((step) => (
                  <div key={step.id} className="flex items-center gap-4">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors duration-500 ${
                      verifyStep > step.id ? "bg-brand-500 text-black shadow-[0_0_10px_rgba(var(--brand-500),0.4)]" :
                      verifyStep === step.id ? "border-2 border-brand-500 text-brand-500 animate-pulse" :
                      "border-2 border-zinc-800 text-zinc-700"
                    }`}>
                      {verifyStep > step.id ? <ShieldCheck className="w-3 h-3" strokeWidth={3} /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                    </div>
                    <span className={`text-sm font-medium transition-colors duration-500 ${
                      verifyStep > step.id ? "text-zinc-300" :
                      verifyStep === step.id ? "text-brand-400 drop-shadow-[0_0_5px_rgba(var(--brand-500),0.5)]" :
                      "text-zinc-600"
                    }`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center"
          >
            {errorMsg ? (
              <div className="w-full bg-red-950/10 border border-red-500/30 rounded-lg p-10 text-center">
                <ShieldAlert className="w-32 h-32 text-red-500 mx-auto mb-8" strokeWidth={1.5} />
                <h3 className="text-xl font-bold text-white mb-3 tracking-tight">Error</h3>
                <p className="text-zinc-400">{errorMsg}</p>
              </div>
            ) : result.status === "NOT_REGISTERED" ? (
              <div className="w-full bg-amber-950/10 border border-amber-500/30 rounded-lg p-8 md:p-10 text-center relative overflow-hidden shadow-[0_0_30px_rgba(245,158,11,0.05)]">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-600 to-amber-400" />
                
                {/* Decorative Side Labels (Amber Theme) */}
                <div className="hidden md:flex absolute -left-8 top-16 flex-col items-end gap-6 opacity-40">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-amber-500 tracking-widest">MONAD_TESTNET</span>
                    <div className="w-12 h-[1px] bg-gradient-to-l from-amber-500 to-transparent" />
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    <span className="text-[10px] font-mono text-amber-500 tracking-widest">FORENSIC_SCAN</span>
                    <div className="w-6 h-[1px] bg-gradient-to-l from-amber-500 to-transparent" />
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    <span className="text-[10px] font-mono text-amber-500 tracking-widest">NO_MATCH_FOUND</span>
                    <div className="w-10 h-[1px] bg-gradient-to-l from-amber-500 to-transparent" />
                  </div>
                </div>

                <div className="relative inline-block mx-auto mb-8">
                   <div className="absolute inset-0 bg-amber-500/20 blur-2xl rounded-full animate-[pulse_3s_ease-in-out_infinite]" />
                   <SearchX className="w-32 h-32 text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.6)] relative z-10" strokeWidth={1.5} />
                </div>
                
                <h3 className="text-3xl font-bold text-white mb-3 tracking-tight">ASSET NOT FOUND</h3>
                <p className="text-zinc-400 text-base mb-8 max-w-md mx-auto">
                  No matching provenance record exists.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl mx-auto text-left relative z-10">
                  {/* Metrics Section */}
                  <div className="bg-black border border-amber-500/20 rounded-lg p-5 hover:border-amber-500/40 transition-colors shadow-[0_0_15px_rgba(245,158,11,0.02)]">
                    <h4 className="text-amber-500 text-sm font-bold mb-4 border-b border-amber-500/20 pb-2">Verification Metrics</h4>
                    <div className="space-y-3">
                      <div>
                        <span className="text-zinc-500 text-xs font-medium block mb-1">Blockchain Record</span>
                        <span className="font-mono text-sm text-zinc-300">Not Found</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 text-xs font-medium block mb-1">Provenance Match</span>
                        <span className="font-mono text-sm text-zinc-300">Unavailable</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 text-xs font-medium block mb-1">Verification Status</span>
                        <span className="font-mono text-sm text-amber-400 drop-shadow-[0_0_2px_rgba(245,158,11,0.5)]">Unregistered Asset</span>
                      </div>
                    </div>
                  </div>

                  {/* Possible Reasons Section */}
                  <div className="bg-black border border-amber-500/20 rounded-lg p-5 hover:border-amber-500/40 transition-colors shadow-[0_0_15px_rgba(245,158,11,0.02)]">
                    <h4 className="text-amber-500 text-sm font-bold mb-4 border-b border-amber-500/20 pb-2">Possible Reasons</h4>
                    <ul className="text-zinc-400 text-xs space-y-2 list-disc pl-4 leading-relaxed">
                      <li>This asset has never been registered on Veritas.</li>
                      <li>The uploaded file is heavily modified compared to the original.</li>
                      <li>The asset was registered on a different network or platform.</li>
                      <li>The QR code or Asset Trace ID is invalid.</li>
                      <li>The content may have been recreated from scratch rather than edited.</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-8 border-t border-amber-500/20 pt-6">
                  <p className="text-zinc-400 text-sm mb-4">Register this asset to create an immutable provenance record.</p>
                  <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="px-6 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded-full text-sm font-medium hover:bg-amber-500 hover:text-black transition-colors shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                  >
                    Register Asset
                  </button>
                </div>
              </div>
            ) : result.status === "VERIFIED_ORIGINAL" || result.tamperLevel === "IDENTICAL" || result.tamperLevel === "LIKELY_ORIGINAL" ? (
              <div className="w-full bg-lime-950/10 border border-lime-500/30 rounded-lg p-10 text-center relative overflow-hidden shadow-[0_0_30px_rgba(132,204,22,0.05)]">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-lime-600 to-lime-400" />
                <ShieldCheck className="w-32 h-32 text-lime-500 mx-auto mb-8 drop-shadow-[0_0_15px_rgba(132,204,22,0.6)]" strokeWidth={1.5} />
                <h3 className="text-3xl font-bold text-white mb-3 tracking-tight">Expert Validation Passed</h3>
                <p className="text-zinc-400 text-base mb-6 max-w-md mx-auto">
                  {explanation || "Exact cryptographic match found on the blockchain. The asset is a verified original."}
                </p>
                <div className="inline-block bg-black border border-zinc-800 rounded-lg p-5 text-left w-full max-w-sm hover:border-lime-500/30 transition-colors">
                  <div className="mb-3">
                    <span className="text-zinc-500 text-xs font-medium block mb-1">Asset Trace ID</span>
                    <span className="font-mono text-sm text-lime-400 drop-shadow-[0_0_2px_rgba(132,204,22,0.5)]">{result.matchedAsset?.id}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-xs font-medium block mb-1">Registered On</span>
                    <span className="font-mono text-sm text-zinc-300">{new Date(result.matchedAsset?.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full text-center relative z-10">
                {/* Decorative Side Labels (Red Theme) */}
                <div className="hidden md:flex absolute -left-12 top-0 flex-col items-end gap-6 opacity-60">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-red-500 tracking-widest animate-pulse">SECURITY_ALERT</span>
                    <div className="w-16 h-[1px] bg-gradient-to-l from-red-500 to-transparent" />
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    <span className="text-[10px] font-mono text-red-500 tracking-widest">INTEGRITY_BREACH</span>
                    <div className="w-8 h-[1px] bg-gradient-to-l from-red-500 to-transparent" />
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    <span className="text-[10px] font-mono text-red-500 tracking-widest">AI_FORENSICS</span>
                    <div className="w-12 h-[1px] bg-gradient-to-l from-red-500 to-transparent" />
                  </div>
                </div>

                <div className="relative inline-block mx-auto mb-6">
                   <div className="absolute inset-0 bg-red-600/30 blur-[30px] rounded-full animate-[pulse_2s_ease-in-out_infinite]" />
                   <ShieldAlert className="w-32 h-32 text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)] relative z-10 animate-pulse" strokeWidth={1.5} />
                </div>
                
                <h3 className="text-4xl font-black text-white mb-2 tracking-tighter drop-shadow-[0_0_10px_rgba(239,68,68,0.5)] uppercase">CONTENT INTEGRITY COMPROMISED</h3>
                <div className="inline-block bg-red-500/20 text-red-400 border border-red-500/50 px-4 py-1 rounded-full text-sm font-bold tracking-widest mb-8 animate-pulse uppercase shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                  Severity: HIGH
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl mx-auto text-left relative z-10">
                  
                  {/* Confidence Metrics */}
                  <div className="bg-black/80 backdrop-blur-md border border-red-500/30 rounded-lg p-6 shadow-[0_0_20px_rgba(239,68,68,0.1)] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-red-600 to-red-400 opacity-50" />
                    <h4 className="text-red-500 text-sm font-bold mb-5 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                      Forensic Metrics
                    </h4>
                    
                    <div className="space-y-5">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-zinc-400 font-medium uppercase tracking-wider">Similarity to Original</span>
                          <span className="font-mono text-zinc-300">{similarity}%</span>
                        </div>
                        <div className="w-full bg-zinc-900 rounded-full h-1.5">
                          <div className="bg-zinc-500 h-1.5 rounded-full" style={{ width: `${similarity}%` }}></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-zinc-400 font-medium uppercase tracking-wider">Tampering Confidence</span>
                          <span className="font-mono text-red-400">{tamperConfidence}%</span>
                        </div>
                        <div className="w-full bg-red-950 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-red-500 h-1.5 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.8)]" style={{ width: `${tamperConfidence}%` }}></div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-red-500/20">
                        <span className="text-zinc-500 text-[10px] font-medium block mb-1 uppercase tracking-wider">Hamming Distance</span>
                        <span className="font-mono text-sm text-red-400 drop-shadow-[0_0_2px_rgba(239,68,68,0.5)]">{result.hammingDistance} / 256 bits altered</span>
                      </div>
                    </div>
                  </div>

                  {/* Blockchain Context */}
                  <div className="bg-black/80 backdrop-blur-md border border-red-500/30 rounded-lg p-6 shadow-[0_0_20px_rgba(239,68,68,0.1)] relative overflow-hidden flex flex-col justify-center">
                     <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-red-600 to-red-400 opacity-50" />
                     <div className="space-y-4">
                       <div className="flex items-start gap-3">
                         <ShieldCheck className="w-5 h-5 text-zinc-500 mt-0.5" />
                         <div>
                           <p className="text-sm font-medium text-zinc-300">Blockchain Record Found</p>
                           <p className="text-xs text-zinc-500">Asset {result.matchedAsset?.id?.slice(0, 8)}... located on Monad Testnet</p>
                         </div>
                       </div>
                       <div className="flex items-start gap-3">
                         <Search className="w-5 h-5 text-zinc-500 mt-0.5" />
                         <div>
                           <p className="text-sm font-medium text-zinc-300">Original Asset Located</p>
                           <p className="text-xs text-zinc-500">Provenance DB match successful</p>
                         </div>
                       </div>
                       <div className="flex items-start gap-3 pt-2 border-t border-red-500/20">
                         <ShieldAlert className="w-5 h-5 text-red-500 mt-0.5 animate-pulse" />
                         <div>
                           <p className="text-sm font-bold text-red-400">Fingerprint Mismatch</p>
                           <p className="text-xs text-red-500/70">Uploaded content does not match registered cryptographic footprint.</p>
                         </div>
                       </div>
                     </div>
                  </div>

                  {/* AI Forensic Analysis (Spans Full Width) */}
                  <div className="md:col-span-2 bg-red-950/20 border border-red-500/40 rounded-lg p-6 shadow-[inset_0_0_20px_rgba(239,68,68,0.05)] relative">
                    <h4 className="text-red-500 text-sm font-bold mb-3 flex items-center gap-2 uppercase tracking-widest">
                      <div className="w-1.5 h-4 bg-red-500" />
                      AI Forensic Analysis
                    </h4>
                    <div className="text-zinc-300 text-sm leading-relaxed">
                      {explanation || "Analyzing structural deviations... Unauthorised modification detected based on perceptual distance metrics."}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Forensic Content Analysis Section */}
            {process.env.NEXT_PUBLIC_ENABLE_AI_ANALYSIS === "true" && (result || isAiAnalyzing) && (
              <div className="w-full mt-8 pt-8 border-t border-zinc-800">
                <div className="flex items-center gap-3 mb-6 relative z-10">
                  <h3 className="text-xl font-bold text-white tracking-tight">AI FORENSIC CONTENT ANALYSIS</h3>
                  <span className="px-2 py-0.5 bg-brand-500/10 text-brand-400 border border-brand-500/30 rounded text-[10px] font-bold uppercase tracking-widest">
                    Research Preview
                  </span>
                </div>

                {isAiAnalyzing ? (
                  <div className="flex items-center justify-center p-10 bg-black border border-zinc-800 rounded-lg animate-pulse relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="w-6 h-6 border-[3px] border-zinc-800 border-t-zinc-400 rounded-full animate-spin" />
                      <span className="text-zinc-500 font-medium tracking-wide">Analyzing visual authenticity...</span>
                    </div>
                  </div>
                ) : aiAnalysis ? (
                  (() => {
                    const isLowConf = aiAnalysis.confidence < 60;
                    const displayRisk = isLowConf ? "INCONCLUSIVE" : aiAnalysis.risk;
                    
                    let theme = {
                      bg: "bg-zinc-950/20",
                      border: "border-zinc-500/30",
                      text: "text-zinc-500",
                      dot: "bg-zinc-500/50"
                    };
                    
                    if (displayRisk === "LOW") {
                      theme = { bg: "bg-lime-950/20", border: "border-lime-500/30", text: "text-lime-500", dot: "bg-lime-500/50" };
                    } else if (displayRisk === "MEDIUM") {
                      theme = { bg: "bg-yellow-950/20", border: "border-yellow-500/30", text: "text-yellow-500", dot: "bg-yellow-500/50" };
                    } else if (displayRisk === "HIGH") {
                      theme = { bg: "bg-red-950/20", border: "border-red-500/30", text: "text-red-500", dot: "bg-red-500/50" };
                    } else if (displayRisk === "INCONCLUSIVE") {
                      theme = { bg: "bg-blue-950/20", border: "border-blue-500/30", text: "text-blue-500", dot: "bg-blue-500/50" };
                    }

                    return (
                      <div className={`w-full ${theme.bg} border ${theme.border} rounded-lg p-6 relative z-10 transition-colors duration-500`}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          
                          <div className="md:col-span-1">
                            <span className="text-zinc-500 text-xs font-medium block mb-2 uppercase tracking-wider">Risk Level</span>
                            <div className={`text-3xl font-black ${theme.text} tracking-tight mb-4 drop-shadow-[0_0_8px_currentColor]`}>{displayRisk}</div>
                            
                            <span className="text-zinc-500 text-xs font-medium block mb-1 uppercase tracking-wider">Confidence</span>
                            <div className="font-mono text-xl text-zinc-300">{aiAnalysis.confidence}%</div>
                          </div>

                          <div className="md:col-span-2">
                            <span className="text-zinc-500 text-xs font-medium block mb-3 uppercase tracking-wider">Indicators</span>
                            <ul className="space-y-2">
                              {aiAnalysis.reasons.map((reason: string, i: number) => (
                                <li key={i} className="flex items-start gap-2 text-zinc-300 text-sm">
                                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full ${theme.dot} shrink-0`} />
                                  <span>{reason}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                        </div>

                        <div className="mt-6 pt-4 border-t border-zinc-800/50 text-xs text-zinc-500 italic">
                          This assessment estimates the likelihood of synthetic content based on visual indicators and should not be treated as definitive proof.
                        </div>
                      </div>
                    );
                  })()
                ) : null}
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
