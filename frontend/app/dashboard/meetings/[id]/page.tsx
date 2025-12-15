"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { UserDropdown } from '@/components/dashboard/UserDropdown';
import { UploadModal } from '@/components/dashboard/UploadModal';
import { MeetingDashboard } from '@/components/MeetingDashboard';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Calendar, Clock, Users, FileDown } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import jsPDF from 'jspdf';
import { PipelineResponse, HAT_DESCRIPTIONS } from '@/types/api';

interface Meeting {
    id: string;
    title: string;
    date: string;
    duration_ms: number;
    participants: string[];
    status: string;
    created_at: string;
    project_id: string | null;
    timeline_json: any;
}

interface MeetingSummary {
    meeting_id: string;
    summary_json: any;
    mindmap_json: any;
    chapters_json: any;
    hats_json: any;
}

export default function MeetingDetailPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const meetingId = params.id as string;
    const defaultTab = searchParams.get('tab') || 'summary';

    const [session, setSession] = useState<Session | null>(null);
    const [meeting, setMeeting] = useState<Meeting | null>(null);
    const [summary, setSummary] = useState<MeetingSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session?.user) {
                fetchMeetingAndSummary();
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (!session) {
                router.push('/');
            }
        });
        return () => subscription.unsubscribe();
    }, [supabase, router, meetingId]);

    // Subscribe to real-time changes for this meeting
    useEffect(() => {
        if (!session?.user || !meetingId) return;

        const channel = supabase
            .channel(`meeting_${meetingId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'meetings',
                    filter: `id=eq.${meetingId}`
                },
                (payload) => {
                    setMeeting(prev => prev ? { ...prev, ...payload.new } : null);
                    // Refetch summary when meeting is updated
                    if (payload.new.status === 'completed') {
                        fetchSummary();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, session?.user, meetingId]);

    const fetchMeetingAndSummary = async () => {
        setIsLoading(true);
        try {
            // Fetch meeting
            const { data: meetingData, error: meetingError } = await supabase
                .from('meetings')
                .select('*')
                .eq('id', meetingId)
                .single();

            if (meetingError) throw meetingError;
            setMeeting(meetingData);

            // Fetch summary if meeting is completed
            if (meetingData.status === 'completed') {
                await fetchSummary();
            }
        } catch (err) {
            console.error('Error fetching meeting:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSummary = async () => {
        try {
            const { data: summaryData, error: summaryError } = await supabase
                .from('meeting_summaries')
                .select('*')
                .eq('meeting_id', meetingId)
                .single();

            if (!summaryError && summaryData) {
                setSummary(summaryData);
            }
        } catch (err) {
            console.error('Error fetching summary:', err);
        }
    };

    const formatDuration = (ms: number) => {
        const minutes = Math.floor(ms / 60000);
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    };

    // Convert DB data to PipelineResponse format for MeetingDashboard
    const getPipelineData = (): PipelineResponse | null => {
        if (!meeting || !summary) return null;

        return {
            meeting_details: {
                title: meeting.title || 'Untitled Meeting',
                date: meeting.date,
                duration_ms: meeting.duration_ms || 0,
                participants: meeting.participants || [],
                unknown_count: 0
            },
            segment_summaries: [],
            collective_summary: summary.summary_json || {
                narrative_summary: '',
                action_items: [],
                achievements: [],
                blockers: []
            },
            hats: summary.hats_json || [],
            chapters: summary.chapters_json || [],
            mindmap: summary.mindmap_json || {
                center_node: { id: 'root', label: meeting.title || 'Meeting', type: 'root' },
                nodes: [],
                edges: []
            }
        };
    };

    // Comprehensive PDF Export
    const handleDownloadPdf = () => {
        if (!meeting || !summary) return;

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const contentWidth = pageWidth - (margin * 2);
        let yPos = 20;

        const addNewPageIfNeeded = (requiredHeight: number = 30) => {
            if (yPos + requiredHeight > pageHeight - 20) {
                doc.addPage();
                yPos = 20;
                return true;
            }
            return false;
        };

        const addSectionHeader = (title: string) => {
            addNewPageIfNeeded(25);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 64, 175); // Blue color
            doc.text(title, margin, yPos);
            yPos += 3;
            doc.setDrawColor(30, 64, 175);
            doc.setLineWidth(0.5);
            doc.line(margin, yPos, pageWidth - margin, yPos);
            yPos += 8;
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
        };

        const addParagraph = (text: string, fontSize: number = 10) => {
            if (!text) return;
            doc.setFontSize(fontSize);
            doc.setFont('helvetica', 'normal');
            // Clean markdown formatting for PDF
            const cleanText = text
                .replace(/\*\*(.*?)\*\*/g, '$1')
                .replace(/\*(.*?)\*/g, '$1')
                .replace(/#{1,6}\s+/g, '')
                .replace(/^[-*]\s+/gm, '• ')
                .replace(/^\d+\.\s+/gm, '• ');

            const lines = doc.splitTextToSize(cleanText, contentWidth);
            lines.forEach((line: string) => {
                addNewPageIfNeeded(7);
                doc.text(line, margin, yPos);
                yPos += 5;
            });
            yPos += 3;
        };

        const addBulletPoint = (text: string, indent: number = 0) => {
            if (!text) return;
            doc.setFontSize(10);
            const bulletX = margin + indent;
            const textX = bulletX + 5;
            const availableWidth = contentWidth - indent - 5;

            const lines = doc.splitTextToSize(text, availableWidth);
            addNewPageIfNeeded(6 * lines.length);

            doc.text('•', bulletX, yPos);
            lines.forEach((line: string, idx: number) => {
                if (idx > 0) yPos += 5;
                doc.text(line, textX, yPos);
            });
            yPos += 6;
        };

        // ============ TITLE PAGE ============
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 64, 175);
        const titleLines = doc.splitTextToSize(meeting.title || 'Meeting Summary', contentWidth);
        titleLines.forEach((line: string) => {
            doc.text(line, margin, yPos);
            yPos += 10;
        });

        yPos += 5;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Date: ${formatDate(meeting.date || meeting.created_at)}`, margin, yPos);
        yPos += 6;
        doc.text(`Duration: ${formatDuration(meeting.duration_ms || 0)}`, margin, yPos);
        yPos += 6;
        if (meeting.participants && meeting.participants.length > 0) {
            doc.text(`Participants: ${meeting.participants.join(', ')}`, margin, yPos);
            yPos += 6;
        }

        yPos += 10;
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 15;

        // ============ EXECUTIVE SUMMARY ============
        if (summary.summary_json?.narrative_summary) {
            addSectionHeader('Executive Summary');
            doc.setTextColor(50, 50, 50);
            addParagraph(summary.summary_json.narrative_summary);
        }

        // ============ ACTION ITEMS / TO-DOs ============
        const actionItems = summary.summary_json?.action_items || [];
        if (actionItems.length > 0) {
            addSectionHeader('Action Items & To-Dos');
            doc.setFontSize(10);

            actionItems.forEach((item: any, idx: number) => {
                addNewPageIfNeeded(20);

                // Task with number
                doc.setFont('helvetica', 'bold');
                doc.text(`${idx + 1}.`, margin, yPos);

                const taskLines = doc.splitTextToSize(item.task || 'Untitled Task', contentWidth - 15);
                taskLines.forEach((line: string, lineIdx: number) => {
                    doc.text(line, margin + 8, yPos + (lineIdx * 5));
                });
                yPos += (taskLines.length * 5) + 2;

                // Details
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(100, 100, 100);
                const details = [];
                if (item.owner) details.push(`Owner: ${item.owner}`);
                if (item.deadline) details.push(`Deadline: ${item.deadline}`);
                if (item.priority) details.push(`Priority: ${item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}`);

                if (details.length > 0) {
                    doc.text(details.join('  |  '), margin + 8, yPos);
                    yPos += 6;
                }
                doc.setTextColor(50, 50, 50);
                doc.setFontSize(10);
                yPos += 4;
            });
        }

        // ============ ACHIEVEMENTS ============
        const achievements = summary.summary_json?.achievements || [];
        if (achievements.length > 0) {
            addSectionHeader('Achievements & Accomplishments');
            achievements.forEach((item: any) => {
                addBulletPoint(`${item.achievement}${item.member ? ` (${item.member})` : ''}`);
            });
        }

        // ============ BLOCKERS / CHALLENGES ============
        const blockers = summary.summary_json?.blockers || [];
        if (blockers.length > 0) {
            addSectionHeader('Blockers & Challenges');
            blockers.forEach((item: any) => {
                const severity = item.severity ? ` [${item.severity.toUpperCase()}]` : '';
                addBulletPoint(`${item.blocker}${severity}${item.member ? ` - Affected: ${item.member}` : ''}`);
            });
        }

        // ============ CHAPTERS ============
        const chapters = summary.chapters_json || [];
        if (chapters.length > 0) {
            addSectionHeader('Meeting Chapters');

            chapters.forEach((chapter: any, idx: number) => {
                addNewPageIfNeeded(30);

                // Chapter title
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(50, 50, 50);
                doc.text(`Chapter ${idx + 1}: ${chapter.title || 'Untitled'}`, margin, yPos);
                yPos += 7;

                // Chapter summary
                if (chapter.summary) {
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(70, 70, 70);
                    addParagraph(chapter.summary);
                }

                yPos += 5;
            });
        }

        // ============ SIX THINKING HATS ============
        const hats = summary.hats_json || [];
        if (hats.length > 0) {
            addSectionHeader('Six Thinking Hats Analysis');
            doc.setFontSize(10);

            // Get unique speakers with their dominant hat
            const speakerHats: Record<string, any> = {};
            hats.forEach((hat: any) => {
                if (!speakerHats[hat.speaker]) {
                    speakerHats[hat.speaker] = hat;
                }
            });

            Object.entries(speakerHats).forEach(([speaker, hat]: [string, any]) => {
                addNewPageIfNeeded(15);

                const hatInfo = HAT_DESCRIPTIONS[hat.hat as keyof typeof HAT_DESCRIPTIONS];
                doc.setFont('helvetica', 'bold');
                doc.text(`${speaker}:`, margin, yPos);
                doc.setFont('helvetica', 'normal');
                doc.text(` ${hatInfo?.name || hat.hat}`, margin + doc.getTextWidth(`${speaker}: `), yPos);
                yPos += 5;

                if (hat.evidence) {
                    doc.setFontSize(9);
                    doc.setTextColor(100, 100, 100);
                    const evidenceLines = doc.splitTextToSize(hat.evidence, contentWidth - 10);
                    evidenceLines.slice(0, 2).forEach((line: string) => {
                        doc.text(line, margin + 5, yPos);
                        yPos += 4;
                    });
                    doc.setTextColor(50, 50, 50);
                    doc.setFontSize(10);
                }
                yPos += 4;
            });
        }

        // ============ FOOTER ON EACH PAGE ============
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(
                `Page ${i} of ${totalPages}  |  Generated by Meeting Summarizer`,
                pageWidth / 2,
                pageHeight - 10,
                { align: 'center' }
            );
        }

        // Save the PDF
        const filename = (meeting.title || 'meeting')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '');
        doc.save(`${filename}_summary.pdf`);
    };

    const pipelineData = getPipelineData();
    const backLink = meeting?.project_id
        ? `/dashboard/projects/${meeting.project_id}`
        : '/dashboard/meetings';

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
                        <Link href={backLink}>
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <h2 className="text-lg font-semibold text-slate-800 truncate max-w-md">
                            {meeting?.title || 'Meeting'}
                        </h2>
                    </div>
                    <div className="flex items-center gap-4">
                        {pipelineData && (
                            <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
                                <FileDown className="h-4 w-4 mr-2" />
                                Download PDF
                            </Button>
                        )}
                        {session?.user && <UserDropdown email={session.user.email} />}
                    </div>
                </header>

                <div className="p-6 md:p-8 max-w-7xl mx-auto">
                    {/* Upload Modal */}
                    <UploadModal
                        isOpen={isUploadModalOpen}
                        onClose={() => setIsUploadModalOpen(false)}
                        userId={session?.user?.id || ''}
                    />

                    {isLoading ? (
                        <div className="flex justify-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                        </div>
                    ) : !meeting ? (
                        <div className="text-center py-16">
                            <h3 className="text-lg font-semibold text-slate-700">Meeting not found</h3>
                            <Link href="/dashboard/meetings">
                                <Button className="mt-4">Back to Meetings</Button>
                            </Link>
                        </div>
                    ) : meeting.status !== 'completed' ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-16"
                        >
                            <Loader2 className="h-12 w-12 animate-spin text-amber-500 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-slate-700">Processing Meeting...</h3>
                            <p className="text-slate-500 mt-2">This may take a few minutes</p>

                            {/* Meeting Info */}
                            <div className="mt-8 flex justify-center gap-6 text-sm text-slate-500">
                                <span className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    {formatDate(meeting.date || meeting.created_at)}
                                </span>
                                {meeting.participants && meeting.participants.length > 0 && (
                                    <span className="flex items-center gap-2">
                                        <Users className="h-4 w-4" />
                                        {meeting.participants.length} participants
                                    </span>
                                )}
                            </div>
                        </motion.div>
                    ) : pipelineData ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        >
                            <MeetingDashboard data={pipelineData} />
                        </motion.div>
                    ) : (
                        <div className="text-center py-16">
                            <h3 className="text-lg font-semibold text-slate-700">No summary available</h3>
                            <p className="text-slate-500 mt-2">The meeting summary could not be loaded</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
