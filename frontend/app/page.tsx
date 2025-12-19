"use client";

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Navbar } from '@/components/landing/Navbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { VirtuousCircle } from '@/components/landing/VirtuousCircle';
import { BentoFeatures } from '@/components/landing/BentoFeatures';
import { Footer } from '@/components/landing/Footer';
import { AuthModal } from '@/components/AuthModal';
import { createClient } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';

// Utility wrapper for the "80% Zoom" aesthetic
// Using CSS 'zoom' instead of transform to avoid layout spacing issues on Windows/Chromium
const ZoomWrapper = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={className} style={{ zoom: 0.8 }}>
    {children}
  </div>
);

export default function Home() {
  const [showIntro, setShowIntro] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const supabase = createClient();

  useEffect(() => {
    // Session handling
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Intro splash screen
    const timer = setTimeout(() => setShowIntro(false), 2400);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [supabase.auth]);

  return (
    <div className="landing-theme relative bg-background selection:bg-cyan-500/30 overflow-x-hidden">
      {/* Cinematic Noise Overlay */}
      <div className="noise-overlay fixed inset-0 z-[999] pointer-events-none" />

      <AnimatePresence>
        {showIntro && (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[1000] bg-black flex items-center justify-center p-6"
          >
            <div className="text-center space-y-4">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
                className="h-px bg-gradient-to-r from-transparent via-white/50 to-transparent mb-8"
              />
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-white text-5xl md:text-8xl font-black uppercase tracking-[0.4em] leading-tight"
              >
                ALIGNIQ
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="text-white/20 text-xs uppercase tracking-[0.6em] font-black"
              >
                Intelligence for Cohesion
              </motion.p>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
                className="h-px bg-gradient-to-r from-transparent via-white/50 to-transparent mt-8"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        message="Transform your meetings today."
      />

      <Navbar onSignInClick={() => setIsAuthModalOpen(true)} />

      <main className="relative z-10">
        {/* TOP SECTION - SCALED 0.8 */}
        <ZoomWrapper>
          <HeroSection onSignInClick={() => setIsAuthModalOpen(true)} />

          {/* <div className="glowing-divider my-10 md:my-16" /> */}

          {/* The Problem / Narrative Transition - Refined Scale & Margins */}
          <section className="relative h-screen min-h-[900px] flex items-center justify-center py-16 md:py-20 overflow-hidden">
            {/* Section Atmosphere */}
            <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="container mx-auto px-6 grid md:grid-cols-2 gap-16 items-center relative z-10">
              <motion.div
                initial={{ opacity: 0, x: -30, scale: 0.95 }}
                whileInView={{ opacity: 1, x: 0, scale: 1 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="relative"
              >
                {/* Expert Insight Visual - Scaled Down, Removed Borders */}
                <div className="relative glass-dark rounded-3xl p-10 aspect-square flex flex-col justify-center overflow-hidden group max-w-md mx-auto">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                  {/* Visual Grid Background */}
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                    backgroundSize: '24px 24px'
                  }} />

                  <div className="relative z-10 space-y-6">
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center"
                    >
                      <Sparkles size={20} className="text-cyan-400" />
                    </motion.div>
                    <div>
                      <span className="text-6xl font-black text-white tracking-tighter leading-none">
                        40<span className="text-cyan-500 font-serif-italic ml-2 text-4xl">%</span>
                      </span>
                      <p className="text-white/40 text-sm font-light leading-relaxed mt-3 max-w-[200px]">
                        Average strategic recall loss in enterprise teams after 24 hours.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-1 w-6 bg-white/10 rounded-full" />
                      ))}
                      <motion.div
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="h-1 w-6 bg-cyan-500 rounded-full"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30, scale: 0.95 }}
                whileInView={{ opacity: 1, x: 0, scale: 1 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                className="space-y-8"
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[9px] font-bold text-cyan-400 uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  The Friction Report
                </div>
                <h3 className="text-4xl md:text-6xl font-black text-white leading-[0.9] tracking-tighter">
                  STOP LOSING <br />
                  <span className="text-white/20 font-serif-italic">strategic momentum.</span>
                </h3>
                <p className="text-lg text-white/40 font-light leading-relaxed max-w-lg">
                  Meetings shouldn't be a void where information dies. AlignIQ bridges the gap between
                  <span className="text-white/80 italic px-2">raw dialogue</span> and
                  <span className="text-white/80 italic px-2">executable intelligence</span>,
                  ensuring every decision sticks.
                </p>

                <motion.div
                  whileHover={{ x: 10 }}
                  className="pt-2 flex items-center gap-4 text-white/20 cursor-pointer group"
                >
                  <div className="w-12 h-[1px] bg-white/10 group-hover:w-20 group-hover:bg-cyan-500/50 transition-all duration-500" />
                  <span className="text-[9px] uppercase font-black tracking-[0.4em] group-hover:text-white transition-colors">Read the Manifesto</span>
                </motion.div>
              </motion.div>
            </div>
          </section>
        </ZoomWrapper>

        {/* Virtuous Circle - UNSCALED (100% Impact) */}
        {/* <div className="glowing-divider my-10 md:my-10" /> */}
        <VirtuousCircle />
        {/* <div className="glowing-divider my-10 md:my-16" /> */}

        {/* BOTTOM SECTION - SCALED 0.8 */}
        <ZoomWrapper>
          {/* Feature Bento Grid */}
          <BentoFeatures />

          {/* <div className="glowing-divider my-10 md:my-16" /> */}

          {/* Immersive CTA & WCT Finale - Combined */}
          <section className="relative min-h-[900px] flex flex-col items-center justify-center py-32 overflow-hidden">

            {/* 1. PRODUCT CTA (Top) */}
            <div className="container mx-auto px-6 text-center relative z-10 mb-32">
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="max-w-4xl mx-auto"
              >
                <div className="text-cyan-500 font-black text-[9px] uppercase tracking-[0.5em] mb-8">Final Step</div>
                <h2 className="text-5xl md:text-7xl font-black text-white leading-[0.85] tracking-tighter mb-12">
                  READY TO SCALE <br />
                  <span className="font-serif-italic font-normal lowercase italic text-white/20">collective intel?</span>
                </h2>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsAuthModalOpen(true)}
                    className="bg-white text-black px-12 py-6 rounded-2xl font-black text-xl uppercase tracking-tight hover:bg-cyan-50 transition-all shadow-3xl flex items-center gap-3"
                  >
                    Join AlignIQ
                    <ArrowRight size={20} />
                  </motion.button>
                  <Link href="#pricing" className="text-white/30 hover:text-white transition-all text-[9px] font-black uppercase tracking-[0.3em] flex items-center gap-2 group">
                    View Pricing Models
                    <div className="w-6 h-[1px] bg-white/10 group-hover:w-12 transition-all" />
                  </Link>
                </div>
              </motion.div>
            </div>

            {/* Visual Connector - Fading Line */}
            <div className="w-px h-32 bg-gradient-to-b from-transparent via-white/10 to-transparent relative z-10 mb-20" />

            {/* 2. WCT TRUST SIGNAL (Bottom - Large & Open) */}
            <div className="container mx-auto px-6 relative z-10 text-center">
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="flex flex-col items-center gap-8"
              >
                <div className="relative group cursor-default">
                  <div className="absolute inset-0 bg-cyan-500/20 blur-[50px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  <Image
                    src="/WCT_logo.png"
                    alt="WCT Logo"
                    width={120}
                    height={120}
                    className="w-24 h-auto md:w-32 object-contain relative z-10 drop-shadow-2xl"
                  />
                </div>

                <div className="max-w-xl mx-auto space-y-4">
                  <p className="text-2xl font-bold text-white tracking-tight">
                    Impact Intelligence Suite
                  </p>
                  <p className="text-white/40 text-sm font-light leading-relaxed">
                    WCT offers a suite of productivity tools and frameworks that help improve individual and team meta-cognition. Discover our distinct <span className="text-white/60 italic">"way we think about things."</span>
                  </p>
                </div>

                <Link href="https://www.waferwire.com/" target="_blank" className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-white/30 hover:text-cyan-400 transition-colors mt-4">
                  Explore WaferWire
                  <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </motion.div>
            </div>

            {/* Epic Background Elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] opacity-[0.05] pointer-events-none" style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
              backgroundSize: '32px 32px'
            }} />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-[800px] bg-gradient-to-t from-cyan-900/10 via-transparent to-transparent pointer-events-none" />
          </section>
        </ZoomWrapper>
      </main>

      <ZoomWrapper>
        <Footer />
      </ZoomWrapper>
    </div>
  );
}
