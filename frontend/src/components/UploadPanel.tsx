"use client";

import { useState } from "react";
import { UploadCloud, CheckCircle2, FileText } from "lucide-react";
import { AnchorButton } from "./AnchorButton";
import { QRDisplay } from "./QRDisplay";

export function UploadPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hash, setHash] = useState<string | null>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFile = (f: File) => {
    setFile(f);
    // Simulate API registration delay
    setTimeout(() => {
      setHash("0x8f2b3e4a5d...7e9f");
    }, 1200);
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-[#0a0a0a] border border-zinc-800 rounded-xl p-10 hover:border-lime-500/30 transition-colors duration-500 shadow-2xl">
      {!file ? (
        <div
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
          <UploadCloud className={`w-12 h-12 mb-4 transition-colors ${isDragging ? "text-lime-500" : "text-lime-500/70 drop-shadow-[0_0_8px_rgba(132,204,22,0.4)]"}`} strokeWidth={1.5} />
          <h3 className="text-white text-lg font-medium mb-1">Upload Digital Asset</h3>
          <p className="text-zinc-500 text-sm">Drag and drop, or click to browse</p>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="w-full flex items-center p-5 bg-black border border-zinc-800 rounded-lg mb-8">
            <FileText className="w-8 h-8 text-lime-500 mr-4 drop-shadow-[0_0_8px_rgba(132,204,22,0.4)]" strokeWidth={1.5} />
            <div className="flex-1 overflow-hidden text-left">
              <p className="text-zinc-200 font-medium truncate">{file.name}</p>
              <p className="text-zinc-500 text-sm">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            {hash ? (
              <CheckCircle2 className="w-6 h-6 text-lime-500 drop-shadow-[0_0_5px_rgba(132,204,22,0.5)]" />
            ) : (
              <div className="w-5 h-5 border-2 border-zinc-800 border-t-lime-500 rounded-full animate-spin" />
            )}
          </div>

          <div className="w-full mb-8">
            <div className="w-full bg-black border border-zinc-800 rounded-lg p-5 flex items-center justify-between min-h-[64px]">
              <span className="text-zinc-500 text-sm font-medium">Cryptographic Fingerprint</span>
              {hash ? (
                <span className="font-mono text-lime-400 tracking-wider break-all text-right drop-shadow-[0_0_2px_rgba(132,204,22,0.8)]">{hash}</span>
              ) : (
                <span className="text-zinc-600 text-sm italic">Computing SHA-256...</span>
              )}
            </div>
          </div>

          <div className="w-full max-w-md">
            <AnchorButton
              hash={hash || ""}
              disabled={!hash}
              onSuccess={() => console.log("Anchored!")}
            />
          </div>

          {hash && (
            <div className="w-full mt-10 pt-10 border-t border-zinc-800 flex justify-center">
              <QRDisplay assetId="f47ac10b-58cc-4372-a567-0e02b2c3d479" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
