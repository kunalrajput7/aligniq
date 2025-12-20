"use client";

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ChevronDown, Sparkles } from 'lucide-react';

interface HeroSectionProps {
    onSignInClick: () => void;
}

export function HeroSection({ onSignInClick }: HeroSectionProps) {
    const { scrollY } = useScroll();

    // Scroll Animations - Pixel Based Staggered Exit
    // Badge: 0-150px
    const badgeOpacity = useTransform(scrollY, [0, 150], [1, 0]);
    const badgeY = useTransform(scrollY, [0, 150], [0, -20]);

    // Headline: 50-250px
    const titleOpacity = useTransform(scrollY, [50, 250], [1, 0]);
    const titleY = useTransform(scrollY, [50, 250], [0, -30]);
    const titleLeftX = useTransform(scrollY, [50, 250], [0, -100]); // TRANSFORM -> Left
    const titleRightX = useTransform(scrollY, [50, 250], [0, 100]); // meetings -> Right

    // Subheadline: 100-300px
    const subOpacity = useTransform(scrollY, [100, 300], [1, 0]);
    const subY = useTransform(scrollY, [100, 300], [0, -30]);
    const subLeftX = useTransform(scrollY, [100, 300], [0, -100]); // INTO PERFORMANCE -> Left

    // CTA: 200-400px
    const ctaOpacity = useTransform(scrollY, [200, 400], [1, 0]);
    const ctaY = useTransform(scrollY, [200, 400], [0, -30]);

    return (
        <section className="relative h-screen min-h-[900px] bg-background nebulous-bg overflow-hidden flex flex-col justify-center items-center pt-24 md:pt-32">
            {/* Noise Overlay for texture */}
            <div className="noise-overlay" />

            {/* Video Background */}
            <div className="absolute inset-0 z-0">
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                >
                    <source src="/background.mp4" type="video/mp4" />
                </video>
                {/* Dark Overlay for contrast */}
                <div className="absolute inset-0 bg-black/60 z-10" />
            </div>

            {/* Moving Glow Orbs (Optional: Keep or remove depending on preference, putting behind overlay) */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden animate-nebulous opacity-50">
                <div className="absolute top-[10%] left-[20%] w-[40%] h-[40%] rounded-full opacity-[0.08] blur-[120px] bg-cyan-400" />
                <div className="absolute bottom-[20%] right-[10%] w-[50%] h-[50%] rounded-full opacity-[0.05] blur-[120px] bg-purple-600" />
            </div>

            {/* Hero Content (First fold) */}
            <div className="relative z-10 w-full max-w-7xl mx-auto px-6 flex flex-col items-center justify-center -mt-10">
                <div className="text-center flex flex-col items-center w-full">
                    {/* Badge */}
                    <motion.div style={{ opacity: badgeOpacity, y: badgeY }} className="flex justify-center w-full">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass border-white/5 text-[9px] font-black uppercase tracking-[0.2em] text-cyan-400/80 mb-8 shadow-inner"
                        >
                            <Sparkles size={10} className="animate-pulse" />
                            Intelligence for Alignment
                        </motion.div>
                    </motion.div>

                    {/* Headline - Mixed Typography (Nexovia style) */}
                    <motion.div
                        style={{ opacity: titleOpacity, y: titleY }}
                        className="relative mb-6 w-full"
                    >
                        <motion.h1
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                            className="text-6xl md:text-8xl lg:text-9xl font-black leading-[0.85] tracking-tighter text-white"
                        >
                            <motion.span style={{ x: titleLeftX }} className="inline-block">TRANSFORM</motion.span> <br />
                            <motion.span
                                style={{ x: titleRightX }}
                                className="font-serif-italic font-normal lowercase tracking-normal text-white/90 italic block mt-2"
                            >
                                meetings
                            </motion.span>
                        </motion.h1>
                    </motion.div>

                    {/* Subheadline + Description Wrapper */}
                    <motion.div
                        style={{ opacity: subOpacity, y: subY, x: subLeftX }}
                        className="w-full"
                    >
                        <motion.h2
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
                            className="text-4xl md:text-6xl lg:text-7xl font-black leading-[0.85] tracking-tighter text-white/20 mt-2 mb-8"
                        >
                            INTO PERFORMANCE.
                        </motion.h2>

                        {/* Description */}
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 1.2, delay: 0.6 }}
                            className="max-w-xl mx-auto text-base text-white/40 font-light leading-relaxed mb-10 px-4"
                        >
                            Bridge the gap between conversation and execution. AlignIQ turns
                            chaotic interactions into a <span className="text-white/70 italic">Virtuous Circle of Engagement</span>.
                        </motion.p>
                    </motion.div>

                    {/* Primary CTA */}
                    <motion.div style={{ opacity: ctaOpacity, y: ctaY }} className="w-full flex justify-center">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.8 }}
                            className="flex flex-col sm:flex-row items-center justify-center gap-6"
                        >
                            <motion.button
                                whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.95)" }}
                                whileTap={{ scale: 0.98 }}
                                onClick={onSignInClick}
                                className="group relative bg-white text-black px-10 py-3.5 rounded-xl font-black text-sm tracking-tight transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)]"
                            >
                                Get Started Free
                            </motion.button>
                            <a href="https://www.waferwire.com/" target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-white transition-all font-bold text-sm flex items-center gap-2 group">
                                Explore WCT
                                <ChevronDown className="-rotate-90 group-hover:translate-x-1 transition-transform" size={16} />
                            </a>
                        </motion.div>
                    </motion.div>
                </div>
            </div>

            {/* Visual Fold Divider */}
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </section>
    );
}
