"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/hooks/useWallet";
import type { IntentPlan } from "@nexora/shared-types/intent.types";

interface IntentInputProps {
  onPlanReceived: (plan: IntentPlan) => void;
}

export function IntentInput({ onPlanReceived }: IntentInputProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { address, chainId } = useWallet();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    if (!address || !chainId) {
      toast.error("Please connect your wallet first.");
      return;
    }

    setIsLoading(true);
    toast.info("Analyzing your intent...", { id: "intent-toast" });

    try {
      const res = await fetch("http://localhost:8000/v1/intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": "dev_api_key_123" // Dev key as per config
        },
        body: JSON.stringify({
          userAddress: address,
          rawInput: input,
          sourceChainId: chainId
        })
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        toast.success("Intent analyzed successfully!", { id: "intent-toast" });
        onPlanReceived(data.data.plan as IntentPlan);
        setInput("");
      } else {
        toast.error(data.error?.message || "Failed to analyze intent", { id: "intent-toast" });
      }
    } catch (error) {
      console.error("Error submitting intent:", error);
      toast.error("Network error while submitting intent", { id: "intent-toast" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4 bg-slate-900 border border-slate-800 rounded-xl shadow-xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="intent" className="text-sm font-medium text-slate-300">
          What would you like to do?
        </label>
        <div className="relative">
          <textarea
            id="intent"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading || !address}
            placeholder={
              address 
                ? "e.g., Swap 100 USDC to ETH and bridge it to Base..." 
                : "Connect wallet to enter intents..."
            }
            className="w-full min-h-[100px] p-4 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim() || !address}
            className="absolute bottom-3 right-3 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md disabled:bg-slate-800 disabled:text-slate-500 transition-colors"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-xs text-slate-500 text-right">
          Powered by Nexora AI
        </p>
      </form>
    </div>
  );
}
