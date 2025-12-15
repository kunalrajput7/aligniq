"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase";

interface StatsCardsProps {
    userId?: string;
}

export function StatsCards({ userId }: StatsCardsProps) {
    const [projectsCount, setProjectsCount] = useState<number>(0);
    const [meetingsCount, setMeetingsCount] = useState<number>(0);
    const [recentMeetingsCount, setRecentMeetingsCount] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);

    const supabase = createClient();

    useEffect(() => {
        if (userId) {
            fetchStats();
        }
    }, [userId]);

    const fetchStats = async () => {
        if (!userId) return;

        setIsLoading(true);
        try {
            // Fetch projects count
            const { count: projectsCount } = await supabase
                .from('projects')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);

            // Fetch total meetings count
            const { count: meetingsCount } = await supabase
                .from('meetings')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);

            // Fetch this week's meetings
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const { count: recentCount } = await supabase
                .from('meetings')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .gte('created_at', weekAgo.toISOString());

            setProjectsCount(projectsCount || 0);
            setMeetingsCount(meetingsCount || 0);
            setRecentMeetingsCount(recentCount || 0);
        } catch (err) {
            console.error('Error fetching stats:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const stats = [
        { label: "Active Projects", value: projectsCount.toString(), suffix: "" },
        { label: "Total Meetings", value: meetingsCount.toString(), suffix: "" },
        { label: "Recent Meetings", value: recentMeetingsCount.toString(), suffix: "this week" },
    ];

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {stats.map((stat, index) => (
                <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-md"
                >
                    <span className="text-sm font-medium text-slate-500">{stat.label}</span>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className={`text-4xl font-bold text-slate-900 ${isLoading ? 'animate-pulse' : ''}`}>
                            {isLoading ? '-' : stat.value}
                        </span>
                        {stat.suffix && (
                            <span className="text-sm font-medium text-slate-400">{stat.suffix}</span>
                        )}
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
