"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, X, FileText, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface Notification {
    id: string;
    meetingId: string;
    title: string;
    type: 'completed' | 'failed';
    timestamp: Date;
}

export function ProcessingNotifications() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
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

                        // Only show notification when status changes to 'completed' or 'failed'
                        if (oldMeeting.status === 'processing' &&
                            (newMeeting.status === 'completed' || newMeeting.status === 'failed')) {

                            const notification: Notification = {
                                id: `${newMeeting.id}-${Date.now()}`,
                                meetingId: newMeeting.id,
                                title: newMeeting.title || 'Untitled Meeting',
                                type: newMeeting.status as 'completed' | 'failed',
                                timestamp: new Date()
                            };

                            setNotifications(prev => [notification, ...prev].slice(0, 5)); // Keep max 5

                            // Auto-dismiss after 10 seconds
                            setTimeout(() => {
                                setNotifications(prev => prev.filter(n => n.id !== notification.id));
                            }, 10000);
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

    const dismissNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-sm">
            <AnimatePresence mode="popLayout">
                {notifications.map((notification) => (
                    <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 100, scale: 0.9 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                        className={`relative p-4 rounded-xl shadow-lg border backdrop-blur-md ${notification.type === 'completed'
                                ? 'bg-green-50/95 border-green-200'
                                : 'bg-red-50/95 border-red-200'
                            }`}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => dismissNotification(notification.id)}
                            className="absolute top-2 right-2 p-1 rounded-full hover:bg-black/5 transition-colors"
                        >
                            <X className="h-4 w-4 text-slate-400" />
                        </button>

                        <div className="flex items-start gap-3 pr-6">
                            {/* Icon */}
                            <div className={`p-2 rounded-full ${notification.type === 'completed'
                                    ? 'bg-green-100 text-green-600'
                                    : 'bg-red-100 text-red-600'
                                }`}>
                                {notification.type === 'completed' ? (
                                    <CheckCircle2 className="h-5 w-5" />
                                ) : (
                                    <X className="h-5 w-5" />
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold ${notification.type === 'completed'
                                        ? 'text-green-900'
                                        : 'text-red-900'
                                    }`}>
                                    {notification.type === 'completed'
                                        ? 'Meeting Ready!'
                                        : 'Processing Failed'}
                                </p>
                                <p className="text-sm text-slate-600 truncate mt-0.5">
                                    {notification.title}
                                </p>

                                {notification.type === 'completed' && (
                                    <Link
                                        href={`/dashboard/meetings/${notification.meetingId}`}
                                        className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-800 mt-2"
                                    >
                                        <FileText className="h-3 w-3" />
                                        View Summary
                                        <ExternalLink className="h-3 w-3" />
                                    </Link>
                                )}
                            </div>
                        </div>

                        {/* Progress bar for auto-dismiss */}
                        <motion.div
                            className={`absolute bottom-0 left-0 h-1 rounded-b-xl ${notification.type === 'completed'
                                    ? 'bg-green-400'
                                    : 'bg-red-400'
                                }`}
                            initial={{ width: '100%' }}
                            animate={{ width: '0%' }}
                            transition={{ duration: 10, ease: 'linear' }}
                        />
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
