"use client";

import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import {
    Lightbulb,
    Brain,
    Users,
    Rocket,
    Heart,
    ArrowUpRight,
    Star
} from 'lucide-react';

const phases = [
    { id: 'clarity', label: 'Clarity', icon: Lightbulb, color: 'from-cyan-400 to-blue-500', description: 'Simplicity and focus improve innovation and information recall.' },
    { id: 'recall', label: 'Better Recall', icon: Brain, color: 'from-blue-500 to-purple-500', description: 'Teams act with confidence and precision through high retention.' },
    { id: 'understanding', label: 'Shared Understanding', icon: Users, color: 'from-purple-500 to-pink-500', description: 'Deep trust enables effortless collaboration and alignment.' },
    { id: 'execution', label: 'Faster Execution', icon: Rocket, color: 'from-pink-500 to-orange-500', description: 'Frictionless flow turns work into a source of purpose.' },
    { id: 'morale', label: 'Higher Morale', icon: Heart, color: 'from-orange-500 to-red-500', description: 'Inclusion and psychological safety boost team belonging.' },
    { id: 'improvement', label: 'Continuous Improvement', icon: ArrowUpRight, color: 'from-red-500 to-cyan-400', description: 'Positive experiences reinforce a self-sustaining loop of growth.' },
];

export function VirtuousCircle() {
    const containerRef = useRef(null);
    const isInView = useInView(containerRef, { once: false, amount: 0.3 });

    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "end start"]
    });

    const yParticles = useTransform(scrollYProgress, [0, 1], [0, -200]);
    const rotateParticles = useTransform(scrollYProgress, [0, 1], [0, 45]);

    return (
        <section id="philosophy" className="relative bg-background overflow-hidden">
            {/* Parallax Background Particles */}
            <motion.div
                style={{ y: yParticles, rotate: rotateParticles }}
                className="absolute inset-0 pointer-events-none opacity-20"
            >
                {[...Array(20)].map((_, i) => (
                    <Star
                        key={i}
                        size={Math.random() * 8 + 4}
                        className="absolute text-white/40"
                        style={{
                            top: `${Math.random() * 100}%`,
                            left: `${Math.random() * 100}%`
                        }}
                    />
                ))}
            </motion.div>

            <div className="container mx-auto px-6 relative z-10">
                {/* Section Header */}
                {/* Section Header */}
                <div className="text-center mb-20">
                    <motion.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        className="text-cyan-500 font-black text-[10px] uppercase tracking-[0.4em] mb-4"
                    >
                        The Philosophy
                    </motion.div>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-4xl md:text-6xl font-black text-white mb-6 uppercase tracking-tighter leading-[0.85]"
                    >
                        THE VIRTUOUS <br />
                        <span className="font-serif-italic font-normal lowercase italic text-white/20">engagement loop.</span>
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        className="max-w-xl mx-auto text-white/30 font-light text-lg leading-relaxed"
                    >
                        Turning meetings from a chore into a <span className="text-white/60 italic">strategic lever</span> for
                        retention, cohesion, and joy through AlignIQ.
                    </motion.p>
                </div>

                {/* The Circle Visualization */}
                <div ref={containerRef} className="relative max-w-4xl mx-auto h-[600px] flex items-center justify-center">
                    {/* Central Hub */}
                    <motion.div
                        animate={{
                            scale: isInView ? [1, 1.05, 1] : 1,
                            boxShadow: isInView ? [
                                "0 0 40px rgba(6, 182, 212, 0.1)",
                                "0 0 80px rgba(6, 182, 212, 0.3)",
                                "0 0 40px rgba(6, 182, 212, 0.1)"
                            ] : "0 0 20px rgba(255, 255, 255, 0.05)"
                        }}
                        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                        className="relative z-20 w-40 h-40 rounded-full glass border-white/5 flex flex-col items-center justify-center text-center p-6 shadow-inner"
                    >
                        <span className="text-[9px] uppercase tracking-[0.3em] font-black text-cyan-400/60 mb-2">Peak Outcome</span>
                        <span className="text-xl font-black text-white leading-none tracking-tighter">PERFORMANCE <br /> & JOY</span>
                    </motion.div>

                    {/* Glowing Connecting Lines */}
                    <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none overflow-visible">
                        <motion.circle
                            cx="50%"
                            cy="50%"
                            r="220"
                            fill="none"
                            stroke="url(#circle-gradient)"
                            strokeWidth="1"
                            strokeDasharray="4 12"
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{
                                pathLength: isInView ? 1 : 0,
                                opacity: isInView ? 0.3 : 0,
                                rotate: 360
                            }}
                            transition={{
                                pathLength: { duration: 3, ease: "easeInOut" },
                                opacity: { duration: 1.5 },
                                rotate: { duration: 120, repeat: Infinity, ease: "linear" }
                            }}
                        />
                        <defs>
                            <linearGradient id="circle-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#22d3ee" />
                                <stop offset="50%" stopColor="#a855f7" />
                                <stop offset="100%" stopColor="#ec4899" />
                            </linearGradient>
                        </defs>
                    </svg>

                    {/* Phase Orbs */}
                    {phases.map((phase, index) => {
                        const angle = (index * (360 / phases.length)) * (Math.PI / 180);
                        const radius = 220;
                        const x = Math.cos(angle) * radius;
                        const y = Math.sin(angle) * radius;

                        // Determine if item is on left or right side of circle for tooltip positioning
                        // Angles: 0 (Right), 60, 120 (Left), 180 (Left), 240 (Left), 300 (Rightish/Bottom)
                        // Simplified: x > 0 is right, x < 0 is left.
                        const isRightSide = x >= 0;

                        return (
                            <motion.div
                                key={phase.id}
                                initial={{ opacity: 0, scale: 0 }}
                                animate={isInView ? {
                                    opacity: 1,
                                    scale: 1,
                                    x, y
                                } : { opacity: 0, scale: 0 }}
                                transition={{ duration: 0.8, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
                                className="absolute z-30 group"
                            >
                                <div className="relative">
                                    {/* Orb */}
                                    <motion.div
                                        whileHover={{ scale: 1.2, rotate: 5, boxShadow: "0 0 30px rgba(255,255,255,0.2)" }}
                                        className={`w-14 h-14 rounded-full glass border-white/10 flex items-center justify-center transition-all duration-500 shadow-xl overflow-hidden bg-black/40`}
                                    >
                                        <div className={`absolute inset-0 bg-gradient-to-br ${phase.color} opacity-0 group-hover:opacity-40 transition-opacity`} />
                                        <phase.icon className="text-white/90 w-6 h-6 relative z-10" />
                                    </motion.div>

                                    {/* Detailed Tooltip - Conditional Positioning */}
                                    <div className={`absolute top-1/2 -translate-y-1/2 w-64 pointer-events-none transition-all duration-500 opacity-0 group-hover:opacity-100 bg-black/90 backdrop-blur-xl border border-white/10 p-5 rounded-2xl shadow-3xl z-50
                                        ${isRightSide ? "left-20 group-hover:left-24" : "right-20 group-hover:right-24 text-right"}
                                    `}>
                                        <h4 className={`text-white font-black text-sm mb-2 tracking-tight flex items-center gap-2 ${!isRightSide && "flex-row-reverse"}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${phase.color}`} />
                                            {phase.label}
                                        </h4>
                                        <p className="text-white/70 text-xs font-medium leading-relaxed">{phase.description}</p>
                                    </div>

                                    {/* Static Label Refined */}
                                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                                        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/30 group-hover:text-cyan-400 transition-colors">
                                            {phase.label}
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Subtle Gradient Atmosphere */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-radial from-cyan-500/5 to-transparent opacity-50 pointer-events-none" />
        </section>
    );
}
