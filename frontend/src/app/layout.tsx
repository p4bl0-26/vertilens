import { AppProviders } from "@/providers/AppProviders";
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css"; // Ensure you have globals.css or omit if not created yet

export const metadata = {
  title: "Nexora",
  description: "Intent-centric Web3 Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-slate-950 text-slate-50 antialiased">
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
