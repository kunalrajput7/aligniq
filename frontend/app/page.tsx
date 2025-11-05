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

// Render markdown text with proper formatting in PDF
const renderMarkdownToPDF = (
  doc: any,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  ensureSpace: (currentY: number, neededHeight: number) => number
): number => {
  if (!text || !text.trim()) return y;

  let cursorY = y;
  const lines = text.split('\n');

  lines.forEach((line) => {
    line = line.trim();

    // Empty line - add small space
    if (!line) {
      cursorY += lineHeight * 0.5;
      return;
    }

    // Check for H2 heading (##)
    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      cursorY = ensureSpace(cursorY, 12);
      cursorY += 3;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(h2Match[1], x, cursorY);
      cursorY += lineHeight + 4;
      return;
    }

    // Check for H3 heading (###)
    const h3Match = line.match(/^###\s+(.+)$/);
    if (h3Match) {
      cursorY = ensureSpace(cursorY, 10);
      cursorY += 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(h3Match[1], x, cursorY);
      cursorY += lineHeight + 3;
      return;
    }

    // Check for bullet point
    const bulletMatch = line.match(/^[-•*]\s+(.+)$/);
    if (bulletMatch) {
      const bulletIndent = x + 5;
      const bulletText = bulletMatch[1];

      cursorY = ensureSpace(cursorY, lineHeight);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('•', bulletIndent - 3, cursorY);

      // Process bold/italic in bullet text
      const textLines = processBoldItalic(
        doc,
        bulletText,
        bulletIndent,
        cursorY,
        maxWidth - 5,
        lineHeight,
        ensureSpace
      );
      cursorY = textLines;
      cursorY += 2;
      return;
    }

    // Regular paragraph - process bold/italic
    cursorY = processBoldItalic(doc, line, x, cursorY, maxWidth, lineHeight, ensureSpace);
    cursorY += 3;
  });

  return cursorY;
};

// Process text with **bold** and *italic* formatting
const processBoldItalic = (
  doc: any,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  ensureSpace: (currentY: number, neededHeight: number) => number
): number => {
  let cursorY = y;
  let cursorX = x;

  // Parse text into segments with formatting
  const segments: Array<{text: string, bold: boolean, italic: boolean}> = [];
  let pos = 0;

  // Pattern to match **bold** or *italic*
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let match;
  let lastIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    // Add plain text before match
    if (match.index > lastIndex) {
      segments.push({
        text: text.substring(lastIndex, match.index),
        bold: false,
        italic: false
      });
    }

    // Add formatted text
    if (match[2]) {
      // **bold**
      segments.push({ text: match[2], bold: true, italic: false });
    } else if (match[3]) {
      // *italic*
      segments.push({ text: match[3], bold: false, italic: true });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      text: text.substring(lastIndex),
      bold: false,
      italic: false
    });
  }

  // If no formatting found, treat as plain text
  if (segments.length === 0) {
    segments.push({ text, bold: false, italic: false });
  }

  // Render segments
  doc.setFontSize(10);

  segments.forEach((segment) => {
    if (!segment.text) return;

    // Set font style
    if (segment.bold) {
      doc.setFont('helvetica', 'bold');
    } else if (segment.italic) {
      doc.setFont('helvetica', 'italic');
    } else {
      doc.setFont('helvetica', 'normal');
    }

    // Split text to fit width
    const words = segment.text.split(' ');
    let currentLine = '';

    words.forEach((word, idx) => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = doc.getTextWidth(testLine);

      if (testWidth > maxWidth - (cursorX - x) && currentLine) {
        // Line is full, print it
        cursorY = ensureSpace(cursorY, lineHeight);
        doc.text(currentLine, cursorX, cursorY);
        cursorY += lineHeight;
        cursorX = x;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });

    // Print remaining text
    if (currentLine) {
      cursorY = ensureSpace(cursorY, lineHeight);
      doc.text(currentLine, cursorX, cursorY);
      cursorX += doc.getTextWidth(currentLine) + doc.getTextWidth(' ');

      // Check if we need to wrap to next line
      if (cursorX > x + maxWidth) {
        cursorY += lineHeight;
        cursorX = x;
      }
    }
  });

  // Move to next line if we wrote anything
  if (cursorX > x) {
    cursorY = ensureSpace(cursorY, lineHeight);
    cursorY += lineHeight;
  }

  return cursorY;
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
    const margin = 20;
    const lineHeight = 6;
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const textWidth = pageWidth - margin * 2;
    let cursorY = margin;

    const ensureSpace = (currentY: number, neededHeight: number) => {
      if (currentY + neededHeight > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
        return cursorY;
      }
      return currentY;
    };

    //====== HEADER ======
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('Meeting Summary', margin, cursorY);
    cursorY += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Title: ${data.meeting_details.title || 'N/A'}`, margin, cursorY);
    cursorY += 5;
    doc.text(`Date: ${data.meeting_details.date || 'N/A'}`, margin, cursorY);
    cursorY += 5;
    doc.text(`Duration: ${formatDuration(data.meeting_details.duration_ms)}`, margin, cursorY);
    cursorY += 5;
    const participantLine =
      data.meeting_details.participants && data.meeting_details.participants.length
        ? data.meeting_details.participants.join(', ')
        : 'N/A';
    doc.text(`Participants: ${participantLine}`, margin, cursorY);
    cursorY += 10;

    //====== OVERVIEW ======
    cursorY = ensureSpace(cursorY, 15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Overview', margin, cursorY);
    cursorY += 8;

    const overviewText = data.collective_summary?.narrative_summary || '';
    if (overviewText) {
      cursorY = renderMarkdownToPDF(doc, overviewText, margin, cursorY, textWidth, lineHeight, ensureSpace);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('No overview available.', margin, cursorY);
      cursorY += lineHeight;
    }
    cursorY += 5;

    //====== ACTION ITEMS ======
    cursorY = ensureSpace(cursorY, 15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text("Action Items", margin, cursorY);
    cursorY += 8;

    const tasks = data.collective_summary?.action_items ?? [];
    if (!tasks.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('No action items documented.', margin, cursorY);
      cursorY += lineHeight;
    } else {
      tasks.forEach((task) => {
        cursorY = ensureSpace(cursorY, 12);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        const taskLines = doc.splitTextToSize(`• ${task.task || 'Untitled task'}`, textWidth - 3);
        taskLines.forEach((line: string) => {
          cursorY = ensureSpace(cursorY, lineHeight);
          doc.text(line, margin + 3, cursorY);
          cursorY += lineHeight;
        });

        const detailParts: string[] = [];
        if (task.owner) detailParts.push(`Owner: ${task.owner}`);
        if (task.deadline) detailParts.push(`Due: ${task.deadline}`);
        if (task.status) detailParts.push(`Status: ${task.status}`);

        if (detailParts.length) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(9);
          doc.text(`  ${detailParts.join(' | ')}`, margin + 3, cursorY);
          cursorY += lineHeight;
        }
        cursorY += 3;
      });
    }
    cursorY += 5;

    //====== ACHIEVEMENTS ======
    cursorY = ensureSpace(cursorY, 15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Achievements', margin, cursorY);
    cursorY += 8;

    const achievements = data.collective_summary?.achievements ?? [];
    if (!achievements.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('No achievements recorded.', margin, cursorY);
      cursorY += lineHeight;
    } else {
      achievements.forEach((achievement) => {
        const text = achievement.achievement || '';
        if (!text.trim()) return;

        cursorY = ensureSpace(cursorY, 10);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(`• ${text}`, textWidth - 3);
        lines.forEach((line: string) => {
          cursorY = ensureSpace(cursorY, lineHeight);
          doc.text(line, margin + 3, cursorY);
          cursorY += lineHeight;
        });
        cursorY += 2;
      });
    }
    cursorY += 5;

    //====== BLOCKERS ======
    cursorY = ensureSpace(cursorY, 15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Blockers', margin, cursorY);
    cursorY += 8;

    const blockers = data.collective_summary?.blockers ?? [];
    if (!blockers.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('No blockers identified.', margin, cursorY);
      cursorY += lineHeight;
    } else {
      blockers.forEach((blocker) => {
        const text = blocker.blocker || '';
        if (!text.trim()) return;

        cursorY = ensureSpace(cursorY, 10);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(`• ${text}`, textWidth - 3);
        lines.forEach((line: string) => {
          cursorY = ensureSpace(cursorY, lineHeight);
          doc.text(line, margin + 3, cursorY);
          cursorY += lineHeight;
        });
        cursorY += 2;
      });
    }
    cursorY += 5;

    //====== CHAPTERS ======
    cursorY = ensureSpace(cursorY, 15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Chapters', margin, cursorY);
    cursorY += 8;

    const chapters = data.chapters ?? [];
    if (!chapters.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('No chapters available.', margin, cursorY);
      cursorY += lineHeight;
    } else {
      chapters.forEach((chapter, index) => {
        cursorY = ensureSpace(cursorY, 15);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(`${index + 1}. ${chapter.title || 'Untitled Chapter'}`, margin, cursorY);
        cursorY += 7;

        const summaryText = chapter.summary || '';
        if (summaryText) {
          cursorY = renderMarkdownToPDF(doc, summaryText, margin, cursorY, textWidth, lineHeight, ensureSpace);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.text('No summary provided for this chapter.', margin, cursorY);
          cursorY += lineHeight;
        }
        cursorY += 5;
      });
    }

    // Generate filename from meeting title with underscores
    const meetingTitle = data.meeting_details.title || 'Meeting_Summary';
    const filename = meetingTitle.trim().replace(/\s+/g, '_') + '.pdf';
    doc.save(filename);
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
                  <h1 className="text-lg font-semibold leading-tight">Summer AI</h1>
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
