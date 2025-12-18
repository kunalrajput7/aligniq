"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { useRouter, useParams } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { UserDropdown } from '@/components/dashboard/UserDropdown';
import { UploadModal } from '@/components/dashboard/UploadModal';
import { InviteMembersModal } from '@/components/dashboard/InviteMembersModal';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, Clock, Users, FileText, Brain, Loader2, Upload, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface Meeting {
    id: string;
    title: string;
    date: string;
    duration_ms: number;
    participants: string[];
    status: string;
    created_at: string;
}

interface Project {
    id: string;
    name: string;
    status: string;
    user_id: string;
}

interface Member {
    id: string;
    email: string;
    full_name: string | null;
    username: string | null;
    isOwner?: boolean;
}

export default function ProjectDetailPage() {
    const params = useParams();
    const projectId = params.id as string;

    const [session, setSession] = useState<Session | null>(null);
    const [project, setProject] = useState<Project | null>(null);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [owner, setOwner] = useState<Member | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session?.user) {
                fetchProjectAndMeetings();
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (!session) {
                router.push('/');
            }
        });
        return () => subscription.unsubscribe();
    }, [supabase, router, projectId]);

    // Real-time subscription for meetings in this project
    useEffect(() => {
        if (!projectId) return;

        const channel = supabase
            .channel(`project_meetings_${projectId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'meetings',
                    filter: `project_id=eq.${projectId}`
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setMeetings(prev => [payload.new as Meeting, ...prev]);
                    } else if (payload.eventType === 'UPDATE') {
                        setMeetings(prev =>
                            prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m)
                        );
                    } else if (payload.eventType === 'DELETE') {
                        setMeetings(prev => prev.filter(m => m.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, projectId]);

    // Real-time subscription for collaborators in this project
    useEffect(() => {
        if (!projectId) return;

        const channel = supabase
            .channel(`project_collaborators_${projectId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'project_collaborators',
                    filter: `project_id=eq.${projectId}`
                },
                () => {
                    // Refetch members when collaborators change
                    fetchMembers();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, projectId]);

    const fetchProjectAndMeetings = async () => {
        setIsLoading(true);
        try {
            // Fetch project
            const { data: projectData, error: projectError } = await supabase
                .from('projects')
                .select('*')
                .eq('id', projectId)
                .single();

            if (projectError) throw projectError;
            setProject(projectData);

            // Fetch owner profile
            if (projectData?.user_id) {
                const { data: ownerData } = await supabase
                    .from('profiles')
                    .select('id, email, full_name, username')
                    .eq('id', projectData.user_id)
                    .single();

                if (ownerData) {
                    setOwner({ ...ownerData, isOwner: true });
                }
            }

            // Fetch collaborators
            const { data: collabData } = await supabase
                .from('project_collaborators')
                .select('user_id')
                .eq('project_id', projectId);

            if (collabData && collabData.length > 0) {
                const userIds = collabData.map(c => c.user_id);
                const { data: memberProfiles } = await supabase
                    .from('profiles')
                    .select('id, email, full_name, username')
                    .in('id', userIds);

                if (memberProfiles) {
                    setMembers(memberProfiles);
                }
            }

            // Fetch meetings for this project
            const { data: meetingsData, error: meetingsError } = await supabase
                .from('meetings')
                .select('*')
                .eq('project_id', projectId)
                .order('created_at', { ascending: false });

            if (meetingsError) throw meetingsError;
            setMeetings(meetingsData || []);
        } catch (err) {
            console.error('Error fetching project:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Separate function to fetch members (for real-time updates)
    const fetchMembers = async () => {
        try {
            const { data: collabData } = await supabase
                .from('project_collaborators')
                .select('user_id')
                .eq('project_id', projectId);

            if (collabData && collabData.length > 0) {
                const userIds = collabData.map(c => c.user_id);
                const { data: memberProfiles } = await supabase
                    .from('profiles')
                    .select('id, email, full_name, username')
                    .in('id', userIds);

                if (memberProfiles) {
                    setMembers(memberProfiles);
                }
            } else {
                setMembers([]);
            }
        } catch (err) {
            console.error('Error fetching members:', err);
        }
    };

    const formatDuration = (ms: number) => {
        const minutes = Math.floor(ms / 60000);
        return `${minutes} min`;
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    return (
        <div className="flex min-h-screen bg-slate-50/50">
            <Sidebar
                onUploadClick={() => setIsUploadModalOpen(true)}
                className="fixed left-0 top-0 z-40 hidden md:flex h-screen"
            />

            <main className="flex-1 transition-all md:ml-64">
                {/* Header */}
                <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-md px-6 sticky top-0 z-30">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard/projects">
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <h2 className="text-lg font-semibold text-slate-800">
                            {project?.name || 'Project'}
                        </h2>
                        {project && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                                {project.status === 'active' ? 'In Progress' : project.status}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {session?.user && <UserDropdown email={session.user.email} />}
                    </div>
                </header>

                <div className="p-6 md:p-8 max-w-7xl mx-auto">
                    {/* Upload Modal - preselected to this project */}
                    <UploadModal
                        isOpen={isUploadModalOpen}
                        onClose={() => setIsUploadModalOpen(false)}
                        userId={session?.user?.id || ''}
                        onUploadComplete={fetchProjectAndMeetings}
                        preselectedProjectId={projectId}
                    />

                    {/* Invite Members Modal - preselected to this project */}
                    <InviteMembersModal
                        isOpen={isInviteModalOpen}
                        onClose={() => setIsInviteModalOpen(false)}
                        userId={session?.user?.id || ''}
                        preselectedProjectId={projectId}
                        preselectedProjectName={project?.name}
                        onSuccess={fetchMembers}
                    />

                    {isLoading ? (
                        <div className="flex justify-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                        </div>
                    ) : (
                        <div className="flex flex-col lg:flex-row gap-6">
                            {/* Main Content - Meetings */}
                            <div className="flex-1">
                                {meetings.length === 0 ? (
                                    <div className="text-center py-16">
                                        <Calendar className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                                        <h3 className="text-lg font-semibold text-slate-700">No meetings yet</h3>
                                        <p className="text-slate-500 mt-1">Upload a meeting transcript to get started</p>
                                        <Button
                                            onClick={() => setIsUploadModalOpen(true)}
                                            className="mt-4"
                                        >
                                            Upload Meeting
                                        </Button>
                                    </div>
                                ) : (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="space-y-4"
                                    >
                                        {meetings.map((meeting) => (
                                            <motion.div
                                                key={meeting.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow"
                                            >
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                    {/* Left side - Meeting info */}
                                                    <div className="flex-1">
                                                        <h3 className="font-semibold text-slate-900 text-lg">
                                                            {meeting.title || 'Untitled Meeting'}
                                                        </h3>
                                                        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-500">
                                                            <span className="flex items-center gap-1">
                                                                <Calendar className="h-4 w-4" />
                                                                {formatDate(meeting.date || meeting.created_at)}
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="h-4 w-4" />
                                                                {formatTime(meeting.date || meeting.created_at)}
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="h-4 w-4" />
                                                                {formatDuration(meeting.duration_ms || 0)}
                                                            </span>
                                                        </div>
                                                        {/* Participants */}
                                                        {meeting.participants && meeting.participants.length > 0 && (
                                                            <div className="flex items-center gap-2 mt-3">
                                                                <div className="flex -space-x-2">
                                                                    {meeting.participants.slice(0, 4).map((p, i) => (
                                                                        <div
                                                                            key={i}
                                                                            className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 border-2 border-white flex items-center justify-center text-xs font-bold text-white"
                                                                        >
                                                                            {p.charAt(0).toUpperCase()}
                                                                        </div>
                                                                    ))}
                                                                    {meeting.participants.length > 4 && (
                                                                        <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-xs font-bold text-slate-600">
                                                                            +{meeting.participants.length - 4}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Right side - Actions */}
                                                    <div className="flex items-center gap-2">
                                                        {meeting.status === 'completed' ? (
                                                            <>
                                                                <Link href={`/dashboard/meetings/${meeting.id}`}>
                                                                    <Button variant="outline" size="sm">
                                                                        <FileText className="h-4 w-4 mr-2" />
                                                                        View Summary
                                                                    </Button>
                                                                </Link>
                                                                <Link href={`/dashboard/meetings/${meeting.id}?tab=mindmap`}>
                                                                    <Button variant="outline" size="sm">
                                                                        <Brain className="h-4 w-4 mr-2" />
                                                                        See Auto-Mindmap
                                                                    </Button>
                                                                </Link>
                                                            </>
                                                        ) : (
                                                            <span className="px-3 py-1 text-sm font-medium rounded-full bg-amber-100 text-amber-700">
                                                                {meeting.status === 'processing' ? 'Processing...' : meeting.status}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </motion.div>
                                )}
                            </div>

                            {/* Right Sidebar - Always visible */}
                            <div className="lg:w-80 shrink-0">
                                <div className="bg-white rounded-xl border border-slate-200 p-5 sticky top-20 space-y-4">
                                    {/* Action Buttons */}
                                    <div className="space-y-2">
                                        <Button
                                            onClick={() => setIsUploadModalOpen(true)}
                                            className="w-full"
                                        >
                                            <Upload className="h-4 w-4 mr-2" />
                                            Upload Meeting
                                        </Button>
                                        {project?.user_id === session?.user?.id && (
                                            <Button
                                                onClick={() => setIsInviteModalOpen(true)}
                                                variant="outline"
                                                className="w-full"
                                            >
                                                <UserPlus className="h-4 w-4 mr-2" />
                                                Invite Members
                                            </Button>
                                        )}
                                    </div>

                                    {/* Divider */}
                                    <div className="border-t border-slate-200" />

                                    {/* Team Members */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <Users className="h-5 w-5 text-indigo-600" />
                                            <h3 className="font-semibold text-slate-900">Team Members</h3>
                                        </div>

                                        {/* Owner */}
                                        {owner && (
                                            <div className="mb-3">
                                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Owner</p>
                                                <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                                                        {(owner.full_name || owner.email)[0].toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-slate-900 truncate flex items-center gap-2">
                                                            {owner.full_name || owner.username || 'User'}
                                                            {owner.id === session?.user?.id && (
                                                                <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">You</span>
                                                            )}
                                                        </p>
                                                        <p className="text-xs text-slate-500 truncate">{owner.email}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Collaborators */}
                                        {members.length > 0 && (
                                            <div>
                                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                                                    Members ({members.length})
                                                </p>
                                                <div className="space-y-2">
                                                    {members.map((member) => (
                                                        <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-semibold">
                                                                {(member.full_name || member.email)[0].toUpperCase()}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-medium text-slate-900 truncate flex items-center gap-2">
                                                                    {member.full_name || member.username || 'User'}
                                                                    {member.id === session?.user?.id && (
                                                                        <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">You</span>
                                                                    )}
                                                                </p>
                                                                <p className="text-xs text-slate-500 truncate">{member.email}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* No collaborators message */}
                                        {members.length === 0 && (
                                            <p className="text-sm text-slate-500">
                                                No collaborators yet. {project?.user_id === session?.user?.id && 'Invite team members to share this project.'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
