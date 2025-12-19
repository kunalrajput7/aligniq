"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, X, ArrowRight } from 'lucide-react';

interface NavbarProps {
    onSignInClick: () => void;
}

export function Navbar({ onSignInClick }: NavbarProps) {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const navLinks = [
        { name: 'Philosophy', href: '#philosophy' },
        { name: 'Features', href: '#features' },
        { name: 'Enterprise', href: '#enterprise' },
        { name: 'Pricing', href: '#pricing' },
    ];

    return (
        <nav
            className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-700 ${scrolled ? 'py-2' : 'py-4'}`}
        >
            <div className="container mx-auto px-6 flex justify-center">
                <div
                    style={{ zoom: 0.8 }}
                    className={`relative flex items-center justify-between px-6 py-2 rounded-2xl transition-all duration-700 w-full max-w-4xl origin-top ${scrolled
                        ? 'bg-black/80 backdrop-blur-3xl border border-white/5 shadow-2xl overflow-hidden'
                        : 'bg-black/20 backdrop-blur-md border border-white/5'
                        }`}>

                    {/* Shiny Lines Glow Effect */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none">
                        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
                        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-400 to-transparent" />
                    </div>

                    {/* Logo / Branding - Image + Text */}
                    <Link href="/" className="relative z-10 flex items-center gap-3 group">
                        <div className="relative h-10 w-auto aspect-square transition-transform group-hover:scale-105">
                            <Image
                                src="/site_logo.png"
                                alt="AlignIQ Logo"
                                width={40}
                                height={40}
                                style={{ objectFit: 'contain' }}
                                className="drop-shadow-glow"
                            />
                        </div>
                        <span className="font-bold text-xl tracking-tight text-white group-hover:text-cyan-100 transition-colors">
                            AlignIQ
                        </span>
                    </Link>

                    {/* Right Side: Features Link + CTA */}
                    <div className="hidden md:flex items-center gap-8">
                        <Link
                            href="#features"
                            className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 hover:text-white transition-all relative group"
                        >
                            Features
                            <span className="absolute -bottom-1 left-0 w-0 h-px bg-cyan-400 transition-all group-hover:w-full" />
                        </Link>

                        <motion.button
                            whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,1)' }}
                            whileTap={{ scale: 0.98 }}
                            onClick={onSignInClick}
                            className="bg-white/90 backdrop-blur-sm text-black px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] flex items-center gap-2"
                        >
                            Get Started
                            <ArrowRight size={12} />
                        </motion.button>
                    </div>

                    {/* Mobile Menu Toggle */}
                    <button
                        className="md:hidden text-white/60 p-2 hover:text-white transition-colors"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    >
                        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="absolute top-full left-6 right-6 mt-4 bg-black/95 backdrop-blur-3xl rounded-[2rem] border border-white/5 p-10 md:hidden overflow-hidden shadow-3xl"
                    >
                        <div className="flex flex-col gap-8 items-center text-center">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    className="text-2xl font-black text-white uppercase tracking-tighter group"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    {link.name}
                                    <div className="h-0.5 w-0 bg-cyan-400 group-hover:w-full transition-all mx-auto mt-1" />
                                </Link>
                            ))}
                            <div className="w-12 h-px bg-white/10 my-2" />
                            <button onClick={() => { setMobileMenuOpen(false); onSignInClick(); }} className="text-white/40 font-black uppercase tracking-widest text-xs">Log In</button>
                            <button onClick={() => { setMobileMenuOpen(false); onSignInClick(); }} className="w-full bg-white text-black py-5 rounded-[1.5rem] font-black uppercase tracking-tight text-lg shadow-2xl">
                                Join AlignIQ
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
}
