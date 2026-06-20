"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";

interface AnchorButtonProps {
  hash: string;
  disabled?: boolean;
  onSuccess?: () => void;
}

export function AnchorButton({ hash, disabled, onSuccess }: AnchorButtonProps) {
  const [isAnchoring, setIsAnchoring] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleAnchor = () => {
    setIsAnchoring(true);
    // Simulate smart contract interaction delay
    setTimeout(() => {
      setIsAnchoring(false);
      setTxHash("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
      if (onSuccess) onSuccess();
    }, 2500);
  };

  if (txHash) {
    return (
      <div className="w-full flex flex-col items-center">
        <div className="w-full p-4 bg-lime-500/10 border border-lime-500/30 rounded-lg text-center">
          <p className="text-lime-400 font-medium mb-1 drop-shadow-[0_0_2px_rgba(132,204,22,0.8)]">Credibility Minted</p>
          <a
            href={`https://explorer.monad-testnet.com/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-zinc-400 hover:text-lime-400 transition-colors flex items-center justify-center gap-1"
          >
            View on Explorer <ArrowUpRight className="w-3 h-3" />
          </a>
        </div>
      </div>
    );
  }

  return (
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
          Invest to Anchor <ArrowUpRight className="w-5 h-5" strokeWidth={2.5} />
        </span>
      )}
    </button>
  );
}
