"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Sparkles, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthModal } from '@/components/AuthModal';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function Home() {
  const [showIntro, setShowIntro] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMessage, setAuthMessage] = useState("Sign in to your account");
  const [session, setSession] = useState<Session | null>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        // If already logged in, we could redirect, but usually landing page is accessible
        // router.push('/dashboard');
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth, router]);

  useEffect(() => {
    if (!showIntro) {
      return;
    }
    const timer = setTimeout(() => setShowIntro(false), 2000);
    return () => clearTimeout(timer);
  }, [showIntro]);

  const handleSignInClick = () => {
    if (session) {
      router.push('/dashboard');
    } else {
      setAuthMessage("Sign in to your account");
      setIsAuthModalOpen(true);
    }
  };

  const handleUploadClick = () => {
    if (session) {
      router.push('/dashboard');
    } else {
      setAuthMessage("Sign in to upload transcript");
      setIsAuthModalOpen(true);
    }
  };

  return (
    <motion.main
      className="relative min-h-screen overflow-hidden bg-[#F8FAFC]"
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 1, 1] as const }}
    >
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        message={authMessage}
      />

      {/* Subtle dot pattern background */}
      <div className="absolute inset-0 opacity-[0.015]" style={{
        backgroundImage: 'radial-gradient(circle, #64748B 1px, transparent 1px)',
        backgroundSize: '24px 24px'
      }} />

      <AnimatePresence>
        {showIntro && (
          <motion.div
            key="intro"
            className="absolute inset-0 z-50 flex items-center justify-center bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="bg-gradient-to-r from-[#3B82F6] via-[#8B5CF6] to-[#06B6D4] bg-clip-text text-4xl font-bold uppercase tracking-[0.3em] text-transparent md:text-6xl"
            >
              ALIGNIQ
            </motion.h1>
          </motion.div>
        )}
      </AnimatePresence>

      {!showIntro && (
        <motion.section
          key="landing"
          className="relative z-10 min-h-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          {/* Header */}
          <header className="relative z-10 border-b border-slate-200/50 bg-white/80 backdrop-blur-sm">
            <div className="container mx-auto flex items-center justify-between px-4 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <Image
                  src="/logo.png"
                  alt="AlignIQ"
                  width={128}
                  height={32}
                  className="h-8 w-auto object-contain"
                  priority
                />
              </div>
              <div className="hidden md:flex items-center gap-8">
                <button className="text-sm font-light text-slate-600 transition hover:text-slate-900">
                  Features
                </button>
                <button className="text-sm font-light text-slate-600 transition hover:text-slate-900">
                  Solutions
                </button>
                <button className="text-sm font-light text-slate-600 transition hover:text-slate-900">
                  Resources
                </button>
                <button className="text-sm font-light text-slate-600 transition hover:text-slate-900">
                  Pricing
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSignInClick}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  {session ? "Dashboard" : "Sign in"}
                </button>
              </div>
            </div>
          </header>

          {/* Hero Section with Floating Elements */}
          <div className="container relative mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-20 sm:pb-32">
            {/* Top Left: Sticky Note */}
            <motion.div
              className="absolute left-4 top-8 w-48 sm:w-64 rotate-[-3deg] hidden lg:block"
              initial={{ opacity: 0, y: -20, rotate: -6 }}
              animate={{ opacity: 1, y: 0, rotate: -3 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              style={{
                animation: 'float 6s ease-in-out infinite'
              }}
            >
              <div className="rounded-lg bg-gradient-to-br from-yellow-200 to-yellow-300 p-6 shadow-2xl shadow-yellow-500/20">
                <p className="text-sm leading-relaxed text-slate-800">
                  <span className="font-semibold">Quick Tip:</span>
                  <br />
                  Upload your .vtt transcript and get instant AI-powered insights in seconds!
                </p>
              </div>
              <div className="mt-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500 shadow-2xl shadow-blue-500/40">
                <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </motion.div>

            {/* Top Center: App Icons */}
            <motion.div
              className="absolute left-1/2 top-6 sm:top-12 -translate-x-1/2 hidden md:block"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              style={{
                animation: 'float 5s ease-in-out infinite 0.5s'
              }}
            >
              <div className="rounded-2xl bg-white p-4 shadow-2xl shadow-slate-900/10">
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500" />
                  <div className="h-8 w-8 rounded-full bg-slate-800" />
                  <div className="h-8 w-8 rounded-full bg-slate-800" />
                  <div className="h-8 w-8 rounded-full bg-slate-800" />
                </div>
              </div>
            </motion.div>

            {/* Top Right: Action Items Card */}
            <motion.div
              className="absolute right-4 top-12 sm:right-8 sm:top-20 w-64 sm:w-72 rotate-[8deg] hidden xl:block"
              initial={{ opacity: 0, y: -20, rotate: 12 }}
              animate={{ opacity: 1, y: 0, rotate: 8 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              style={{
                animation: 'float 7s ease-in-out infinite 1s'
              }}
            >
              <div className="rounded-2xl bg-white p-5 shadow-2xl shadow-slate-900/10">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Action Items
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">Review Quarterly Results</div>
                    <div className="mt-1 text-sm text-slate-600">Marketing team presentation</div>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="flex items-center gap-1 text-cyan-600">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Due: Next Week
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Center: Main Headline */}
            <div className="relative z-10 mx-auto mt-16 sm:mt-24 max-w-4xl text-center">
              <motion.h1
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight text-slate-900"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
              >
                Transform meetings into
                <br />
                <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 bg-clip-text text-transparent">
                  actionable insights
                </span>
              </motion.h1>
              <motion.p
                className="mx-auto mt-4 sm:mt-6 max-w-2xl text-base sm:text-lg md:text-xl text-slate-600 px-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                Efficiently analyze meeting transcripts and generate comprehensive summaries with AI-powered intelligence.
              </motion.p>
              <motion.div
                className="mt-8 sm:mt-10 flex items-center justify-center gap-4 px-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                <button
                  onClick={handleUploadClick}
                  className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold text-white shadow-2xl shadow-blue-500/40 transition hover:shadow-2xl hover:shadow-blue-500/60 disabled:opacity-70"
                >
                  <span className="relative z-10">Upload transcript</span>
                  <div className="absolute inset-0 -z-0 bg-gradient-to-r from-cyan-500 to-blue-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                </button>
              </motion.div>
            </div>

            {/* Bottom Left: Analytics Widget */}
            <motion.div
              className="absolute bottom-8 left-4 sm:bottom-16 sm:left-12 w-64 sm:w-80 hidden lg:block"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              style={{
                animation: 'float 6.5s ease-in-out infinite 1.5s'
              }}
            >
              <div className="rounded-2xl bg-white p-6 shadow-2xl shadow-slate-900/10">
                <div className="mb-4 text-sm font-semibold text-slate-900">Meeting Analytics</div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Action Items</span>
                    <span className="text-2xl font-bold text-blue-600">12</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Participants</span>
                    <span className="text-2xl font-bold text-cyan-600">8</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Duration</span>
                    <span className="text-2xl font-bold text-purple-600">45m</span>
                  </div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-3/4 bg-gradient-to-r from-blue-500 to-cyan-500" />
                </div>
              </div>
            </motion.div>

            {/* Bottom Right: Integrations */}
            <motion.div
              className="absolute bottom-12 right-4 sm:bottom-20 sm:right-16 hidden xl:block"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              style={{
                animation: 'float 5.5s ease-in-out infinite 2s'
              }}
            >
              <div className="rounded-2xl bg-white p-6 shadow-2xl shadow-slate-900/15">
                <div className="mb-3 text-sm font-semibold text-slate-900">6 Thinking Hats Analysis</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col items-center p-2 rounded-xl bg-slate-50">
                    <div className="h-2 w-8 rounded-full bg-blue-500 mb-2" />
                    <span className="text-[10px] text-slate-500 font-medium">Process</span>
                  </div>
                  <div className="flex flex-col items-center p-2 rounded-xl bg-slate-50">
                    <div className="h-2 w-8 rounded-full bg-white border border-slate-300 mb-2" />
                    <span className="text-[10px] text-slate-500 font-medium">Facts</span>
                  </div>
                  <div className="flex flex-col items-center p-2 rounded-xl bg-slate-50">
                    <div className="h-2 w-8 rounded-full bg-red-500 mb-2" />
                    <span className="text-[10px] text-slate-500 font-medium">Emotions</span>
                  </div>
                  <div className="flex flex-col items-center p-2 rounded-xl bg-slate-50">
                    <div className="h-2 w-8 rounded-full bg-green-500 mb-2" />
                    <span className="text-[10px] text-slate-500 font-medium">Creativity</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.section>
      )}
    </motion.main>
  );
}
