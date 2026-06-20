"use client";

import { motion } from "framer-motion";
import { QrCode, Download } from "lucide-react";

export function QRDisplay({ assetId }: { assetId: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center gap-4"
    >
      <div className="text-center">
        <h3 className="text-lg font-semibold text-slate-200">Asset Registered</h3>
        <p className="text-sm text-slate-400">Share this QR to verify authenticity</p>
      </div>
      
      {/* Placeholder QR Code visual */}
      <div className="w-48 h-48 bg-white rounded-xl p-4 flex items-center justify-center shadow-inner">
        <QrCode className="w-full h-full text-slate-900" />
      </div>

      <div className="text-xs text-slate-500 break-all bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 w-full text-center">
        ID: {assetId}
      </div>

      <button className="w-full py-2 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors flex items-center justify-center gap-2">
        <Download className="w-4 h-4" /> Download Certificate
      </button>
    </motion.div>
  );
}
