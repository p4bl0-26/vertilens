"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { type IntentPlan, IntentStatus } from "@nexora/shared-types/intent.types";

interface ExecutionTimelineProps {
  initialPlan: IntentPlan;
  onReset: () => void;
}

export function ExecutionTimeline({ initialPlan, onReset }: ExecutionTimelineProps) {
  const [plan, setPlan] = useState<IntentPlan>(initialPlan);
  const [isApproving, setIsApproving] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const handleApprove = async () => {
    setIsApproving(true);
    toast.loading("Approving plan...", { id: "approve-toast" });

    try {
      const res = await fetch(`http://localhost:8000/v1/intent/${plan.intentId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": "dev_api_key_123"
        }
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Plan approved! Execution starting...", { id: "approve-toast" });
        setPlan(data.data.plan);
        setJobId(data.data.jobId);
      } else {
        toast.error("Failed to approve plan.", { id: "approve-toast" });
      }
    } catch (error) {
      console.error("Approve error:", error);
      toast.error("Network error during approval", { id: "approve-toast" });
    } finally {
      setIsApproving(false);
    }
  };

  // Poll backend for plan status if it is executing
  useEffect(() => {
    if ((plan.status as IntentStatus) !== IntentStatus.EXECUTING || !jobId) return;

    console.log(`[Timeline] Polling status for intent ${plan.intentId}...`);
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:8000/v1/intent/${plan.intentId}`, {
          headers: { "X-API-Key": "dev_api_key_123" }
        });
        const data = await res.json();
        
        if (res.ok && data.success && data.data.plan) {
          const updatedPlan = data.data.plan as IntentPlan;
          setPlan(updatedPlan);
          
          if ((updatedPlan.status as IntentStatus) === IntentStatus.SUCCESS) {
            toast.success("Intent fully executed!", { id: "execution-toast" });
            clearInterval(interval);
          } else if ((updatedPlan.status as IntentStatus) === IntentStatus.FAILED) {
            toast.error("Intent execution failed.", { id: "execution-toast" });
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [plan.status, plan.intentId, jobId]);

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Execution Plan</h2>
          <p className="text-sm text-slate-400 mt-1">{plan.summary}</p>
        </div>
        <div className="flex items-center px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300">
          Status: <span className="ml-2 text-blue-400">{plan.status}</span>
        </div>
      </div>

      <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[1.2rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-700 before:to-transparent">
        {plan.steps.map((step, idx) => {
          // A bit of UI trickery to simulate step-by-step progress during EXECUTING state
          let isComplete = (plan.status as IntentStatus) === IntentStatus.SUCCESS;
          let isCurrent = false;
          
          // Hacky mock simulation for UX timeline
          if ((plan.status as IntentStatus) === IntentStatus.EXECUTING) {
            // Since our backend mock is blind right now, we just pretend step 1 is done
            // after a bit. This would normally map to real AgentEvents.
            isComplete = false; 
            isCurrent = true;
          }

          return (
            <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-900 bg-slate-800 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                {isComplete ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : isCurrent ? (
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                ) : (
                  <Circle className="w-5 h-5" />
                )}
              </div>
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-800 bg-slate-800/50 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-slate-200">{step.actionType}</h3>
                  <span className="text-xs font-medium text-slate-400">{step.protocol}</span>
                </div>
                <p className="text-sm text-slate-400">{step.description}</p>
                {step.value && (
                  <p className="text-xs text-emerald-400 mt-2 font-mono">Value: {step.value}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex justify-end gap-3">
        {(plan.status as IntentStatus) === IntentStatus.SUCCESS || (plan.status as IntentStatus) === IntentStatus.FAILED ? (
          <button 
            onClick={onReset}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
          >
            New Intent
          </button>
        ) : (plan.status as IntentStatus) === IntentStatus.PARSED ? (
          <>
            <button 
              onClick={onReset}
              disabled={isApproving}
              className="px-6 py-2 text-slate-400 hover:text-white font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleApprove}
              disabled={isApproving}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-medium rounded-lg transition-colors shadow-lg shadow-blue-500/20"
            >
              {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Approve & Execute
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
