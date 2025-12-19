"use client";

import { motion } from 'framer-motion';
import {
    Network,
    FileText,
    BarChart3,
    ShieldCheck,
    Zap,
    Cpu,
    Activity,
    Lock,
    Scale
} from 'lucide-react';

const features = [
    {
        id: 'mindmap',
        title: 'Neural Connections',
        description: 'Visualize every claim and connection in a dynamic, high-fidelity mindmap.',
        icon: Network,
        gridClass: 'md:col-span-3 md:row-span-2',
        color: 'cyan',
        visual: <NeuralVisual />
    },
    {
        id: 'summary',
        title: 'Executive Int.',
        description: 'Strategist-level summaries generated in seconds.',
        icon: FileText,
        gridClass: 'md:col-span-1 md:row-span-2',
        color: 'purple',
        visual: <SummaryVisual />
    },
    {
        id: 'tone',
        title: 'Sentiment Pulse',
        description: 'Real-time emotional resonance analysis throughout every discussion.',
        icon: BarChart3,
        gridClass: 'md:col-span-2 md:row-span-1',
        color: 'blue',
        visual: <PulseVisual />
    },
    {
        id: 'security',
        title: 'Obsidian Lock',
        description: 'Enterprise-grade encryption for sensitive dialogue.',
        icon: ShieldCheck,
        gridClass: 'md:col-span-2 md:row-span-1',
        color: 'emerald',
        visual: <SecurityVisual />
    }
];

export function BentoFeatures() {
    return (
        <section id="features" className="py-32 bg-background relative overflow-hidden">
            <div className="container mx-auto px-6">
                {/* Header */}
                <div className="mb-20 flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div className="max-w-2xl">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="text-cyan-500 font-black text-[10px] uppercase tracking-[0.3em] mb-4"
                        >
                            Expert Intelligence
                        </motion.div>
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-[0.9]"
                        >
                            THE STRATEGIC <br />
                            <span className="font-serif-italic font-normal lowercase italic text-white/30">advantage.</span>
                        </motion.h2>
                    </div>
                    <motion.p
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="max-w-xs text-white/30 text-sm font-light leading-relaxed"
                    >
                        Every component is engineered for clarity, turning raw conversation into
                        structured performance levers.
                    </motion.p>
                </div>

                {/* Asymmetrical Bento Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[200px]">
                    {features.map((feature, index) => (
                        <motion.div
                            key={feature.id}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                            className={`group relative overflow-hidden rounded-3xl bg-white/[0.02] border border-white/[0.06] p-8 flex flex-col justify-between hover:bg-white/[0.04] transition-all duration-500 ${feature.gridClass}`}
                        >
                            {/* Inner Glow */}
                            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                            {/* Live Visual Component */}
                            <div className="absolute top-6 right-6 w-20 h-20 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700">
                                {feature.visual}
                            </div>

                            <div className="relative z-10 w-full">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[9px] font-bold text-white/40 mb-4 uppercase tracking-widest">
                                    <feature.icon size={10} />
                                    {feature.id}
                                </div>
                                <h3 className="text-xl md:text-2xl font-black text-white mb-2 tracking-tight group-hover:text-glow-cyan transition-all">
                                    {feature.title}
                                </h3>
                                <p className="text-white/30 text-sm font-light leading-relaxed max-w-[240px]">
                                    {feature.description}
                                </p>
                            </div>

                            {/* Corner Accent */}
                            <div className="absolute bottom-6 right-6 text-white/5 group-hover:text-white/20 transition-all">
                                <Activity size={20} />
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Background Texture */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] opacity-[0.03] pointer-events-none" style={{
                backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                backgroundSize: '40px 40px'
            }} />
        </section>
    );
}

// Minimalist Live Visual Components
function NeuralVisual() {
    return (
        <div className="relative w-full h-full flex items-center justify-center">
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border border-white/10 rounded-full border-dashed p-2"
            >
                <div className="w-full h-full border border-cyan-500/30 rounded-full animate-pulse" />
            </motion.div>
            <div className="absolute w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_10px_#22d3ee]" />
        </div>
    );
}

function SummaryVisual() {
    return (
        <div className="flex flex-col gap-2 w-full h-full justify-center">
            {[70, 40, 90, 60].map((w, i) => (
                <motion.div
                    key={i}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${w}%` }}
                    className="h-1 bg-purple-500/20 rounded-full overflow-hidden"
                >
                    <motion.div
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
                        className="w-1/2 h-full bg-purple-400/60"
                    />
                </motion.div>
            ))}
        </div>
    );
}

function PulseVisual() {
    return (
        <div className="flex items-center gap-1 w-full h-full justify-center">
            {[1, 2, 1.5, 2.5, 1, 1.8].map((h, i) => (
                <motion.div
                    key={i}
                    animate={{ scaleY: [1, h, 1] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    className="w-1 h-8 bg-blue-500/40 rounded-full origin-bottom"
                />
            ))}
        </div>
    );
}

function SecurityVisual() {
    return (
        <div className="relative w-full h-full flex items-center justify-center">
            <Lock size={32} className="text-emerald-500/20" />
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-2 border-emerald-500/30 border-t-transparent rounded-full"
            />
        </div>
    );
}
