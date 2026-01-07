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

    // ============ PROFESSIONAL PDF EXPORT ============
    const handleDownloadPdf = () => {
        if (!meeting || !summary) return;

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const contentWidth = pageWidth - (margin * 2);
        let yPos = 20;

        // Color palette for professional look
        const colors = {
            primary: [30, 64, 175] as [number, number, number],      // Deep blue
            secondary: [71, 85, 105] as [number, number, number],    // Slate gray
            accent: [16, 185, 129] as [number, number, number],      // Emerald
            text: [30, 41, 59] as [number, number, number],          // Dark slate
            muted: [100, 116, 139] as [number, number, number],      // Gray
            light: [241, 245, 249] as [number, number, number],      // Light bg
            white: [255, 255, 255] as [number, number, number],
            warning: [245, 158, 11] as [number, number, number],     // Amber
            danger: [239, 68, 68] as [number, number, number],       // Red
        };

        // Hat colors for visual distinction
        const hatColors: Record<string, [number, number, number]> = {
            white: [148, 163, 184],
            red: [239, 68, 68],
            black: [30, 41, 59],
            yellow: [234, 179, 8],
            green: [34, 197, 94],
            blue: [59, 130, 246],
        };

        // ============ HELPER FUNCTIONS ============
        const addNewPageIfNeeded = (requiredHeight: number = 30): boolean => {
            if (yPos + requiredHeight > pageHeight - 25) {
                doc.addPage();
                yPos = 25;
                return true;
            }
            return false;
        };

        const drawSectionHeader = (title: string, icon?: string) => {
            addNewPageIfNeeded(30);

            // Section background bar
            doc.setFillColor(...colors.primary);
            doc.rect(margin, yPos - 5, contentWidth, 12, 'F');

            // Section title
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...colors.white);
            doc.text(title.toUpperCase(), margin + 5, yPos + 3);

            yPos += 15;
            doc.setTextColor(...colors.text);
            doc.setFont('helvetica', 'normal');
        };

        const drawSubsectionHeader = (title: string) => {
            addNewPageIfNeeded(20);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...colors.secondary);
            doc.text(title, margin, yPos);
            yPos += 2;
            doc.setDrawColor(...colors.secondary);
            doc.setLineWidth(0.3);
            doc.line(margin, yPos, margin + doc.getTextWidth(title), yPos);
            yPos += 8;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...colors.text);
        };

        const addParagraph = (text: string, fontSize: number = 10, indent: number = 0) => {
            if (!text) return;
            doc.setFontSize(fontSize);
            doc.setFont('helvetica', 'normal');

            // Clean markdown formatting
            const cleanText = text
                .replace(/\\r\\n|\\n/g, '\n')
                .replace(/\r\n|\r/g, '\n')
                .replace(/\*\*(.*?)\*\*/g, '$1')
                .replace(/\*(.*?)\*/g, '$1')
                .replace(/#{1,6}\s+/g, '')
                .replace(/^[-*]\s+/gm, '• ')
                .replace(/^\d+\.\s+/gm, '• ');

            const paragraphs = cleanText.split('\n\n');
            paragraphs.forEach((para, pIdx) => {
                if (!para.trim()) return;

                const lines = doc.splitTextToSize(para.trim(), contentWidth - indent);
                lines.forEach((line: string) => {
                    addNewPageIfNeeded(6);
                    doc.text(line, margin + indent, yPos);
                    yPos += 5;
                });
                if (pIdx < paragraphs.length - 1) yPos += 3;
            });
            yPos += 4;
        };

        const addBulletItem = (text: string, indent: number = 0, bulletChar: string = '•') => {
            if (!text) return;
            doc.setFontSize(10);
            const bulletX = margin + indent;
            const textX = bulletX + 6;
            const availableWidth = contentWidth - indent - 8;

            const lines = doc.splitTextToSize(text, availableWidth);
            addNewPageIfNeeded(5 * lines.length + 4);

            doc.setTextColor(...colors.primary);
            doc.text(bulletChar, bulletX, yPos);
            doc.setTextColor(...colors.text);

            lines.forEach((line: string, idx: number) => {
                doc.text(line, textX, yPos);
                if (idx < lines.length - 1) yPos += 5;
            });
            yPos += 7;
        };

        const drawInfoRow = (label: string, value: string, labelWidth: number = 35) => {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...colors.secondary);
            doc.text(label + ':', margin, yPos);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...colors.text);
            const valueLines = doc.splitTextToSize(value, contentWidth - labelWidth);
            valueLines.forEach((line: string, idx: number) => {
                doc.text(line, margin + labelWidth, yPos);
                if (idx < valueLines.length - 1) yPos += 5;
            });
            yPos += 7;
        };

        const drawTable = (headers: string[], rows: string[][], colWidths: number[]) => {
            const cellPadding = 3;
            const rowHeight = 8;
            const headerHeight = 10;

            // Table header
            addNewPageIfNeeded(headerHeight + rowHeight * 2);
            doc.setFillColor(...colors.primary);
            let xPos = margin;
            doc.rect(margin, yPos - 5, contentWidth, headerHeight, 'F');

            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...colors.white);
            headers.forEach((header, idx) => {
                doc.text(header, xPos + cellPadding, yPos);
                xPos += colWidths[idx];
            });
            yPos += headerHeight;

            // Table rows
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...colors.text);

            rows.forEach((row, rowIdx) => {
                const maxLines = Math.max(...row.map((cell, idx) =>
                    doc.splitTextToSize(cell, colWidths[idx] - cellPadding * 2).length
                ));
                const currentRowHeight = Math.max(rowHeight, maxLines * 5 + 4);

                addNewPageIfNeeded(currentRowHeight);

                // Alternating row background
                if (rowIdx % 2 === 0) {
                    doc.setFillColor(...colors.light);
                    doc.rect(margin, yPos - 4, contentWidth, currentRowHeight, 'F');
                }

                // Draw row border
                doc.setDrawColor(220, 220, 220);
                doc.setLineWidth(0.2);
                doc.line(margin, yPos + currentRowHeight - 4, margin + contentWidth, yPos + currentRowHeight - 4);

                xPos = margin;
                row.forEach((cell, idx) => {
                    const cellLines = doc.splitTextToSize(cell, colWidths[idx] - cellPadding * 2);
                    let cellY = yPos;
                    cellLines.slice(0, 3).forEach((line: string) => {
                        doc.text(line, xPos + cellPadding, cellY);
                        cellY += 5;
                    });
                    xPos += colWidths[idx];
                });
                yPos += currentRowHeight;
            });
            yPos += 5;
        };

        // ============ PAGE 1: TITLE PAGE ============
        // Calculate header height based on content
        const headerHeight = 130;

        // Blue header background
        doc.setFillColor(...colors.primary);
        doc.rect(0, 0, pageWidth, headerHeight, 'F');

        // Centered branding at top
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.white);
        doc.text('AlignIQ', pageWidth / 2, 18, { align: 'center' });
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('Meeting Intelligence Platform', pageWidth / 2, 26, { align: 'center' });

        // Thin white line separator
        doc.setDrawColor(...colors.white);
        doc.setLineWidth(0.3);
        doc.line(margin + 30, 32, pageWidth - margin - 30, 32);

        // Meeting title - centered and prominent
        yPos = 50;
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.white);
        const titleText = meeting.title || 'Meeting Summary';
        const titleLines = doc.splitTextToSize(titleText, contentWidth - 20);
        titleLines.forEach((line: string) => {
            doc.text(line, pageWidth / 2, yPos, { align: 'center' });
            yPos += 9;
        });

        // Meeting metadata inside blue box
        yPos += 10;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(200, 215, 240); // Light blue-white for labels

        // Date row
        const labelX = margin + 25;
        const valueX = margin + 70;
        doc.text('Date:', labelX, yPos);
        doc.setTextColor(...colors.white);
        doc.text(formatDate(meeting.date || meeting.created_at), valueX, yPos);

        // Duration row
        yPos += 10;
        doc.setTextColor(200, 215, 240);
        doc.text('Duration:', labelX, yPos);
        doc.setTextColor(...colors.white);
        doc.text(formatDuration(meeting.duration_ms || 0), valueX, yPos);

        // Participants row
        if (meeting.participants && meeting.participants.length > 0) {
            yPos += 10;
            doc.setTextColor(200, 215, 240);
            doc.text('Participants:', labelX, yPos);
            doc.setTextColor(...colors.white);
            const participantText = meeting.participants.join(', ');
            const participantLines = doc.splitTextToSize(participantText, contentWidth - 70);
            participantLines.forEach((line: string, idx: number) => {
                doc.text(line, valueX, yPos + (idx * 5));
            });
        }

        // Report generation timestamp at bottom of blue box
        doc.setFontSize(8);
        doc.setTextColor(180, 200, 230);
        doc.text(`Report generated on ${new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        })}`, pageWidth / 2, headerHeight - 8, { align: 'center' });

        // ============ CONTENTS SECTION (outside blue box) ============
        yPos = headerHeight + 20;

        // ============ TABLE OF CONTENTS ============
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.primary);
        doc.text('Contents', margin, yPos);
        yPos += 10;

        const tocItems = [
            { title: 'Executive Summary', hasContent: !!summary.summary_json?.narrative_summary },
            { title: 'Action Items & Assignments', hasContent: (summary.summary_json?.action_items?.length || 0) > 0 },
            { title: 'Achievements & Accomplishments', hasContent: (summary.summary_json?.achievements?.length || 0) > 0 },
            { title: 'Blockers & Challenges', hasContent: (summary.summary_json?.blockers?.length || 0) > 0 },
            { title: 'Meeting Chapters', hasContent: (summary.chapters_json?.length || 0) > 0 },
            { title: 'Participant Analysis (Six Thinking Hats)', hasContent: (summary.hats_json?.length || 0) > 0 },
        ];

        let tocNumber = 1;
        tocItems.forEach((item) => {
            if (item.hasContent) {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...colors.text);
                doc.text(`${tocNumber}. ${item.title}`, margin + 5, yPos);
                // Dotted line to page number would go here in a more complex implementation
                yPos += 7;
                tocNumber++;
            }
        });

        // Start new page for content
        doc.addPage();
        yPos = 25;

        // ============ EXECUTIVE SUMMARY ============
        if (summary.summary_json?.narrative_summary) {
            drawSectionHeader('Executive Summary');
            doc.setTextColor(...colors.text);
            addParagraph(summary.summary_json.narrative_summary, 10);
            yPos += 5;
        }

        // ============ ACTION ITEMS ============
        const actionItems = summary.summary_json?.action_items || [];
        if (actionItems.length > 0) {
            drawSectionHeader('Action Items & Assignments');

            // Summary count
            doc.setFontSize(9);
            doc.setTextColor(...colors.muted);
            doc.text(`${actionItems.length} action item${actionItems.length !== 1 ? 's' : ''} identified`, margin, yPos);
            yPos += 10;

            // Action items table
            const tableHeaders = ['#', 'Task Description', 'Owner', 'Priority', 'Deadline'];
            const colWidths = [10, 75, 35, 25, 25];

            const tableRows = actionItems.map((item: any, idx: number) => [
                String(idx + 1),
                item.task || 'Untitled',
                item.owner || 'Unassigned',
                (item.priority || 'medium').charAt(0).toUpperCase() + (item.priority || 'medium').slice(1),
                item.deadline || '—'
            ]);

            drawTable(tableHeaders, tableRows, colWidths);
            yPos += 5;
        }

        // ============ ACHIEVEMENTS ============
        const achievements = summary.summary_json?.achievements || [];
        if (achievements.length > 0) {
            drawSectionHeader('Achievements & Accomplishments');

            achievements.forEach((item: any, idx: number) => {
                addNewPageIfNeeded(20);

                // Achievement with check mark
                doc.setFontSize(10);
                doc.setTextColor(...colors.accent);
                doc.text('✓', margin, yPos);
                doc.setTextColor(...colors.text);
                doc.setFont('helvetica', 'normal');

                const achievementText = item.achievement + (item.member ? ` — ${item.member}` : '');
                const lines = doc.splitTextToSize(achievementText, contentWidth - 10);
                lines.forEach((line: string, lineIdx: number) => {
                    doc.text(line, margin + 8, yPos);
                    if (lineIdx < lines.length - 1) yPos += 5;
                });
                yPos += 8;
            });
            yPos += 5;
        }

        // ============ BLOCKERS ============
        const blockers = summary.summary_json?.blockers || [];
        if (blockers.length > 0) {
            drawSectionHeader('Blockers & Challenges');

            blockers.forEach((item: any) => {
                addNewPageIfNeeded(25);

                // Severity indicator
                const severityColors: Record<string, [number, number, number]> = {
                    critical: colors.danger,
                    major: colors.warning,
                    minor: colors.muted
                };
                const severity = (item.severity || 'major').toLowerCase();
                const severityColor = severityColors[severity] || colors.warning;

                // Indicator bar
                doc.setFillColor(...severityColor);
                doc.rect(margin, yPos - 4, 3, 12, 'F');

                // Blocker text
                doc.setFontSize(10);
                doc.setTextColor(...colors.text);
                const blockerLines = doc.splitTextToSize(item.blocker, contentWidth - 15);
                blockerLines.forEach((line: string, idx: number) => {
                    doc.text(line, margin + 8, yPos);
                    if (idx < blockerLines.length - 1) yPos += 5;
                });

                // Metadata
                yPos += 6;
                doc.setFontSize(8);
                doc.setTextColor(...colors.muted);
                const meta = [];
                if (severity) meta.push(`Severity: ${severity.charAt(0).toUpperCase() + severity.slice(1)}`);
                if (item.member) meta.push(`Affected: ${item.member}`);
                doc.text(meta.join('  |  '), margin + 8, yPos);
                yPos += 10;
            });
            yPos += 5;
        }

        // ============ CHAPTERS ============
        const chapters = summary.chapters_json || [];
        if (chapters.length > 0) {
            drawSectionHeader('Meeting Chapters');

            chapters.forEach((chapter: any, idx: number) => {
                addNewPageIfNeeded(35);

                // Chapter number badge
                doc.setFillColor(...colors.secondary);
                doc.circle(margin + 5, yPos - 2, 4, 'F');
                doc.setFontSize(8);
                doc.setTextColor(...colors.white);
                doc.text(String(idx + 1), margin + 3.5, yPos);

                // Chapter title
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...colors.text);
                doc.text(chapter.title || `Chapter ${idx + 1}`, margin + 14, yPos);
                yPos += 8;

                // Chapter summary
                if (chapter.summary) {
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(10);
                    doc.setTextColor(...colors.secondary);
                    addParagraph(chapter.summary, 10, 14);
                }
                yPos += 5;
            });
        }

        // ============ SIX THINKING HATS ============
        const hats = summary.hats_json || [];
        if (hats.length > 0) {
            drawSectionHeader('Participant Analysis (Six Thinking Hats)');

            // Brief explanation
            doc.setFontSize(9);
            doc.setTextColor(...colors.muted);
            const hatExplanation = 'The Six Thinking Hats framework analyzes how each participant contributed to the discussion based on their dominant thinking style.';
            addParagraph(hatExplanation, 9);
            yPos += 3;

            // Get unique speakers
            const speakerHats: Record<string, any> = {};
            hats.forEach((hat: any) => {
                if (!speakerHats[hat.speaker]) {
                    speakerHats[hat.speaker] = hat;
                }
            });

            Object.entries(speakerHats).forEach(([speaker, hat]: [string, any]) => {
                addNewPageIfNeeded(40);

                const hatKey = (hat.hat || 'white').toLowerCase();
                const hatInfo = HAT_DESCRIPTIONS[hatKey as keyof typeof HAT_DESCRIPTIONS];
                const hatColor = hatColors[hatKey] || hatColors.white;

                // Hat color indicator bar
                doc.setFillColor(...hatColor);
                doc.rect(margin, yPos - 4, contentWidth, 18, 'F');

                // Speaker name
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...colors.white);
                doc.text(speaker, margin + 5, yPos + 2);

                // Hat name badge
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                const hatName = hatInfo?.name || `${hatKey.charAt(0).toUpperCase() + hatKey.slice(1)} Hat`;
                doc.text(hatName, margin + 5, yPos + 9);

                yPos += 20;

                // Evidence/explanation
                if (hat.evidence) {
                    doc.setFontSize(10);
                    doc.setTextColor(...colors.text);
                    doc.setFont('helvetica', 'normal');
                    addParagraph(hat.evidence, 10, 5);
                } else {
                    doc.setFontSize(9);
                    doc.setTextColor(...colors.muted);
                    doc.text(hatInfo?.description || 'No additional details available.', margin + 5, yPos);
                    yPos += 8;
                }
                yPos += 5;
            });
        }

        // ============ FOOTER ON EACH PAGE ============
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);

            // Footer line
            doc.setDrawColor(...colors.light);
            doc.setLineWidth(0.5);
            doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

            // Page number and branding
            doc.setFontSize(8);
            doc.setTextColor(...colors.muted);
            doc.text(`Page ${i} of ${totalPages}`, margin, pageHeight - 8);
            doc.text('Generated by AlignIQ', pageWidth - margin, pageHeight - 8, { align: 'right' });
        }

        // ============ SAVE PDF ============
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
