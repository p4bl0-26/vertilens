"use client";

import { useState } from "react";
import { UploadCloud, CheckCircle2, FileText } from "lucide-react";
import { AnchorButton } from "./AnchorButton";
import { QRDisplay } from "./QRDisplay";

export function UploadPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hash, setHash] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
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
    setIsUploading(true);
    setErrorMsg(null);
    setHash(null);
    setAssetId(null);

    const formData = new FormData();
    formData.append("image", f);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to register asset");
      }

      setHash(data.data.sha256);
      setAssetId(data.data.assetId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("Upload error:", err);
      setErrorMsg(err.message || "An error occurred during upload");
      setFile(null);
    } finally {
      setIsUploading(false);
    }
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
              ) : isUploading ? (
                <span className="text-zinc-600 text-sm italic">Computing SHA-256...</span>
              ) : errorMsg ? (
                <span className="text-red-500 text-sm">{errorMsg}</span>
              ) : null}
            </div>
          </div>

          <div className="w-full max-w-md">
            <AnchorButton
              hash={hash || ""}
              assetId={assetId || ""}
              disabled={!hash || !assetId}
              onSuccess={() => console.log("Anchored!")}
            />
          </div>

          {hash && assetId && (
            <div className="w-full mt-10 pt-10 border-t border-zinc-800 flex justify-center">
              <QRDisplay assetId={assetId} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
