"use client";

import { useEffect, useState } from 'react';
import { motion } from "framer-motion";
import { Users, ListTodo, Network, Clock, ExternalLink, Calendar, Share2 } from "lucide-react";
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';

interface TodayMeeting {
    id: string;
    title: string;
    created_at: string;
    participants: string[];
    status: string;
    taskCount: number;
    hasMindmap: boolean;
    isSharing?: boolean;
    sharingDetails?: {
        projectName: string;
        sharedBy?: string;
        sharedWith?: string[];
    };
}

export function ActivityFeed() {
    const [meetings, setMeetings] = useState<TodayMeeting[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const fetchRecentMeetings = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user) {
                    setIsLoading(false);
                    return;
                }

                const userId = session.user.id;

                // Get start of 3 days ago (UTC)
                const threeDaysAgo = new Date();
                threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
                threeDaysAgo.setHours(0, 0, 0, 0);
                const threeDaysAgoISO = threeDaysAgo.toISOString();

                // Fetch owned meetings from past 3 days
                const { data: ownedMeetings, error: ownedError } = await supabase
                    .from('meetings')
                    .select('id, title, created_at, participants, status')
                    .eq('user_id', userId)
                    .gte('created_at', threeDaysAgoISO)
                    .order('created_at', { ascending: false });

                if (ownedError) {
                    console.error('Error fetching owned meetings:', ownedError);
                }

                // Fetch shared project IDs
                const { data: sharedProjects } = await supabase
                    .from('project_collaborators')
                    .select('project_id')
                    .eq('user_id', userId);

                let sharedMeetings: any[] = [];
                if (sharedProjects && sharedProjects.length > 0) {
                    const projectIds = sharedProjects.map(p => p.project_id);
                    const { data: shared } = await supabase
                        .from('meetings')
                        .select('id, title, created_at, participants, status')
                        .in('project_id', projectIds)
                        .gte('created_at', threeDaysAgoISO)
                        .order('created_at', { ascending: false });
                    sharedMeetings = shared || [];
                }

                // Fetch sharing activities (invitations received)
                const { data: invitesReceived } = await supabase
                    .from('project_collaborators')
                    .select(`
                        project_id,
                        invited_at,
                        invited_by,
                        projects:project_id(name),
                        inviter:invited_by(username, email)
                    `)
                    .eq('user_id', userId)
                    .gte('invited_at', threeDaysAgoISO)
                    .order('invited_at', { ascending: false });

                // Fetch sharing activities (invitations sent by current user)
                const { data: invitesSent } = await supabase
                    .from('project_collaborators')
                    .select(`
                        project_id,
                        invited_at,
                        user_id,
                        projects:project_id(name),
                        invitee:user_id(username, email)
                    `)
                    .eq('invited_by', userId)
                    .gte('invited_at', threeDaysAgoISO)
                    .order('invited_at', { ascending: false });

                // Combine all meetings
                const allMeetings = [...(ownedMeetings || []), ...sharedMeetings];
                const uniqueMeetings = allMeetings.filter((meeting, index, self) =>
                    index === self.findIndex(m => m.id === meeting.id)
                );

                // For each meeting, get task count and mindmap status
                const enrichedMeetings: TodayMeeting[] = await Promise.all(
                    uniqueMeetings.map(async (meeting) => {
                        let taskCount = 0;
                        let hasMindmap = false;

                        if (meeting.status === 'completed') {
                            const { data: summary } = await supabase
                                .from('meeting_summaries')
                                .select('summary_json, mindmap_json')
                                .eq('meeting_id', meeting.id)
                                .single();

                            if (summary) {
                                taskCount = summary.summary_json?.action_items?.length || 0;
                                hasMindmap = !!summary.mindmap_json?.nodes?.length;
                            }
                        }

                        return {
                            id: meeting.id,
                            title: meeting.title || 'Untitled Meeting',
                            created_at: meeting.created_at,
                            participants: meeting.participants || [],
                            status: meeting.status,
                            taskCount,
                            hasMindmap,
                        };
                    })
                );

                // Add sharing activity items for invites received
                const sharingReceivedItems: TodayMeeting[] = (invitesReceived || []).map((invite: any) => ({
                    id: `share-received-${invite.project_id}`,
                    title: `Invited to "${invite.projects?.name || 'Project'}"`,
                    created_at: invite.invited_at,
                    participants: [],
                    status: 'sharing',
                    taskCount: 0,
                    hasMindmap: false,
                    isSharing: true,
                    sharingDetails: {
                        projectName: invite.projects?.name || 'Project',
                        sharedBy: invite.inviter?.username || invite.inviter?.email || 'Someone',
                    },
                }));

                // Add sharing activity items for invites sent
                const sharingSentItems: TodayMeeting[] = (invitesSent || []).map((invite: any) => ({
                    id: `share-sent-${invite.project_id}-${invite.user_id}`,
                    title: `Shared "${invite.projects?.name || 'Project'}"`,
                    created_at: invite.invited_at,
                    participants: [],
                    status: 'sharing',
                    taskCount: 0,
                    hasMindmap: false,
                    isSharing: true,
                    sharingDetails: {
                        projectName: invite.projects?.name || 'Project',
                        sharedWith: [invite.invitee?.username || invite.invitee?.email || 'User'],
                    },
                }));

                // Combine all activities and sort by date
                const allActivities = [...enrichedMeetings, ...sharingReceivedItems, ...sharingSentItems];
                allActivities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                setMeetings(allActivities);
            } catch (err) {
                console.error('Error in fetchRecentMeetings:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchRecentMeetings();

        // Real-time subscription for meetings and collaboration changes
        const channel = supabase
            .channel('activity_feed_realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'meetings' },
                () => fetchRecentMeetings()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'project_collaborators' },
                () => fetchRecentMeetings()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase]);

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    const getTimeAgo = (dateStr: string) => {
        const now = new Date();
        const date = new Date(dateStr);
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        // Format date as "Dec 15"
        const dateFormat = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const timeFormat = formatTime(dateStr);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `Today at ${timeFormat}`;
        if (diffDays === 1) return `Yesterday at ${timeFormat}`;
        return `${dateFormat} at ${timeFormat}`;
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-slate-100 bg-white pt-6 px-5 pb-4 shadow-sm flex flex-col max-h-[500px]"
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-indigo-500" />
                    Recent Activity
                </h3>
                <span className="text-xs text-slate-400">
                    Past 3 days
                </span>
            </div>

            {/* Scrollable container - fills remaining space */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 min-h-0">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : meetings.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                        <Image
                            src="/logo.jpg"
                            alt="Logo"
                            width={40}
                            height={40}
                            className="mx-auto mb-3 rounded-lg opacity-50"
                        />
                        <p className="text-sm">No meetings processed today</p>
                        <p className="text-xs mt-1">Upload a transcript to get started</p>
                    </div>
                ) : (
                    meetings.map((meeting, index) => (
                        <motion.div
                            key={meeting.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="relative pl-6"
                        >
                            {/* Timeline line */}
                            {index < meetings.length - 1 && (
                                <div className="absolute bottom-0 left-[11px] top-6 w-[2px] bg-slate-100" />
                            )}

                            <div className="flex gap-3">
                                {/* Icon - different for sharing vs meeting */}
                                <div className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full overflow-hidden ring-4 ring-white ${meeting.isSharing ? 'bg-blue-500' : 'bg-white'}`}>
                                    {meeting.isSharing ? (
                                        <Share2 className="h-3.5 w-3.5 text-white" />
                                    ) : (
                                        <Image
                                            src="/logo.jpg"
                                            alt="Logo"
                                            width={24}
                                            height={24}
                                            className="object-cover"
                                        />
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    {/* Time badge */}
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {getTimeAgo(meeting.created_at)}
                                        </span>
                                        {meeting.status === 'processing' && (
                                            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                                                Processing...
                                            </span>
                                        )}
                                        {meeting.isSharing && (
                                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                                Collaboration
                                            </span>
                                        )}
                                    </div>

                                    {/* Title */}
                                    <p className="text-sm font-semibold text-slate-900 truncate">
                                        {meeting.title}
                                    </p>

                                    {/* Sharing details */}
                                    {meeting.isSharing && meeting.sharingDetails && (
                                        <p className="text-xs text-slate-500 mt-1">
                                            {meeting.sharingDetails.sharedBy && (
                                                <span>{meeting.sharingDetails.sharedBy} shared this project with you</span>
                                            )}
                                            {meeting.sharingDetails.sharedWith && (
                                                <span>Shared with {meeting.sharingDetails.sharedWith.join(', ')}</span>
                                            )}
                                        </p>
                                    )}

                                    {/* Meeting stats - only show for meetings */}
                                    {!meeting.isSharing && (
                                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                            {meeting.participants.length > 0 && (
                                                <span className="flex items-center gap-1">
                                                    <Users className="h-3 w-3 text-blue-400" />
                                                    {meeting.participants.length} participants
                                                </span>
                                            )}
                                            {meeting.taskCount > 0 && (
                                                <span className="flex items-center gap-1">
                                                    <ListTodo className="h-3 w-3 text-green-500" />
                                                    {meeting.taskCount} tasks
                                                </span>
                                            )}
                                            {meeting.hasMindmap && (
                                                <span className="flex items-center gap-1">
                                                    <Network className="h-3 w-3 text-purple-500" />
                                                    Mindmap
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* View Summary link */}
                                    {meeting.status === 'completed' && (
                                        <Link
                                            href={`/dashboard/meetings/${meeting.id}`}
                                            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                                        >
                                            View Summary
                                            <ExternalLink className="h-3 w-3" />
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </motion.div>
    );
}
