"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ShieldCheck, Database, Hexagon, FileCode2, QrCode, Network, 
  Lock, Fingerprint, Cpu, Layers, Link2, Box, Eye, FileSignature, Share2,
  Globe, Key, Cloud, Code, Braces, Activity, Server, Shield
} from "lucide-react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { UploadPanel } from "@/components/UploadPanel";
import { VerifyPanel } from "@/components/VerifyPanel";
import { Footer } from "@/components/Footer";
import { ConnectButton, useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FloatingParticle({ Icon, top, left, right, size, speed, opacity, blur, color = "text-brand-500" }: any) {
  const { scrollY } = useScroll();
  // speed determines how fast and in what direction it moves on scroll
  const y = useTransform(scrollY, [0, 1000], [0, speed]);
  
  return (
    <motion.div 
      style={{ 
        y,
        ...(left && { left: `${left}%` }),
        ...(right && { right: `${right}%` })
      }} 
      className={`absolute ${top} opacity-${opacity} ${blur}`}
    >
      <div className={`w-${size} h-${size} flex items-center justify-center`}>
        <Icon suppressHydrationWarning className={`w-full h-full ${color} drop-shadow-[0_0_30px_rgb(var(--brand-500)/)]`} strokeWidth={1} />
      </div>
    </motion.div>
  );
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"register" | "verify">("register");
  const [showSplash, setShowSplash] = useState(true);
  const [appTheme, setAppTheme] = useState<"theme-lime" | "theme-red" | "theme-amber" | "">("");
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { openConnectModal } = useConnectModal();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { isConnected } = useAccount();

  useEffect(() => {
    // Hide the splash screen after 2.8 seconds to allow the animation to play
    const timer = setTimeout(() => setShowSplash(false), 2800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className={`min-h-[120vh] bg-black text-white flex flex-col relative overflow-x-hidden font-sans selection:bg-brand-500/30 selection:text-brand-200 ${appTheme}`}>
      
      {/* 
        ========================================
        INITIAL SPLASH SCREEN
        ========================================
      */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
            className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
          >
            <div className="flex items-center overflow-hidden">
              {/* The Logo (Drops in and spins) */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.8, type: "spring", bounce: 0.5 }}
                className="relative z-10 w-24 h-24 flex items-center justify-center drop-shadow-[0_0_40px_rgb(var(--brand-500)/)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Veritas Logo" className="w-full h-full object-contain" />
              </motion.div>

              {/* The Name (Slides out smoothly from behind the logo) */}
              <motion.div
                initial={{ width: 0, opacity: 0, x: -50 }}
                animate={{ width: "auto", opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
                className="overflow-hidden whitespace-nowrap pl-6"
              >
                <span className="text-6xl font-black tracking-[0.2em] text-white uppercase drop-shadow-2xl">
                  VERITAS
                </span>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 
        Global Scaling Fix: 
        This makes 1rem equal to exactly 16px on a 1536px screen, 
        and scales up/down proportionally on all desktop monitors.
        This forces all Tailwind classes (w-64, text-6xl, etc.) to scale 100% perfectly!
      */}
      <style>{`
        @media (min-width: 1024px) {
          html {
            font-size: 1.0416vw;
          }
        }
      `}</style>

      {/* 
        ========================================
        DENSE FLOATING PARALLAX BACKGROUND 
        ========================================
      */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        
        {/* 
          SYNCED PARALLAX LAYERS 
          Layer 1 (Foreground): Speed 350 - Fast
          Layer 2 (Midground): Speed 200 - Medium
          Layer 3 (Background): Speed 100 - Slow
        */}
        
        {/* Layer 1: Foreground (Fastest) */}
        <FloatingParticle Icon={ShieldCheck} top="top-[10%]" left="2" size="64" speed={350} opacity="20" color="text-brand-400" />
        <FloatingParticle Icon={Database} top="top-[30%]" right="2" size="80" speed={350} opacity="15" blur="blur-[1px]" />
        <FloatingParticle Icon={QrCode} top="top-[5%]" right="10" size="56" speed={350} opacity="20" color="text-brand-400" />
        <FloatingParticle Icon={Network} top="top-[75%]" left="5" size="72" speed={350} opacity="25" blur="blur-[1px]" />

        {/* Layer 2: Midground (Medium Density) */}
        <FloatingParticle Icon={Lock} top="top-[20%]" left="20" size="24" speed={200} opacity="10" blur="blur-[2px]" color="text-brand-500/50" />
        <FloatingParticle Icon={Fingerprint} top="top-[15%]" right="25" size="32" speed={200} opacity="15" blur="blur-[2px]" color="text-brand-500/60" />
        <FloatingParticle Icon={Layers} top="top-[70%]" left="25" size="28" speed={200} opacity="15" blur="blur-[2px]" color="text-brand-400/40" />
        <FloatingParticle Icon={Share2} top="top-[65%]" right="35" size="24" speed={200} opacity="15" blur="blur-[2px]" color="text-brand-500/40" />
        <FloatingParticle Icon={Server} top="top-[45%]" left="30" size="32" speed={200} opacity="10" blur="blur-[2px]" color="text-brand-500/30" />
        <FloatingParticle Icon={Shield} top="top-[55%]" right="25" size="24" speed={200} opacity="15" blur="blur-[2px]" color="text-brand-400/50" />
        <FloatingParticle Icon={Cpu} top="top-[85%]" right="15" size="32" speed={200} opacity="10" blur="blur-[2px]" color="text-white/40" />
        <FloatingParticle Icon={Key} top="top-[35%]" left="10" size="24" speed={200} opacity="15" blur="blur-[2px]" color="text-brand-500/40" />

        {/* Layer 3: Background (Massive Density Fill) */}
        <FloatingParticle Icon={FileCode2} top="top-[80%]" right="15" size="40" speed={100} opacity="10" blur="blur-[3px]" color="text-brand-300" />
        <FloatingParticle Icon={Link2} top="top-[35%]" left="15" size="16" speed={100} opacity="10" blur="blur-[3px]" color="text-brand-300/40" />
        <FloatingParticle Icon={Box} top="top-[55%]" right="5" size="24" speed={100} opacity="10" blur="blur-[3px]" color="text-white/20" />
        <FloatingParticle Icon={Eye} top="top-[85%]" left="30" size="20" speed={100} opacity="10" blur="blur-[3px]" color="text-brand-500/50" />
        <FloatingParticle Icon={FileSignature} top="top-[25%]" right="15" size="16" speed={100} opacity="10" blur="blur-[3px]" color="text-brand-400/30" />
        
        {/* Filling all empty quadrants */}
        <FloatingParticle Icon={Globe} top="top-[8%]" left="40" size="20" speed={100} opacity="5" blur="blur-[4px]" color="text-white/30" />
        <FloatingParticle Icon={Cloud} top="top-[12%]" right="40" size="24" speed={100} opacity="5" blur="blur-[4px]" color="text-brand-500/20" />
        <FloatingParticle Icon={Code} top="top-[22%]" left="45" size="16" speed={100} opacity="10" blur="blur-[3px]" color="text-white/20" />
        <FloatingParticle Icon={Braces} top="top-[28%]" right="45" size="16" speed={100} opacity="5" blur="blur-[4px]" color="text-brand-400/20" />
        <FloatingParticle Icon={Activity} top="top-[33%]" left="35" size="24" speed={100} opacity="10" blur="blur-[3px]" color="text-white/10" />
        <FloatingParticle Icon={Hexagon} top="top-[48%]" right="45" size="20" speed={100} opacity="5" blur="blur-[4px]" color="text-brand-500/20" />
        <FloatingParticle Icon={Database} top="top-[52%]" left="45" size="16" speed={100} opacity="10" blur="blur-[3px]" color="text-white/30" />
        <FloatingParticle Icon={Lock} top="top-[62%]" right="40" size="24" speed={100} opacity="5" blur="blur-[4px]" color="text-brand-500/20" />
        <FloatingParticle Icon={ShieldCheck} top="top-[72%]" left="40" size="20" speed={100} opacity="10" blur="blur-[3px]" color="text-white/20" />
        <FloatingParticle Icon={Fingerprint} top="top-[78%]" right="45" size="16" speed={100} opacity="5" blur="blur-[4px]" color="text-brand-400/20" />
        <FloatingParticle Icon={Network} top="top-[90%]" left="45" size="24" speed={100} opacity="10" blur="blur-[3px]" color="text-white/10" />
        <FloatingParticle Icon={Link2} top="top-[95%]" right="35" size="20" speed={100} opacity="5" blur="blur-[4px]" color="text-brand-500/20" />
        
        {/* Edge Fillers */}
        <FloatingParticle Icon={Server} top="top-[18%]" left="5" size="16" speed={100} opacity="10" blur="blur-[3px]" color="text-brand-500/30" />
        <FloatingParticle Icon={Box} top="top-[42%]" right="5" size="20" speed={100} opacity="5" blur="blur-[4px]" color="text-white/20" />
        <FloatingParticle Icon={Cpu} top="top-[68%]" left="5" size="24" speed={100} opacity="10" blur="blur-[3px]" color="text-brand-500/20" />
        <FloatingParticle Icon={Key} top="top-[92%]" right="5" size="16" speed={100} opacity="5" blur="blur-[4px]" color="text-white/30" />

        {/* Ambient Grid / Dots to fill empty space completely */}
        <div className="absolute inset-0 bg-[url('https://transparenttextures.com/patterns/cubes.png')] opacity-[0.03]" />
      </div>

      {/* Zth Glowing Arch Background - Made Prominent & Metallic */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[140%] h-[44rem] pointer-events-none opacity-100 flex justify-center z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-500/20 via-transparent to-transparent" />
        <div className="absolute top-[15%] w-[70%] h-[50rem] border-t-[2px] border-transparent rounded-[100%] bg-gradient-to-b from-brand-300 via-transparent to-transparent p-[2px] shadow-[0_-40px_120px_rgb(var(--brand-500)/)]">
          <div className="w-full h-full bg-black rounded-[100%] relative overflow-hidden flex flex-col items-center pt-24">
            {/* Inner Grid for the oval */}
            <div className="absolute inset-0 bg-[url('https://transparenttextures.com/patterns/cubes.png')] opacity-10" />
            
            {/* Massive Fingerprint Watermark representing Provenance */}
            <div className="w-[40rem] h-[40rem] flex items-center justify-center">
              <Fingerprint className="w-full h-full text-brand-500 opacity-[0.05] drop-shadow-[0_0_20px_rgb(var(--brand-500)/)]" strokeWidth={0.5} />
            </div>
            
            {/* Fading gradient so the bottom of the oval blends smoothly into pure black */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/80 to-black" />
          </div>
        </div>
      </div>

      {/* Navbar - Zth Style */}
      <nav className="w-full px-8 py-6 flex items-center justify-between relative z-20">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Veritas Logo" className="w-10 h-10 drop-shadow-[0_0_15px_rgb(var(--brand-500)/)]" />
          <span className="text-xl font-bold tracking-tight">Veritas</span>
        </div>
      </nav>

      {/* Main Hero Content */}
      <div className="w-full max-w-[90rem] mx-auto px-6 pt-20 pb-16 flex flex-col items-center flex-1 relative z-10">
        
        {/* Massive Flanking Web3 Icons (Inside Hero Container so they don't hide behind the arch) */}
        <div className="absolute inset-0 pointer-events-none hidden lg:block">
          <FloatingParticle Icon={Cpu} top="top-[25%]" left="5" size="64" speed={-150} opacity="15" blur="blur-[1px]" color="text-brand-500" />
          <FloatingParticle Icon={Hexagon} top="top-[25%]" right="5" size="64" speed={150} opacity="15" blur="blur-[1px]" color="text-brand-500" />
        </div>

        <div className="flex flex-col items-center text-center max-w-4xl mb-16 relative z-20">
          
          <div className="inline-flex items-center px-4 py-1.5 rounded-full border border-zinc-800 bg-zinc-950 mb-8 backdrop-blur-md shadow-[0_0_20px_rgb(var(--brand-500)/)]">
            <div className="w-2 h-2 rounded-full bg-brand-500 mr-2 shadow-[0_0_8px_rgb(var(--brand-500)/)]" />
            <span className="text-sm font-medium text-zinc-300">0x.Provenance-layer</span>
          </div>

          <h1 className="text-6xl md:text-8xl font-medium tracking-tight mb-6 text-white leading-[1.1]">
            Register. Anchor. <span className="text-zinc-500">Verify.</span>
          </h1>
          <p className="text-xl text-zinc-400 font-normal">
            Where Digital Assets Secure Their Provenance Beyond Creation
          </p>
          
          {/* Instructions Box */}
          <div className="mt-10 max-w-2xl mx-auto bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 text-left backdrop-blur-md shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <h3 className="text-brand-400 font-bold mb-3 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              How Veritas Works
            </h3>
            <ul className="text-zinc-400 text-sm space-y-3">
              <li><strong className="text-zinc-200">1. Register:</strong> Upload an image to generate its exact SHA-256 and AI perceptual hash.</li>
              <li><strong className="text-zinc-200">2. Anchor:</strong> Mint the cryptographic hash directly onto the Monad Testnet for immutable proof of origin.</li>
              <li><strong className="text-zinc-200">3. Verify:</strong> Upload any image later to check its authenticity. Our AI forensics will detect any manipulation.</li>
            </ul>
          </div>
        </div>

        {/* Minimalist Toggle Switch & Connect Wallet */}
        <div className="w-full max-w-4xl flex flex-col items-center">
          <div className="flex items-center mb-10">
            <div className="flex p-1 bg-zinc-900/50 rounded-lg border border-zinc-800 backdrop-blur-md">
              <button
              onClick={() => { setActiveTab("register"); setAppTheme(""); }}
              className={`relative px-8 py-2.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === "register" ? "text-black" : "text-zinc-500 hover:text-white"
              }`}
            >
              {activeTab === "register" && (
                <motion.div layoutId="toggle" className="absolute inset-0 bg-brand-500 rounded-md shadow-[0_0_10px_rgb(var(--brand-500)/)]" />
              )}
              <span className="relative z-10">Register Asset</span>
            </button>
            <button
              onClick={() => setActiveTab("verify")}
              className={`relative px-8 py-2.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === "verify" ? "text-black" : "text-zinc-500 hover:text-white"
              }`}
            >
              {activeTab === "verify" && (
                <motion.div layoutId="toggle" className="absolute inset-0 bg-brand-500 rounded-md shadow-[0_0_10px_rgb(var(--brand-500)/)]" />
              )}
              <span className="relative z-10">Verify Authenticity</span>
            </button>
          </div>

          <div className="ml-4">
            <ConnectButton 
              chainStatus="icon" 
              showBalance={false} 
              accountStatus={{
                smallScreen: 'avatar',
                largeScreen: 'full',
              }}
            />
          </div>
        </div>

          {/* Tab Content Area with Web3 Decorations */}
          <div className="w-full relative min-h-[400px]">
            
            {/* Left Side Web3 Elements */}
            <div className="hidden lg:flex absolute -left-32 top-12 flex-col items-end gap-6 opacity-60">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-brand-500">MONAD_TESTNET</span>
                <div className="w-16 h-[1px] bg-gradient-to-l from-brand-500 to-transparent" />
              </div>
              <div className="flex items-center gap-3 mt-10">
                <span className="text-xs font-mono text-zinc-500">ZK_PROOF_READY</span>
                <div className="w-8 h-[1px] bg-gradient-to-l from-zinc-500 to-transparent" />
              </div>
            </div>

            {/* Right Side Web3 Elements */}
            <div className="hidden lg:flex absolute -right-32 top-16 flex-col items-start gap-8 opacity-60">
              <div className="flex items-center gap-3">
                <div className="w-12 h-[1px] bg-gradient-to-r from-brand-500 to-transparent" />
                <div className="flex items-center gap-1.5 border border-brand-500/30 bg-brand-500/5 px-2 py-1 rounded text-[10px] font-mono text-brand-400">
                  <div className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" />
                  SECURE_NODE
                </div>
              </div>
              <div className="flex items-center gap-3 mt-12">
                <div className="w-20 h-[1px] bg-gradient-to-r from-zinc-500 to-transparent" />
                <span className="text-xs font-mono text-zinc-500">IPFS_LINKED</span>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {activeTab === "register" ? (
                <motion.div
                  key="register"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="w-full relative z-10"
                >
                  <UploadPanel />
                </motion.div>
              ) : (
                <motion.div
                  key="verify"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="w-full relative z-10"
                >
                  <VerifyPanel onThemeChange={setAppTheme} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
