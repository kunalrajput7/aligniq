"use client";

import { motion } from "framer-motion";

interface WelcomeBannerProps {
    userName?: string | null;
    onUploadClick: () => void;
}

export function WelcomeBanner({ userName, onUploadClick }: WelcomeBannerProps) {
    // Use "Alex" as default or the user's name if available (fetching logic to be refined)
    // For the prompt's specific visual requirement: "Welcome back, Alex!"
    // I will use a fallback but try to display the user's name.

    const displayName = userName ? userName.split(' ')[0] : 'User';

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-50 via-indigo-50 to-white p-8 border border-white shadow-sm"
        >
            <div className="relative z-10 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">
                        Welcome back, {displayName}!
                    </h1>
                    <p className="mt-2 text-slate-500 text-lg">
                        Here's your project overview
                    </p>
                </div>
                <button
                    onClick={onUploadClick}
                    className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-all hover:bg-blue-700 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98]"
                >
                    New Meeting Upload
                </button>
            </div>

            {/* Decorative gradient blob */}
            <div className="absolute right-0 top-0 -mt-20 -mr-20 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl transition-all duration-700 group-hover:bg-blue-400/20" />
        </motion.div>
    );
}
