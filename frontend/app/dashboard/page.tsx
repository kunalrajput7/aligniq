"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { WelcomeBanner } from '@/components/dashboard/WelcomeBanner';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { MeetingChains } from '@/components/dashboard/MeetingChains';
import { MindmapPreview } from '@/components/dashboard/MindmapPreview';
import { motion } from 'framer-motion';
import { UsernameModal } from '@/components/dashboard/UsernameModal';
import { UserDropdown } from '@/components/dashboard/UserDropdown';
import { UploadModal } from '@/components/dashboard/UploadModal';

export default function DashboardPage() {
    const [session, setSession] = useState<Session | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

    const supabase = createClient();
    const router = useRouter();

    // Fetch Session & Profile
    useEffect(() => {
        const fetchProfile = async (userId: string) => {
            const { data, error } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', userId)
                .single();

            if (data?.username) {
                setUsername(data.username);
            } else {
                setIsUsernameModalOpen(true);
            }
        };

        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session?.user) {
                fetchProfile(session.user.id);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (!session) {
                router.push('/');
            } else {
                fetchProfile(session.user.id);
            }
        });
        return () => subscription.unsubscribe();
    }, [supabase, router]);

    const handleUsernameSet = (newUsername: string) => {
        setUsername(newUsername);
        setIsUsernameModalOpen(false);
    };

    const handleUploadClick = () => {
        setIsUploadModalOpen(true);
    };

    const handleUploadComplete = () => {
        // Optionally refresh data or show notification
    };

    return (
        <div className="flex min-h-screen bg-slate-50/50">
            <Sidebar
                onUploadClick={handleUploadClick}
                className="fixed left-0 top-0 z-40 hidden md:flex h-screen"
            />

            {/* Main Content */}
            <main className="flex-1 transition-all md:ml-64">
                {/* Header */}
                <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-md px-6 sticky top-0 z-30">
                    <h2 className="text-lg font-semibold text-slate-800">Dashboard</h2>
                    <div className="flex items-center gap-4">
                        {session?.user && (
                            <UserDropdown email={session.user.email} />
                        )}
                    </div>
                </header>

                <div className="p-6 md:p-8 max-w-7xl mx-auto">
                    {/* Username Modal */}
                    <UsernameModal
                        userId={session?.user?.id || ''}
                        isOpen={isUsernameModalOpen}
                        onSuccess={handleUsernameSet}
                    />

                    {/* Upload Modal */}
                    <UploadModal
                        isOpen={isUploadModalOpen}
                        onClose={() => setIsUploadModalOpen(false)}
                        userId={session?.user?.id || ''}
                        onUploadComplete={handleUploadComplete}
                    />

                    {/* Overview View */}
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                        <WelcomeBanner
                            userName={username}
                            onUploadClick={handleUploadClick}
                        />

                        <StatsCards userId={session?.user?.id} />

                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-stretch">
                            <ActivityFeed />
                            <div className="lg:col-span-2 flex flex-col gap-6">
                                <MeetingChains />
                                <div className="flex-1">
                                    <MindmapPreview />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
