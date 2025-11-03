"use client";

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { MeetingDashboard } from '@/components/MeetingDashboard';
import { uploadAndSummarize, APIError } from '@/lib/api';
import { PipelineResponse } from '@/types/api';
import { Button } from '@/components/ui/button';
import { formatDuration } from '@/lib/utils';
import { ArrowLeft, FileDown, Loader2, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import jsPDF from 'jspdf';

const stripMarkdown = (input: string): string => {
  if (!input) {
    return '';
  }

  return input
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/^#{1,6}\s*(.*)$/gm, '$1')
    .replace(/^\s*[-*+]\s+/gm, '- ')
    .replace(/>\s?/g, '')
    .replace(/\r/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
};

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PipelineResponse | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!showIntro) {
      return;
    }
    const timer = setTimeout(() => setShowIntro(false), 2000);
    return () => clearTimeout(timer);
  }, [showIntro]);

  const handleFileSelect = async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await uploadAndSummarize(file);
      setData(result);
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setData(null);
    setError(null);
    setShowIntro(true);
  };

  const handleDownloadPdf = () => {
    if (!data) {
      return;
    }

    const doc = new jsPDF();
    const margin = 14;
    const lineHeight = 6;
    const pageHeight = doc.internal.pageSize.getHeight();
    const textWidth = doc.internal.pageSize.getWidth() - margin * 2;
    let cursorY = margin;

    const setBodyFont = () => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
    };

    const ensureSpace = (height: number) => {
      if (cursorY + height > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
      }
    };

    const addParagraph = (text: string) => {
      const cleaned = text.trim();
      if (!cleaned) {
        return;
      }

      const segments = cleaned
        .split(/\n+/)
        .map((segment) => segment.trim())
        .filter(Boolean);

      segments.forEach((segment) => {
        const lines = doc.splitTextToSize(segment, textWidth);
        lines.forEach((line) => {
          ensureSpace(lineHeight);
          setBodyFont();
          doc.text(line, margin, cursorY);
          cursorY += lineHeight;
        });
        cursorY += 2;
      });
    };

    const addHeading = (text: string) => {
      ensureSpace(8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(text, margin, cursorY);
      cursorY += 8;
      setBodyFont();
    };

    const addMetaLine = (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      const lines = doc.splitTextToSize(trimmed, textWidth);
      lines.forEach((line) => {
        ensureSpace(lineHeight);
        setBodyFont();
        doc.text(line, margin, cursorY);
        cursorY += lineHeight;
      });
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Meeting Summary Report', margin, cursorY);
    cursorY += 10;
    setBodyFont();

    addMetaLine(`Title: ${data.meeting_details.title || 'N/A'}`);
    addMetaLine(`Date: ${data.meeting_details.date || 'N/A'}`);
    addMetaLine(`Duration: ${formatDuration(data.meeting_details.duration_ms)}`);
    const participantLine =
      data.meeting_details.participants && data.meeting_details.participants.length
        ? data.meeting_details.participants.join(', ')
        : 'N/A';
    addMetaLine(`Participants: ${participantLine}`);
    cursorY += 4;

    addHeading('Overview');
    const overviewText = stripMarkdown(data.collective_summary?.narrative_summary || '');
    if (overviewText) {
      addParagraph(overviewText);
    } else {
      addParagraph('No overview available.');
    }
    cursorY += 2;

    addHeading("To-Do's");
    const tasks = data.collective_summary?.action_items ?? [];
    if (!tasks.length) {
      addParagraph('No action items documented.');
    } else {
      tasks.forEach((task) => {
        const taskLabel = task.task?.trim() || 'Untitled task';
        const taskLines = doc.splitTextToSize(`- ${taskLabel}`, textWidth);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        taskLines.forEach((line) => {
          ensureSpace(lineHeight);
          doc.text(line, margin, cursorY);
          cursorY += lineHeight;
        });
        setBodyFont();

        const detailParts: string[] = [];
        if (task.owner) detailParts.push(`Owner: ${task.owner}`);
        if (task.deadline) detailParts.push(`Deadline: ${task.deadline}`);
        if (task.status) detailParts.push(`Status: ${task.status}`);

        if (detailParts.length) {
          const detailText = `  • ${detailParts.join(' | ')}`;
          const detailLines = doc.splitTextToSize(detailText, textWidth);
          detailLines.forEach((line) => {
            ensureSpace(lineHeight);
            doc.text(line, margin + 4, cursorY);
            cursorY += lineHeight;
          });
        }
        cursorY += 2;
      });
    }
    cursorY += 2;

    addHeading('Achievements');
    const achievements = data.collective_summary?.achievements ?? [];
    if (!achievements.length) {
      addParagraph('No achievements recorded.');
    } else {
      achievements.forEach((achievement) => {
        const text = stripMarkdown(achievement.achievement || '').trim();
        if (!text) {
          return;
        }
        const lines = doc.splitTextToSize(`- ${text}`, textWidth);
        lines.forEach((line) => {
          ensureSpace(lineHeight);
          doc.text(line, margin, cursorY);
          cursorY += lineHeight;
        });
        cursorY += 2;
      });
    }
    cursorY += 2;

    addHeading('Blockers');
    const blockers = data.collective_summary?.blockers ?? [];
    if (!blockers.length) {
      addParagraph('No blockers identified.');
    } else {
      blockers.forEach((blocker) => {
        const text = stripMarkdown(blocker.blocker || '').trim();
        if (!text) {
          return;
        }
        const lines = doc.splitTextToSize(`- ${text}`, textWidth);
        lines.forEach((line) => {
          ensureSpace(lineHeight);
          doc.text(line, margin, cursorY);
          cursorY += lineHeight;
        });
        cursorY += 2;
      });
    }
    cursorY += 2;

    addHeading('Chapters');
    const chapters = data.chapters ?? [];
    if (!chapters.length) {
      addParagraph('No chapters available.');
    } else {
      chapters.forEach((chapter, index) => {
        ensureSpace(lineHeight);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(`${index + 1}. ${chapter.title || 'Untitled Chapter'}`, margin, cursorY);
        cursorY += lineHeight;
        setBodyFont();

        const summaryText = stripMarkdown(chapter.summary || '');
        if (summaryText) {
          addParagraph(summaryText);
        } else {
          addParagraph('No summary provided for this chapter.');
        }
        cursorY += 2;
      });
    }

    doc.save('meeting-summary.pdf');
  };

  const handleUploadButtonClick = () => {
    if (isLoading) {
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError(null);
    const isVtt = file.name.toLowerCase().endsWith('.vtt');
    if (!isVtt) {
      setError('Please upload a .vtt transcript file');
      event.target.value = '';
      return;
    }

    handleFileSelect(file);
    event.target.value = '';
  };

  if (data) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/90 text-white shadow-sm">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold leading-tight">Meeting Summarizer</h1>
                  <p className="text-xs text-slate-500">AI-powered meeting intelligence</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleDownloadPdf}
                  size="sm"
                  className="gap-2"
                  disabled={isLoading}
                >
                  <FileDown className="h-4 w-4" />
                  Download PDF
                </Button>
                <Button onClick={handleReset} variant="outline" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  New Analysis
                </Button>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-2">
          <MeetingDashboard data={data} />
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#f4f6ff] via-[#fdfdff] to-[#eef7ff] text-slate-900">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-28 -top-28 h-96 w-96 rounded-full bg-gradient-to-br from-[#9fb8ff]/55 via-[#c9a9ff]/35 to-transparent blur-3xl"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.4, ease: 'easeOut' }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 right-0 h-[28rem] w-[32rem] rounded-full bg-gradient-to-br from-[#9af0e0]/45 via-[#8bc6ff]/30 to-transparent blur-3xl"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.6, delay: 0.3, ease: 'easeOut' }}
      />

      <AnimatePresence>
        {showIntro && (
          <motion.div
            key="intro"
            className="absolute inset-0 z-20 flex items-center justify-center bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="bg-gradient-to-r from-[#5168ff] via-[#9b55ff] to-[#53d7d0] bg-clip-text text-4xl uppercase tracking-[0.5em] text-transparent md:text-6xl"
            >
              SUMMER AI
            </motion.h1>
          </motion.div>
        )}
      </AnimatePresence>

      {!showIntro && (
        <motion.section
          key="upload"
          className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 md:px-10 md:py-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <motion.div
            className="relative flex w-full max-w-6xl flex-col overflow-hidden rounded-[52px] border border-slate-200/70 bg-white/70 shadow-[0_60px_120px_rgba(123,147,255,0.25)] backdrop-blur-3xl md:min-h-[80vh] md:flex-row"
            style={{ margin: '3px' }}
            initial={{ scale: 0.97 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <div className="relative flex w-full flex-1 items-center justify-center bg-gradient-to-br to-[#d1d6ee] via-[#9196a3] from-[#a6b8ec] p-6 md:p-12">
              <motion.div
                className="relative flex h-[72vh] w-full max-w-sm flex-col overflow-hidden rounded-[44px] border border-white/15 bg-white/8 shadow-[0_35px_110px_rgba(18,31,60,0.65)] backdrop-blur-2xl"
                initial={{ opacity: 0, y: 48 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.2 }}
                whileHover={{ scale: 1.03 }}
              >
                <img
                  src="/rect1.png"
                  alt="Instant summary background"
                  className="absolute inset-0 h-full w-full object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/35 to-black/50" />
                <div className="relative z-10 flex h-full flex-col">
                  <div className="px-9 pt-12">
                    <p className="text-xs uppercase tracking-[0.55em] text-white/70">
                      Instant Summary
                    </p>
                    <h2 className="mt-6 text-3xl font-semibold leading-snug text-white">
                      Upload a transcript to generate an elegant, insight-rich meeting brief.
                    </h2>
                    <p className="mt-4 text-sm text-white/65">
                      Powered by Summer AI&mdash;optimized for clarity, speed, and decision-ready output.
                    </p>
                  </div>
                  <div className="mt-auto px-9 pb-12">
                    <button
                      type="button"
                      onClick={handleUploadButtonClick}
                      className="group relative flex w-full items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/25 px-7 py-4 text-base font-semibold text-white shadow-[0_25px_60px_rgba(15,23,42,0.45)] backdrop-blur transition hover:bg-white/35 disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <span className="absolute inset-0 rounded-2xl bg-white/10 opacity-0 transition group-hover:opacity-100" />
                          <span className="relative">Upload Transcript</span>
                        </>
                      )}
                    </button>
                    {error && (
                      <p className="mt-3 text-center text-sm text-rose-200">{error}</p>
                    )}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".vtt"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
              </motion.div>
            </div>

            <div className="relative flex w-full flex-1 items-center justify-center bg-gradient-to-tl from-[#d1d6ee] via-[#9196a3] to-[#a6b8ec] p-6 md:p-12">
              <motion.div
                className="relative flex h-[72vh] w-full max-w-sm flex-col items-center overflow-hidden rounded-[44px] border border-white/15 bg-white/8 shadow-[0_40px_120px_rgba(16,27,55,0.6)] backdrop-blur-2xl"
                initial={{ opacity: 0, y: 48 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.3 }}
                whileHover={{ scale: 1.03 }}
              >
                <img
                  src="/rect2.png"
                  alt="Account area background"
                  className="absolute inset-0 h-full w-full object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-black/55 via-black/45 to-black/60" />
                <div className="relative z-10 flex h-full w-full flex-col items-center px-9 pt-12 text-white">
                  <p className="text-xs uppercase tracking-[0.55em] text-white/60">Summer AI</p>
                  <h2 className="mt-4 text-3xl font-semibold text-center leading-snug text-white">
                    Personalized spaces for your team
                  </h2>
                  <p className="mt-4 text-sm text-center text-white/65">
                    Collaborate in shared workspaces with real-time insights, governed access, and custom branding.
                  </p>
                  <div className="mt-12 flex w-full max-w-xs flex-col gap-4">
                    <div className="overflow-hidden rounded-2xl border border-white/25 bg-white/12 px-6 py-4 text-center text-lg font-semibold uppercase tracking-wide backdrop-blur transition duration-300 hover:border-white/40 hover:bg-white/18">
                      Login
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-white/25 bg-white/12 px-6 py-4 text-center text-lg font-semibold uppercase tracking-wide backdrop-blur transition duration-300 hover:border-white/40 hover:bg-white/18">
                      Sign Up
                    </div>
                  </div>
                  <div className="mt-auto pb-12 text-center text-xs uppercase tracking-[0.35em] text-white/45">
                    Coming Soon
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </motion.section>
      )}
    </main>
  );
}
