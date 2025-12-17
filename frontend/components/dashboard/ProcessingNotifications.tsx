"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, X, FileText, XCircle, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface CompletedMeeting {
    id: string;
    meetingId: string;
    title: string;
    type: 'completed' | 'failed';
    timestamp: Date;
}

export function ProcessingNotifications() {
    const [completedMeeting, setCompletedMeeting] = useState<CompletedMeeting | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        // Get current user session
        const setupSubscription = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;

            // Subscribe to meeting status changes for this user
            const channel = supabase
                .channel('processing_notifications')
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'meetings',
                        filter: `user_id=eq.${session.user.id}`
                    },
                    (payload) => {
                        const newMeeting = payload.new as any;
                        const oldMeeting = payload.old as any;

                        // Only show modal when status changes from 'processing' to 'completed' or 'failed'
                        if (oldMeeting.status === 'processing' &&
                            (newMeeting.status === 'completed' || newMeeting.status === 'failed')) {

                            const meeting: CompletedMeeting = {
                                id: `${newMeeting.id}-${Date.now()}`,
                                meetingId: newMeeting.id,
                                title: newMeeting.title || 'Untitled Meeting',
                                type: newMeeting.status as 'completed' | 'failed',
                                timestamp: new Date()
                            };

                            setCompletedMeeting(meeting);
                            setIsModalOpen(true);
                        }
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        };

        setupSubscription();
    }, [supabase]);

    const closeModal = () => {
        setIsModalOpen(false);
        // Clear the meeting after animation completes
        setTimeout(() => setCompletedMeeting(null), 300);
    };

    return (
        <AnimatePresence>
            {isModalOpen && completedMeeting && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeModal}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    >
                        <div className={`relative w-full max-w-md rounded-2xl shadow-2xl border-2 overflow-hidden ${completedMeeting.type === 'completed'
                                ? 'bg-gradient-to-br from-green-50 to-emerald-100 border-green-300'
                                : 'bg-gradient-to-br from-red-50 to-rose-100 border-red-300'
                            }`}>
                            {/* Close button */}
                            <button
                                onClick={closeModal}
                                className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/10 transition-colors z-10"
                            >
                                <X className="h-5 w-5 text-slate-600" />
                            </button>

                            {/* Content */}
                            <div className="p-8 text-center">
                                {/* Icon with animation */}
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: 'spring', delay: 0.1, damping: 15 }}
                                    className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6 ${completedMeeting.type === 'completed'
                                            ? 'bg-green-500 shadow-lg shadow-green-200'
                                            : 'bg-red-500 shadow-lg shadow-red-200'
                                        }`}
                                >
                                    {completedMeeting.type === 'completed' ? (
                                        <CheckCircle2 className="h-10 w-10 text-white" />
                                    ) : (
                                        <XCircle className="h-10 w-10 text-white" />
                                    )}
                                </motion.div>

                                {/* Sparkles for success */}
                                {completedMeeting.type === 'completed' && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.2 }}
                                        className="absolute top-12 left-1/2 -translate-x-1/2"
                                    >
                                        <Sparkles className="h-6 w-6 text-yellow-500 animate-pulse" />
                                    </motion.div>
                                )}

                                {/* Title */}
                                <motion.h2
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.15 }}
                                    className={`text-2xl font-bold mb-2 ${completedMeeting.type === 'completed'
                                            ? 'text-green-800'
                                            : 'text-red-800'
                                        }`}
                                >
                                    {completedMeeting.type === 'completed'
                                        ? '🎉 Meeting Processed!'
                                        : 'Processing Failed'}
                                </motion.h2>

                                {/* Meeting title */}
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                    className="text-slate-600 mb-6"
                                >
                                    <span className="font-medium">{completedMeeting.title}</span>
                                    <br />
                                    <span className="text-sm">
                                        {completedMeeting.type === 'completed'
                                            ? 'Your meeting summary is ready to view!'
                                            : 'Something went wrong. Please try again.'}
                                    </span>
                                </motion.p>

                                {/* Buttons */}
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.25 }}
                                    className="flex gap-3 justify-center"
                                >
                                    {completedMeeting.type === 'completed' && (
                                        <Link
                                            href={`/dashboard/meetings/${completedMeeting.meetingId}`}
                                            onClick={closeModal}
                                            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl shadow-lg shadow-green-200 transition-all hover:scale-105"
                                        >
                                            <FileText className="h-5 w-5" />
                                            View Summary
                                        </Link>
                                    )}
                                    <button
                                        onClick={closeModal}
                                        className={`px-6 py-3 font-semibold rounded-xl transition-all hover:scale-105 ${completedMeeting.type === 'completed'
                                                ? 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                                                : 'bg-red-600 hover:bg-red-700 text-white'
                                            }`}
                                    >
                                        {completedMeeting.type === 'completed' ? 'Dismiss' : 'Close'}
                                    </button>
                                </motion.div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
