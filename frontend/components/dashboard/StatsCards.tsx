"use client";

import { useEffect, useState, useRef } from "react";
import { motion, useSpring, useTransform, useMotionValue } from "framer-motion";
import { createClient } from "@/lib/supabase";

interface StatsCardsProps {
    userId?: string;
}

// Animated counter component
function AnimatedNumber({ value, duration = 1 }: { value: number; duration?: number }) {
    const motionValue = useMotionValue(0);
    const springValue = useSpring(motionValue, { duration: duration * 1000 });
    const displayValue = useTransform(springValue, (v) => Math.round(v));
    const [display, setDisplay] = useState(0);

    useEffect(() => {
        motionValue.set(value);
    }, [value, motionValue]);

    useEffect(() => {
        const unsubscribe = displayValue.on("change", (latest) => {
            setDisplay(latest);
        });
        return () => unsubscribe();
    }, [displayValue]);

    return <>{display}</>;
}

export function StatsCards({ userId }: StatsCardsProps) {
    const [projectsCount, setProjectsCount] = useState<number>(0);
    const [meetingsCount, setMeetingsCount] = useState<number>(0);
    const [recentMeetingsCount, setRecentMeetingsCount] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);
    const [hasAnimated, setHasAnimated] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        if (userId) {
            fetchStats();
        }
    }, [userId]);

    // Real-time subscription for projects
    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel('stats_realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'projects' },
                () => fetchStats()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'meetings' },
                () => fetchStats()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'project_collaborators' },
                () => fetchStats()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, userId]);

    const fetchStats = async () => {
        if (!userId) return;

        if (!hasAnimated) {
            setIsLoading(true);
        }

        try {
            // Fetch owned projects count
            const { count: ownedProjectsCount } = await supabase
                .from('projects')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);

            // Fetch shared projects count (where user is collaborator)
            const { count: sharedProjectsCount } = await supabase
                .from('project_collaborators')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);

            // Fetch owned meetings count
            const { count: ownedMeetingsCount } = await supabase
                .from('meetings')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);

            // Fetch shared project IDs to get meetings from shared projects
            const { data: sharedProjects } = await supabase
                .from('project_collaborators')
                .select('project_id')
                .eq('user_id', userId);

            let sharedMeetingsCount = 0;
            if (sharedProjects && sharedProjects.length > 0) {
                const projectIds = sharedProjects.map(p => p.project_id);
                const { count } = await supabase
                    .from('meetings')
                    .select('*', { count: 'exact', head: true })
                    .in('project_id', projectIds);
                sharedMeetingsCount = count || 0;
            }

            // Fetch this week's meetings (owned + shared)
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const { count: recentOwnedCount } = await supabase
                .from('meetings')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .gte('created_at', weekAgo.toISOString());

            let recentSharedCount = 0;
            if (sharedProjects && sharedProjects.length > 0) {
                const projectIds = sharedProjects.map(p => p.project_id);
                const { count } = await supabase
                    .from('meetings')
                    .select('*', { count: 'exact', head: true })
                    .in('project_id', projectIds)
                    .gte('created_at', weekAgo.toISOString());
                recentSharedCount = count || 0;
            }

            setProjectsCount((ownedProjectsCount || 0) + (sharedProjectsCount || 0));
            setMeetingsCount((ownedMeetingsCount || 0) + sharedMeetingsCount);
            setRecentMeetingsCount((recentOwnedCount || 0) + recentSharedCount);
        } catch (err) {
            console.error('Error fetching stats:', err);
        } finally {
            setIsLoading(false);
            setHasAnimated(true);
        }
    };

    const stats = [
        { label: "Active Projects", value: projectsCount, suffix: "" },
        { label: "Total Meetings", value: meetingsCount, suffix: "" },
        { label: "Recent Meetings", value: recentMeetingsCount, suffix: "this week" },
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
                            {isLoading ? '-' : <AnimatedNumber value={stat.value} duration={0.8} />}
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
