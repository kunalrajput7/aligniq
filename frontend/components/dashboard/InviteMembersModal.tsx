"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Users, Search, Check, Loader2, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Project {
    id: string;
    name: string;
}

interface UserProfile {
    id: string;
    email: string;
    full_name: string | null;
    username: string | null;
}

interface InviteMembersModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    preselectedProjectId?: string;
    preselectedProjectName?: string;
    onSuccess?: () => void; // Callback when collaborators are successfully added
}

export function InviteMembersModal({ isOpen, onClose, userId, preselectedProjectId, preselectedProjectName, onSuccess }: InviteMembersModalProps) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const supabase = createClient();

    // Set preselected project when modal opens
    useEffect(() => {
        if (isOpen && preselectedProjectId && preselectedProjectName) {
            setSelectedProject({ id: preselectedProjectId, name: preselectedProjectName });
        }
    }, [isOpen, preselectedProjectId, preselectedProjectName]);

    // Fetch user's projects (only if no preselected project)
    useEffect(() => {
        if (isOpen && userId && !preselectedProjectId) {
            fetchProjects();
        }
    }, [isOpen, userId, preselectedProjectId]);

    const fetchProjects = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('id, name')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setProjects(data || []);
        } catch (err) {
            console.error('Error fetching projects:', err);
            setError('Failed to load projects');
        } finally {
            setIsLoading(false);
        }
    };

    // Search users with debounce
    const searchUsers = useCallback(async (query: string) => {
        if (!query.trim() || query.length < 2) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, email, full_name, username')
                .or(`email.ilike.%${query}%,username.ilike.%${query}%,full_name.ilike.%${query}%`)
                .neq('id', userId) // Exclude current user
                .limit(10);

            if (error) throw error;

            // Filter out already selected users
            const filtered = (data || []).filter(
                user => !selectedUsers.some(su => su.id === user.id)
            );
            setSearchResults(filtered);
        } catch (err) {
            console.error('Error searching users:', err);
        } finally {
            setIsSearching(false);
        }
    }, [supabase, userId, selectedUsers]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            searchUsers(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, searchUsers]);

    const handleSelectUser = (user: UserProfile) => {
        setSelectedUsers([...selectedUsers, user]);
        setSearchQuery('');
        setSearchResults([]);
    };

    const handleRemoveUser = (userId: string) => {
        setSelectedUsers(selectedUsers.filter(u => u.id !== userId));
    };

    const handleAddCollaborators = async () => {
        if (!selectedProject || selectedUsers.length === 0) return;

        setIsAdding(true);
        setError(null);
        setSuccess(null);

        try {
            // Insert collaborators
            const collaborators = selectedUsers.map(user => ({
                project_id: selectedProject.id,
                user_id: user.id,
                invited_by: userId
            }));

            const { error } = await supabase
                .from('project_collaborators')
                .upsert(collaborators, { onConflict: 'project_id,user_id' });

            if (error) throw error;

            setSuccess(`Added ${selectedUsers.length} collaborator(s) to "${selectedProject.name}"`);
            setSelectedUsers([]);

            // Call success callback to refresh parent data
            onSuccess?.();

            // Auto-close after success
            setTimeout(() => {
                onClose();
                setSuccess(null);
                if (!preselectedProjectId) {
                    setSelectedProject(null);
                }
            }, 1500);
        } catch (err: any) {
            console.error('Error adding collaborators:', err);
            setError(err.message || 'Failed to add collaborators');
        } finally {
            setIsAdding(false);
        }
    };

    const handleClose = () => {
        setSelectedProject(null);
        setSelectedUsers([]);
        setSearchQuery('');
        setSearchResults([]);
        setError(null);
        setSuccess(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-xl w-full max-w-lg shadow-xl"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-indigo-600" />
                        <h3 className="text-lg font-semibold text-slate-900">Invite Members</h3>
                    </div>
                    <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    {/* Description */}
                    <p className="text-slate-600 text-sm">
                        Do you want to invite members on this app to work on a project together?
                    </p>

                    {/* Project Selector - only show if no preselected project */}
                    {!preselectedProjectId ? (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Select Project
                            </label>
                            {isLoading ? (
                                <div className="flex items-center justify-center py-4">
                                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                                </div>
                            ) : (
                                <select
                                    value={selectedProject?.id || ''}
                                    onChange={(e) => {
                                        const project = projects.find(p => p.id === e.target.value);
                                        setSelectedProject(project || null);
                                    }}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                >
                                    <option value="">Choose a project...</option>
                                    {projects.map(project => (
                                        <option key={project.id} value={project.id}>
                                            {project.name}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    ) : (
                        <div className="bg-slate-50 px-3 py-2 rounded-lg">
                            <p className="text-xs text-slate-500">Project</p>
                            <p className="font-medium text-slate-900">{preselectedProjectName}</p>
                        </div>
                    )}

                    {/* User Search - Only show when project is selected */}
                    {selectedProject && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Select members to be added
                                </label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="Search by email or username..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10"
                                    />
                                    {isSearching && (
                                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
                                    )}
                                </div>

                                {/* Search Results Dropdown */}
                                {searchResults.length > 0 && (
                                    <div className="mt-1 border border-slate-200 rounded-lg bg-white shadow-lg max-h-48 overflow-y-auto">
                                        {searchResults.map(user => (
                                            <button
                                                key={user.id}
                                                onClick={() => handleSelectUser(user)}
                                                className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-medium text-sm">
                                                    {(user.full_name || user.email)[0].toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-slate-900 truncate">
                                                        {user.full_name || user.username || 'User'}
                                                    </div>
                                                    <div className="text-xs text-slate-500 truncate">
                                                        {user.email}
                                                    </div>
                                                </div>
                                                <UserPlus className="h-4 w-4 text-slate-400" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Selected Users */}
                            {selectedUsers.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Selected ({selectedUsers.length})
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedUsers.map(user => (
                                            <div
                                                key={user.id}
                                                className="flex items-center gap-1 bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full text-sm"
                                            >
                                                <span>{user.full_name || user.email}</span>
                                                <button
                                                    onClick={() => handleRemoveUser(user.id)}
                                                    className="hover:bg-indigo-200 rounded-full p-0.5"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Error/Success Messages */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                            <Check className="h-4 w-4" />
                            {success}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-2 p-4 border-t border-slate-200">
                    <Button variant="outline" onClick={handleClose} className="flex-1">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleAddCollaborators}
                        disabled={!selectedProject || selectedUsers.length === 0 || isAdding}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        {isAdding ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <>
                                <UserPlus className="h-4 w-4 mr-2" />
                                Add {selectedUsers.length > 0 ? `(${selectedUsers.length})` : ''}
                            </>
                        )}
                    </Button>
                </div>
            </motion.div>
        </div>
    );
}
