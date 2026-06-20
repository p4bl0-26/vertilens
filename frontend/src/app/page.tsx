"use client";

import { useState } from "react";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { IntentInput } from "@/components/intent/IntentInput";
import { ExecutionTimeline } from "@/components/intent/ExecutionTimeline";
import type { IntentPlan } from "@nexora/shared-types/intent.types";
import { Activity } from "lucide-react";

export default function HomePage() {
  const [activePlan, setActivePlan] = useState<IntentPlan | null>(null);

  const handleReset = () => {
    setActivePlan(null);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center">
      
      {/* Navbar */}
      <nav className="w-full max-w-7xl px-6 py-4 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">Nexora</span>
        </div>
        <div>
          <ConnectButton />
        </div>
      </nav>

      {/* Main Content */}
      <div className="w-full max-w-7xl px-6 py-12 md:py-24 flex flex-col items-center flex-1">
        
        {/* Header */}
        <div className="text-center max-w-3xl mb-12">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Intent-Centric Web3 Execution
          </h1>
          <p className="text-lg md:text-xl text-slate-400">
            Stop bridging, swapping, and signing a dozen transactions manually.
            Just tell us what you want to do, and Nexora will handle the rest.
          </p>
        </div>

        {/* Dynamic Demo Container */}
        <div className="w-full max-w-3xl transition-all duration-500 ease-in-out">
          {!activePlan ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <IntentInput onPlanReceived={setActivePlan} />
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <ExecutionTimeline 
                initialPlan={activePlan} 
                onReset={handleReset} 
              />
            </div>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <footer className="w-full py-6 text-center text-sm text-slate-600 border-t border-slate-900 mt-auto">
        <p>Nexora '26 Hackathon Demo</p>
      </footer>
    </main>
  );
}
