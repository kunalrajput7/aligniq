"use client";

import { motion } from "framer-motion";
import { MoreHorizontal } from "lucide-react";

export function MeetingChains() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Meeting Chains</h3>
                <button className="text-slate-400 hover:text-slate-600">
                    <MoreHorizontal className="h-5 w-5" />
                </button>
            </div>

            <div className="mt-8 flex justify-center">
                {/* Simple CSS/SVG representation of the chain */}
                <div className="relative w-full max-w-sm">
                    <svg viewBox="0 0 400 150" className="w-full h-auto drop-shadow-sm">
                        {/* Paths */}
                        <path d="M 50 40 C 100 40, 100 80, 150 80" fill="none" stroke="#94a3b8" strokeWidth="2" />
                        <path d="M 230 80 C 260 80, 260 120, 300 120" fill="none" stroke="#94a3b8" strokeWidth="2" />
                        <path d="M 230 80 C 280 80, 280 40, 350 40" fill="none" stroke="#eab308" strokeWidth="2" />

                        {/* Nodes - constructed as foreignObjects for HTML styling or just rects */}
                        {/* Start Node */}
                        <rect x="20" y="20" width="80" height="36" rx="18" fill="#f1f5f9" />
                        <text x="60" y="44" fontFamily="sans-serif" fontSize="12" fill="#64748b" textAnchor="middle">Kickoff</text>

                        {/* Center Node */}
                        <rect x="150" y="60" width="110" height="40" rx="20" fill="#6366f1" />
                        <text x="205" y="85" fontFamily="sans-serif" fontSize="12" fontWeight="bold" fill="white" textAnchor="middle">Design Review</text>

                        {/* Bottom Node */}
                        <rect x="250" y="100" width="110" height="36" rx="18" fill="#e0e7ff" />
                        <text x="305" y="123" fontFamily="sans-serif" fontSize="12" fill="#4338ca" textAnchor="middle">Sprint Planning</text>

                        {/* Top Right Partial Node */}
                        <rect x="350" y="25" width="60" height="30" rx="15" fill="#fef08a" />
                        <text x="365" y="45" fontFamily="sans-serif" fontSize="12" fill="#854d0e" textAnchor="middle">Sta...</text>

                    </svg>
                </div>
            </div>
        </motion.div>
    );
}
