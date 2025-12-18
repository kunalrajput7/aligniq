"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FolderPlus, Users, Bell, Sparkles, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";

const features = [
    {
        icon: FolderPlus,
        title: "Create Projects",
        description: "Organize your meetings into projects for better tracking and collaboration",
        gradient: "from-amber-400 to-orange-500",
        bgGradient: "from-amber-50 to-orange-50",
    },
    {
        icon: Users,
        title: "Collaborate with Team",
        description: "Invite members to projects and work together on meeting insights",
        gradient: "from-blue-400 to-indigo-500",
        bgGradient: "from-blue-50 to-indigo-50",
    },
    {
        icon: Bell,
        title: "Stay Updated",
        description: "Get real-time notifications when meetings are processed or shared",
        gradient: "from-emerald-400 to-teal-500",
        bgGradient: "from-emerald-50 to-teal-50",
    },
];

export function MeetingChains() {
    const [currentIndex, setCurrentIndex] = useState(0);

    // Auto-rotate through features
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % features.length);
        }, 8000);
        return () => clearInterval(interval);
    }, []);

    const currentFeature = features[currentIndex];
    const Icon = currentFeature.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative rounded-2xl border border-slate-100 bg-white p-6 shadow-sm overflow-hidden"
        >
            {/* Animated background gradient */}
            <motion.div
                key={currentIndex}
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className={`absolute inset-0 bg-gradient-to-br ${currentFeature.bgGradient} opacity-50`}
            />

            {/* Floating particles animation */}
            <div className="absolute inset-0 overflow-hidden">
                {[...Array(5)].map((_, i) => (
                    <motion.div
                        key={i}
                        className={`absolute w-2 h-2 rounded-full bg-gradient-to-r ${currentFeature.gradient} opacity-30`}
                        initial={{
                            x: Math.random() * 100 + "%",
                            y: "100%",
                            scale: Math.random() * 0.5 + 0.5
                        }}
                        animate={{
                            y: "-20%",
                            x: `${Math.random() * 100}%`,
                        }}
                        transition={{
                            duration: Math.random() * 3 + 4,
                            repeat: Infinity,
                            delay: i * 0.8,
                            ease: "linear"
                        }}
                    />
                ))}
            </div>

            {/* Header */}
            <div className="relative flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-amber-500" />
                    <h3 className="text-lg font-semibold text-slate-900">Quick Tips</h3>
                </div>
                {/* Dots indicator */}
                <div className="flex gap-1.5">
                    {features.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setCurrentIndex(i)}
                            className={`w-2 h-2 rounded-full transition-all ${i === currentIndex
                                    ? `bg-gradient-to-r ${currentFeature.gradient} w-4`
                                    : 'bg-slate-300 hover:bg-slate-400'
                                }`}
                        />
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="relative">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="flex items-center gap-4"
                    >
                        {/* Icon */}
                        <motion.div
                            animate={{
                                scale: [1, 1.05, 1],
                                rotate: [0, 5, -5, 0]
                            }}
                            transition={{
                                duration: 3,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                            className={`shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br ${currentFeature.gradient} flex items-center justify-center shadow-lg`}
                        >
                            <Icon className="h-8 w-8 text-white" />
                        </motion.div>

                        {/* Text */}
                        <div className="flex-1">
                            <h4 className="font-semibold text-slate-900 text-lg mb-1">
                                {currentFeature.title}
                            </h4>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                {currentFeature.description}
                            </p>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Progress bar */}
            <motion.div
                key={`progress-${currentIndex}`}
                className={`absolute bottom-0 left-0 h-1 bg-gradient-to-r ${currentFeature.gradient}`}
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 4, ease: "linear" }}
            />
        </motion.div>
    );
}
