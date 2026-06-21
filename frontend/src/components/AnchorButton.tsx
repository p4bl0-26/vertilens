"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";

interface AnchorButtonProps {
  hash: string;
  assetId: string;
  disabled?: boolean;
  onSuccess?: (txHash: string) => void;
}

export function AnchorButton({ hash, assetId, disabled, onSuccess }: AnchorButtonProps) {
  const [isAnchoring, setIsAnchoring] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAnchor = async () => {
    setIsAnchoring(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, sha256: hash }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to anchor asset");
      }

      setTxHash(data.data.txHash);
      if (onSuccess) onSuccess(data.data.txHash);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("Anchoring error:", err);
      setErrorMsg(err.message || "An error occurred during anchoring");
    } finally {
      setIsAnchoring(false);
    }
  };

  if (txHash) {
    return null;
  }

  return (
    <div className="w-full flex flex-col items-center gap-2">
      <button
        onClick={handleAnchor}
        disabled={disabled || isAnchoring}
        className={`w-full relative flex items-center justify-center px-8 py-4 rounded-lg font-bold text-lg transition-all overflow-hidden ${
          disabled
            ? "bg-zinc-900 text-zinc-600 cursor-not-allowed border border-zinc-800"
            : "bg-gradient-to-r from-lime-600 to-lime-400 hover:from-lime-500 hover:to-lime-300 text-black shadow-[0_0_20px_rgba(132,204,22,0.4)]"
        }`}
      >
        {isAnchoring ? (
          <span className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            Minting...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            Anchor to Blockchain <ArrowUpRight className="w-5 h-5" strokeWidth={2.5} />
          </span>
        )}
      </button>
      {errorMsg && (
        <span className="text-red-500 text-sm mt-2 text-center">{errorMsg}</span>
      )}
    </div>
  );
}
