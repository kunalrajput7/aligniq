"use client";

import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { createClient } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Folder, FileText, Plus, Loader2, ChevronLeft, Upload, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadAndSummarize } from '@/lib/api';

interface Project {
    id: string;
    name: string;
    created_at: string;
}

interface UploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    onUploadComplete?: () => void;
    preselectedProjectId?: string; // When set, skip step selection and upload directly to this project
}

type UploadStep = 'choose' | 'project-select' | 'uploading' | 'complete';

export function UploadModal({ isOpen, onClose, userId, onUploadComplete, preselectedProjectId }: UploadModalProps) {
    const [step, setStep] = useState<UploadStep>('choose');
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [isLoadingProjects, setIsLoadingProjects] = useState(false);
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [uploadType, setUploadType] = useState<'project' | 'direct' | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadMessage, setUploadMessage] = useState('');
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();

    // When modal opens with preselectedProjectId, trigger file upload directly
    useEffect(() => {
        if (isOpen && preselectedProjectId) {
            setSelectedProjectId(preselectedProjectId);
            setUploadType('project');
            // Small delay to ensure refs are ready
            setTimeout(() => {
                fileInputRef.current?.click();
            }, 100);
        }
    }, [isOpen, preselectedProjectId]);

    // Fetch projects when modal opens and project type is selected
    useEffect(() => {
        if (isOpen && step === 'project-select') {
            fetchProjects();
        }
    }, [isOpen, step]);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setTimeout(() => {
                setStep('choose');
                setSelectedProjectId(null);
                setUploadType(null);
                setNewProjectName('');
                setError(null);
                setUploadMessage('');
            }, 300);
        }
    }, [isOpen]);

    const fetchProjects = async () => {
        setIsLoadingProjects(true);
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setProjects(data || []);
        } catch (err) {
            console.error('Error fetching projects:', err);
        } finally {
            setIsLoadingProjects(false);
        }
    };

    const handleCreateProject = async () => {
        if (!newProjectName.trim()) return;

        setIsCreatingProject(true);
        try {
            const { data, error } = await supabase
                .from('projects')
                .insert({ user_id: userId, name: newProjectName.trim() })
                .select()
                .single();

            if (error) throw error;

            // Add to list and select it
            setProjects([data, ...projects]);
            setSelectedProjectId(data.id);
            setNewProjectName('');
        } catch (err: any) {
            setError(err.message || 'Failed to create project');
        } finally {
            setIsCreatingProject(false);
        }
    };

    const handleChooseType = (type: 'project' | 'direct') => {
        setUploadType(type);
        if (type === 'project') {
            setStep('project-select');
        } else {
            // Direct meeting - trigger file upload immediately
            fileInputRef.current?.click();
        }
    };

    const handleProjectConfirm = () => {
        if (selectedProjectId) {
            fileInputRef.current?.click();
        }
    };

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.vtt')) {
            setError('Please upload a .vtt transcript file');
            return;
        }

        setStep('uploading');
        setIsUploading(true);
        setError(null);

        try {
            const result = await uploadAndSummarize(file, {
                userId,
                projectId: selectedProjectId || undefined
            });

            // Always show complete - the backend processes in background
            setStep('complete');
            setUploadMessage(
                uploadType === 'project'
                    ? 'Meeting uploaded! It\'s being processed in this project. Check the Projects section to see the status.'
                    : 'Meeting uploaded! It\'s being processed. Check the Meetings section to see when it\'s ready.'
            );

            onUploadComplete?.();
        } catch (err: any) {
            // Only show error for actual failures, not timeouts
            console.error('Upload error:', err);
            setError(err.message || 'Upload failed. Please try again.');
            setStep('choose');
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    const handleBack = () => {
        if (step === 'project-select') {
            setStep('choose');
            setSelectedProjectId(null);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".vtt"
                    className="hidden"
                    onChange={handleFileChange}
                />

                <AnimatePresence mode="wait">
                    {/* Step 1: Choose Upload Type */}
                    {step === 'choose' && (
                        <motion.div
                            key="choose"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                        >
                            <DialogHeader>
                                <DialogTitle>Upload Meeting Transcript</DialogTitle>
                                <DialogDescription>
                                    Choose how you want to organize this meeting
                                </DialogDescription>
                            </DialogHeader>

                            <div className="grid grid-cols-2 gap-4 mt-6">
                                <button
                                    onClick={() => handleChooseType('project')}
                                    className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 transition-all group"
                                >
                                    <div className="p-3 rounded-full bg-amber-100 text-amber-600 group-hover:bg-amber-200 transition-colors">
                                        <Folder className="h-6 w-6" />
                                    </div>
                                    <div className="text-center">
                                        <p className="font-semibold text-slate-900">Project Series</p>
                                        <p className="text-xs text-slate-500 mt-1">Add to a project</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handleChooseType('direct')}
                                    className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
                                >
                                    <div className="p-3 rounded-full bg-blue-100 text-blue-600 group-hover:bg-blue-200 transition-colors">
                                        <FileText className="h-6 w-6" />
                                    </div>
                                    <div className="text-center">
                                        <p className="font-semibold text-slate-900">Direct Meeting</p>
                                        <p className="text-xs text-slate-500 mt-1">Standalone upload</p>
                                    </div>
                                </button>
                            </div>

                            {error && (
                                <p className="text-sm text-red-500 mt-4 text-center">{error}</p>
                            )}
                        </motion.div>
                    )}

                    {/* Step 2: Select Project */}
                    {step === 'project-select' && (
                        <motion.div
                            key="project-select"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <DialogHeader>
                                <div className="flex items-center gap-2">
                                    <button onClick={handleBack} className="p-1 hover:bg-slate-100 rounded">
                                        <ChevronLeft className="h-5 w-5" />
                                    </button>
                                    <DialogTitle>Select Project</DialogTitle>
                                </div>
                                <DialogDescription>
                                    Choose a project or create a new one
                                </DialogDescription>
                            </DialogHeader>

                            {/* Create New Project */}
                            <div className="flex gap-2 mt-4">
                                <Input
                                    placeholder="New project name..."
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                                />
                                <Button
                                    onClick={handleCreateProject}
                                    disabled={!newProjectName.trim() || isCreatingProject}
                                    size="icon"
                                >
                                    {isCreatingProject ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Plus className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>

                            {/* Project List */}
                            <div className="mt-4 max-h-60 overflow-y-auto space-y-2">
                                {isLoadingProjects ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                                    </div>
                                ) : projects.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500">
                                        <Folder className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                                        <p>No projects yet</p>
                                        <p className="text-sm">Create one above</p>
                                    </div>
                                ) : (
                                    projects.map((project) => (
                                        <button
                                            key={project.id}
                                            onClick={() => setSelectedProjectId(project.id)}
                                            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${selectedProjectId === project.id
                                                ? 'border-amber-400 bg-amber-50'
                                                : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                        >
                                            <Folder className={`h-5 w-5 ${selectedProjectId === project.id ? 'text-amber-500' : 'text-slate-400'
                                                }`} />
                                            <span className="font-medium text-slate-700">{project.name}</span>
                                        </button>
                                    ))
                                )}
                            </div>

                            {/* Confirm Button */}
                            <Button
                                onClick={handleProjectConfirm}
                                disabled={!selectedProjectId}
                                className="w-full mt-4"
                            >
                                <Upload className="h-4 w-4 mr-2" />
                                Upload to Project
                            </Button>

                            {error && (
                                <p className="text-sm text-red-500 mt-2 text-center">{error}</p>
                            )}
                        </motion.div>
                    )}

                    {/* Step 3: Uploading */}
                    {step === 'uploading' && (
                        <motion.div
                            key="uploading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="py-8 text-center"
                        >
                            <Loader2 className="h-12 w-12 animate-spin text-amber-500 mx-auto mb-4" />
                            <p className="text-lg font-semibold text-slate-900">Processing Meeting...</p>
                            <p className="text-sm text-slate-500 mt-2">This may take a minute</p>
                        </motion.div>
                    )}

                    {/* Step 4: Complete */}
                    {step === 'complete' && (
                        <motion.div
                            key="complete"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="py-8 text-center"
                        >
                            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                            <p className="text-lg font-semibold text-slate-900">Upload Complete!</p>
                            <p className="text-sm text-slate-500 mt-2 px-4">{uploadMessage}</p>
                            <Button onClick={onClose} className="mt-6">
                                Done
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    );
}
