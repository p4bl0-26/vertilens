"use client";

import { Toaster } from "sonner";

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster 
        theme="dark" 
        position="bottom-right" 
        toastOptions={{
          style: {
            background: "#0F172A", // Tailwind slate-900
            border: "1px solid #1E293B", // Tailwind slate-800
            color: "#F8FAFC", // Tailwind slate-50
          }
        }} 
      />
    </>
  );
}
