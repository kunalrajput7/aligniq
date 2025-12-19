"use client";

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { Twitter, Github, Linkedin, Mail, ArrowUpRight } from 'lucide-react';

export function Footer() {
    return (
        <footer className="relative py-12 border-t border-white/[0.03] overflow-hidden bg-black">
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-950/5 to-cyan-900/10" />

            <div className="container mx-auto px-6 max-w-5xl relative z-10">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-10 mb-12">
                    {/* Brand Info */}
                    <div className="space-y-4">
                        <Link href="/" className="flex items-center gap-3 group">
                            <div className="relative h-8 w-auto aspect-square transition-transform group-hover:scale-105">
                                <Image
                                    src="/site_logo.png"
                                    alt="AlignIQ Logo"
                                    width={32}
                                    height={32}
                                    style={{ objectFit: 'contain' }}
                                    className="drop-shadow-glow"
                                />
                            </div>
                            <span className="font-bold text-xl tracking-tight text-white group-hover:text-cyan-100 transition-colors">
                                AlignIQ
                            </span>
                        </Link>
                        <p className="text-white/30 text-sm font-light leading-relaxed max-w-xs">
                            Turning raw dialogue into high-performance intelligence.
                        </p>
                    </div>

                    {/* Right Side: Social & Input */}
                    <div className="flex flex-col md:items-end gap-6">
                        <div className="flex items-center gap-4 text-white/20">
                            {[Twitter, Github, Linkedin, Mail].map((Icon, i) => (
                                <Link key={i} href="#" className="hover:text-white transition-colors duration-300">
                                    <Icon size={18} strokeWidth={1.5} />
                                </Link>
                            ))}
                        </div>
                        <div className="relative group w-full md:w-auto">
                            <input
                                type="email"
                                placeholder="Stay updated"
                                className="bg-white/[0.03] border border-white/5 rounded-full px-5 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-all font-light w-64"
                            />
                            <button className="absolute right-1 top-1 bottom-1 bg-white text-black px-3 rounded-full font-bold text-[10px] uppercase tracking-wide hover:bg-cyan-50 transition-colors">
                                Join
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-white/[0.03] flex flex-col md:flex-row items-center justify-between gap-6">
                    <p className="text-[10px] text-white/10 uppercase font-bold tracking-widest">
                        © 2025 ALIGNIQ.
                    </p>
                    <div className="flex gap-6 text-[10px] text-white/10 font-bold tracking-widest uppercase">
                        <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
                        <Link href="#" className="hover:text-white transition-colors">Legal</Link>
                    </div>
                </div>
            </div>

            {/* Decorative Glow Elements (Nexovia/Fincore style) */}
            <div className="absolute -bottom-48 -left-48 w-full h-96 bg-cyan-500/5 blur-[120px] rounded-full pointer-events-none" />
        </footer>
    );
}
