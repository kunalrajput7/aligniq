"use client";

import { useEffect, useState } from 'react';
import { motion } from "framer-motion";
import { MoreHorizontal, Network, ExternalLink } from "lucide-react";
import { createClient } from '@/lib/supabase';
import Link from 'next/link';

interface LatestMindmap {
    meetingId: string;
    meetingTitle: string;
    centerNode: string;
    nodeCount: number;
    chapterTitles: string[];
}

export function MindmapPreview() {
    const [latestMindmap, setLatestMindmap] = useState<LatestMindmap | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const fetchLatestMindmap = async () => {
            try {
                // Get current user
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user) {
                    setIsLoading(false);
                    return;
                }

                // Fetch the latest completed meeting with its summary
                const { data: meetings, error: meetingError } = await supabase
                    .from('meetings')
                    .select('id, title, user_id')
                    .eq('user_id', session.user.id)
                    .eq('status', 'completed')
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (meetingError || !meetings || meetings.length === 0) {
                    setIsLoading(false);
                    return;
                }

                const meeting = meetings[0];

                // Fetch the mindmap data from meeting_summaries
                const { data: summary, error: summaryError } = await supabase
                    .from('meeting_summaries')
                    .select('mindmap_json, chapters_json')
                    .eq('meeting_id', meeting.id)
                    .single();

                if (summaryError || !summary?.mindmap_json) {
                    setIsLoading(false);
                    return;
                }

                const mindmap = summary.mindmap_json;
                const chapters = summary.chapters_json || [];

                setLatestMindmap({
                    meetingId: meeting.id,
                    meetingTitle: meeting.title || 'Untitled Meeting',
                    centerNode: mindmap.center_node?.label || 'Meeting',
                    nodeCount: (mindmap.nodes?.length || 0) + 1,
                    chapterTitles: chapters.slice(0, 4).map((ch: any) => ch.title || 'Chapter'),
                });
            } catch (err) {
                console.error('Error fetching latest mindmap:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchLatestMindmap();
    }, [supabase]);

    // Generate preview SVG based on mindmap structure
    const renderMindmapPreview = () => {
        if (!latestMindmap) {
            return (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                    No mindmaps yet
                </div>
            );
        }

        const chapters = latestMindmap.chapterTitles;
        const nodeCount = Math.min(chapters.length, 4);

        // Calculate positions for chapter nodes
        const positions = [];
        const startY = nodeCount <= 2 ? 100 : 40;
        const spacing = nodeCount <= 2 ? 80 : 45;

        for (let i = 0; i < nodeCount; i++) {
            positions.push({
                x: 300,
                y: startY + (i * spacing),
                title: chapters[i]?.slice(0, 25) + (chapters[i]?.length > 25 ? '...' : '')
            });
        }

        return (
            <svg viewBox="0 0 400 200" className="w-full h-full">
                {/* Center node */}
                <motion.g
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                >
                    <rect
                        x="30"
                        y="70"
                        width="140"
                        height="60"
                        rx="12"
                        fill="#4f46e5"
                        opacity="0.9"
                    />
                    <text
                        x="100"
                        y="105"
                        textAnchor="middle"
                        fontSize="11"
                        fill="white"
                        fontWeight="600"
                    >
                        {latestMindmap.centerNode.slice(0, 18)}
                        {latestMindmap.centerNode.length > 18 ? '...' : ''}
                    </text>
                </motion.g>

                {/* Connection lines */}
                {positions.map((pos, idx) => (
                    <motion.path
                        key={`line-${idx}`}
                        d={`M 170 100 C 220 100, 250 ${pos.y + 15}, ${pos.x - 10} ${pos.y + 15}`}
                        stroke="#94a3b8"
                        strokeWidth="1.5"
                        fill="none"
                        opacity="0.6"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ delay: 0.2 + idx * 0.1, duration: 0.4 }}
                    />
                ))}

                {/* Chapter nodes */}
                {positions.map((pos, idx) => (
                    <motion.g
                        key={`node-${idx}`}
                        initial={{ scale: 0, opacity: 0, x: -20 }}
                        animate={{ scale: 1, opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + idx * 0.1, type: "spring", stiffness: 200 }}
                    >
                        <rect
                            x={pos.x}
                            y={pos.y}
                            width="90"
                            height="30"
                            rx="8"
                            fill="#374151"
                            opacity="0.9"
                        />
                        <text
                            x={pos.x + 45}
                            y={pos.y + 19}
                            textAnchor="middle"
                            fontSize="8"
                            fill="white"
                        >
                            {pos.title.slice(0, 14)}
                            {pos.title.length > 14 ? '...' : ''}
                        </text>
                    </motion.g>
                ))}

                {/* Node count badge */}
                <motion.g
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.6, type: "spring" }}
                >
                    <circle cx="370" cy="180" r="16" fill="#6366f1" />
                    <text x="370" y="184" textAnchor="middle" fontSize="10" fill="white" fontWeight="600">
                        {latestMindmap.nodeCount}
                    </text>
                </motion.g>
            </svg>
        );
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
        >
            <div className="flex items-center justify-between z-10 relative">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <Network className="h-5 w-5 text-indigo-500" />
                        Latest Auto-Mindmap
                    </h3>
                    <p className="text-sm text-slate-500">
                        {latestMindmap ? latestMindmap.meetingTitle : 'Recent meeting - preview'}
                    </p>
                </div>
                {latestMindmap && (
                    <Link href={`/dashboard/meetings/${latestMindmap.meetingId}?tab=mindmap`}>
                        <button className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                            Open
                            <ExternalLink className="h-4 w-4" />
                        </button>
                    </Link>
                )}
            </div>

            <div className="mt-4 relative h-48 overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="absolute inset-0">
                        {renderMindmapPreview()}
                    </div>
                )}

                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent pointer-events-none" />
            </div>
        </motion.div>
    );
}
