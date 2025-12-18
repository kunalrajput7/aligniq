"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { UserDropdown } from '@/components/dashboard/UserDropdown';
import { UploadModal } from '@/components/dashboard/UploadModal';
import { InviteMembersModal } from '@/components/dashboard/InviteMembersModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Folder, Users, Calendar, Loader2, Sparkles, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface Project {
    id: string;
    name: string;
    status: string;
    deadline: string | null;
    created_at: string;
    user_id: string;
    meetings_count?: number;
    tasks_count?: number;
    tasks_done?: number;
    isShared?: boolean;
    hasCollaborators?: boolean;
    collaborators_count?: number;
}

export default function ProjectsPage() {
    const [session, setSession] = useState<Session | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session?.user) {
                fetchProjects(session.user.id);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (!session) {
                router.push('/');
            }
        });
        return () => subscription.unsubscribe();
    }, [supabase, router]);

    const fetchProjects = async (userId: string) => {
        setIsLoading(true);
        try {
            // Fetch owned projects
            const { data: ownedProjects, error: ownedError } = await supabase
                .from('projects')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (ownedError) throw ownedError;

            // Fetch shared projects (where user is a collaborator)
            const { data: sharedProjectIds, error: collabError } = await supabase
                .from('project_collaborators')
                .select('project_id')
                .eq('user_id', userId);

            if (collabError) throw collabError;

            let sharedProjects: any[] = [];
            if (sharedProjectIds && sharedProjectIds.length > 0) {
                const projectIds = sharedProjectIds.map(p => p.project_id);
                const { data: shared, error: sharedError } = await supabase
                    .from('projects')
                    .select('*')
                    .in('id', projectIds)
                    .order('created_at', { ascending: false });

                if (sharedError) throw sharedError;
                sharedProjects = shared || [];
            }

            // Combine and dedupe (owned + shared)
            const allProjects = [...(ownedProjects || []), ...sharedProjects];
            const uniqueProjects = allProjects.filter((project, index, self) =>
                index === self.findIndex(p => p.id === project.id)
            );

            // Fetch meeting counts and collaborator counts for each project
            const projectsWithCounts = await Promise.all(uniqueProjects.map(async (project) => {
                const { count: meetingsCount } = await supabase
                    .from('meetings')
                    .select('*', { count: 'exact', head: true })
                    .eq('project_id', project.id);

                const { count: collabCount } = await supabase
                    .from('project_collaborators')
                    .select('*', { count: 'exact', head: true })
                    .eq('project_id', project.id);

                return {
                    ...project,
                    meetings_count: meetingsCount || 0,
                    tasks_count: 0,
                    tasks_done: 0,
                    isShared: project.user_id !== userId,
                    hasCollaborators: (collabCount || 0) > 0,
                    collaborators_count: collabCount || 0
                };
            }));

            setProjects(projectsWithCounts);
        } catch (err) {
            console.error('Error fetching projects:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateProject = async () => {
        if (!newProjectName.trim() || !session?.user) return;

        setIsCreating(true);
        try {
            const { data, error } = await supabase
                .from('projects')
                .insert({ user_id: session.user.id, name: newProjectName.trim() })
                .select()
                .single();

            if (error) throw error;

            setProjects([{ ...data, meetings_count: 0 }, ...projects]);
            setNewProjectName('');
            setIsCreateModalOpen(false);
        } catch (err) {
            console.error('Error creating project:', err);
        } finally {
            setIsCreating(false);
        }
    };

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
                    <h2 className="text-lg font-semibold text-slate-800">Projects</h2>
                    <div className="flex items-center gap-4">
                        {session?.user && <UserDropdown email={session.user.email} />}
                    </div>
                </header>

                <div className="p-6 md:p-8 max-w-7xl mx-auto">
                    {/* Upload Modal */}
                    <UploadModal
                        isOpen={isUploadModalOpen}
                        onClose={() => setIsUploadModalOpen(false)}
                        userId={session?.user?.id || ''}
                        onUploadComplete={() => session?.user && fetchProjects(session.user.id)}
                    />

                    {/* Invite Members Modal */}
                    <InviteMembersModal
                        isOpen={isInviteModalOpen}
                        onClose={() => setIsInviteModalOpen(false)}
                        userId={session?.user?.id || ''}
                    />

                    {/* Search Bar */}
                    <div className="mb-6 flex gap-4 items-center">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search projects..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={() => setIsInviteModalOpen(true)}
                                variant="outline"
                                className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                            >
                                <UserPlus className="h-4 w-4 mr-2" />
                                Invite Members
                            </Button>
                            <Button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                New Project
                            </Button>
                        </div>
                    </div>

                    {/* Projects Grid */}
                    {isLoading ? (
                        <div className="flex justify-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                        </div>
                    ) : filteredProjects.length === 0 ? (
                        <div className="text-center py-16">
                            <Folder className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                            <h3 className="text-lg font-semibold text-slate-700">No projects yet</h3>
                            <p className="text-slate-500 mt-1">Create your first project to organize your meetings</p>
                            <Button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="mt-4"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Create Project
                            </Button>
                        </div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        >
                            {filteredProjects.map((project) => (
                                <motion.div
                                    key={project.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-shadow"
                                >
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <h3 className="font-semibold text-slate-900 truncate">{project.name}</h3>
                                            {(project.hasCollaborators || project.isShared) && (
                                                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 flex items-center gap-1 shrink-0">
                                                    <Users className="h-3 w-3" />
                                                    Shared
                                                </span>
                                            )}
                                        </div>
                                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 ml-2 shrink-0">
                                            {project.status === 'active' ? 'In Progress' : project.status}
                                        </span>
                                    </div>

                                    {/* Stats */}
                                    <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                                        <div>
                                            <p className="text-slate-500">Meetings</p>
                                            <p className="font-semibold text-slate-900">{project.meetings_count || 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500">Status</p>
                                            <p className="font-semibold text-slate-900">
                                                {(project.hasCollaborators || project.isShared) ? 'Shared' : 'Private'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500">Members</p>
                                            <p className="font-semibold text-slate-900">
                                                {1 + (project.collaborators_count || 0)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* AI Insight */}
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                                        <div className="flex items-center gap-2 text-amber-700 text-sm">
                                            <Sparkles className="h-4 w-4" />
                                            <span className="font-medium">Summer AI Insight</span>
                                        </div>
                                        <p className="text-sm text-amber-600 mt-1">
                                            {(project.meetings_count ?? 0) > 0
                                                ? `${project.meetings_count} meetings analyzed`
                                                : 'Upload meetings to get insights'}
                                        </p>
                                    </div>

                                    {/* View Button */}
                                    <Link href={`/dashboard/projects/${project.id}`}>
                                        <Button variant="outline" className="w-full">
                                            View Project
                                        </Button>
                                    </Link>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}

                    {/* Create Project Modal */}
                    {isCreateModalOpen && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-white rounded-xl p-6 w-full max-w-md mx-4"
                            >
                                <h3 className="text-lg font-semibold text-slate-900 mb-4">Create New Project</h3>
                                <Input
                                    placeholder="Project name..."
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                                    autoFocus
                                />
                                <div className="flex gap-2 mt-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => setIsCreateModalOpen(false)}
                                        className="flex-1"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleCreateProject}
                                        disabled={!newProjectName.trim() || isCreating}
                                        className="flex-1"
                                    >
                                        {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                                    </Button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
