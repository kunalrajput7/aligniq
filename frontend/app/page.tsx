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
import { LoadingMessages } from '@/components/LoadingMessages';

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
    <main className="relative min-h-screen overflow-hidden bg-[#F8FAFC]">
      {/* Subtle dot pattern background */}
      <div className="absolute inset-0 opacity-[0.015]" style={{
        backgroundImage: 'radial-gradient(circle, #64748B 1px, transparent 1px)',
        backgroundSize: '24px 24px'
      }} />

      <AnimatePresence>
        {showIntro && (
          <motion.div
            key="intro"
            className="absolute inset-0 z-50 flex items-center justify-center bg-white"
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
              className="bg-gradient-to-r from-[#3B82F6] via-[#8B5CF6] to-[#06B6D4] bg-clip-text text-4xl font-bold uppercase tracking-[0.3em] text-transparent md:text-6xl"
            >
              SUMMER AI
            </motion.h1>
          </motion.div>
        )}
      </AnimatePresence>

      {!showIntro && (
        <motion.section
          key="landing"
          className="relative z-10 min-h-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          {/* Header */}
          <header className="relative z-10 border-b border-slate-200/50 bg-white/80 backdrop-blur-sm">
            <div className="container mx-auto flex items-center justify-between px-4 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/25">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-900">Summer AI</span>
              </div>
              <div className="hidden md:flex items-center gap-8">
                <button className="text-sm font-light text-slate-600 transition hover:text-slate-900">
                  Features
                </button>
                <button className="text-sm font-light text-slate-600 transition hover:text-slate-900">
                  Solutions
                </button>
                <button className="text-sm font-light text-slate-600 transition hover:text-slate-900">
                  Resources
                </button>
                <button className="text-sm font-light text-slate-600 transition hover:text-slate-900">
                  Pricing
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button className="hidden sm:inline-block rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                  Sign in
                </button>
                <button
                  onClick={handleUploadButtonClick}
                  disabled={isLoading}
                  className="rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:shadow-xl hover:shadow-blue-500/40 disabled:opacity-70"
                >
                  {isLoading ? 'Processing...' : 'Get demo'}
                </button>
              </div>
            </div>
          </header>

          {/* Hero Section with Floating Elements */}
          <div className="container relative mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-20 sm:pb-32">
            {/* Top Left: Sticky Note */}
            <motion.div
              className="absolute left-4 top-8 w-48 sm:w-64 rotate-[-3deg] hidden lg:block"
              initial={{ opacity: 0, y: -20, rotate: -6 }}
              animate={{ opacity: 1, y: 0, rotate: -3 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              style={{
                animation: 'float 6s ease-in-out infinite'
              }}
            >
              <div className="rounded-lg bg-gradient-to-br from-yellow-200 to-yellow-300 p-6 shadow-2xl shadow-yellow-500/20">
                <p className="text-sm leading-relaxed text-slate-800">
                  <span className="font-semibold">Quick Tip:</span>
                  <br />
                  Upload your .vtt transcript and get instant AI-powered insights in seconds!
                </p>
              </div>
              <div className="mt-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500 shadow-2xl shadow-blue-500/40">
                <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </motion.div>

            {/* Top Center: App Icons */}
            <motion.div
              className="absolute left-1/2 top-6 sm:top-12 -translate-x-1/2 hidden md:block"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              style={{
                animation: 'float 5s ease-in-out infinite 0.5s'
              }}
            >
              <div className="rounded-2xl bg-white p-4 shadow-2xl shadow-slate-900/10">
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500" />
                  <div className="h-8 w-8 rounded-full bg-slate-800" />
                  <div className="h-8 w-8 rounded-full bg-slate-800" />
                  <div className="h-8 w-8 rounded-full bg-slate-800" />
                </div>
              </div>
            </motion.div>

            {/* Top Right: Action Items Card */}
            <motion.div
              className="absolute right-4 top-12 sm:right-8 sm:top-20 w-64 sm:w-72 rotate-[8deg] hidden xl:block"
              initial={{ opacity: 0, y: -20, rotate: 12 }}
              animate={{ opacity: 1, y: 0, rotate: 8 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              style={{
                animation: 'float 7s ease-in-out infinite 1s'
              }}
            >
              <div className="rounded-2xl bg-white p-5 shadow-2xl shadow-slate-900/10">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Action Items
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">Review Quarterly Results</div>
                    <div className="mt-1 text-sm text-slate-600">Marketing team presentation</div>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="flex items-center gap-1 text-cyan-600">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Due: Next Week
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Center: Main Headline */}
            <div className="relative z-10 mx-auto mt-16 sm:mt-24 max-w-4xl text-center">
              <motion.h1
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight text-slate-900"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
              >
                Transform meetings into
                <br />
                <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 bg-clip-text text-transparent">
                  actionable insights
                </span>
              </motion.h1>
              <motion.p
                className="mx-auto mt-4 sm:mt-6 max-w-2xl text-base sm:text-lg md:text-xl text-slate-600 px-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                Efficiently analyze meeting transcripts and generate comprehensive summaries with AI-powered intelligence.
              </motion.p>
              <motion.div
                className="mt-8 sm:mt-10 flex items-center justify-center gap-4 px-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                <button
                  onClick={handleUploadButtonClick}
                  disabled={isLoading}
                  className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold text-white shadow-2xl shadow-blue-500/40 transition hover:shadow-2xl hover:shadow-blue-500/60 disabled:opacity-70"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Processing...</span>
                    </div>
                  ) : (
                    <>
                      <span className="relative z-10">Upload transcript</span>
                      <div className="absolute inset-0 -z-0 bg-gradient-to-r from-cyan-500 to-blue-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    </>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".vtt"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
              </motion.div>
              {error && (
                <motion.p
                  className="mt-4 text-sm text-red-600"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {error}
                </motion.p>
              )}
              {isLoading && <LoadingMessages />}
            </div>

            {/* Bottom Left: Analytics Widget */}
            <motion.div
              className="absolute bottom-8 left-4 sm:bottom-16 sm:left-12 w-64 sm:w-80 hidden lg:block"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              style={{
                animation: 'float 6.5s ease-in-out infinite 1.5s'
              }}
            >
              <div className="rounded-2xl bg-white p-6 shadow-2xl shadow-slate-900/10">
                <div className="mb-4 text-sm font-semibold text-slate-900">Meeting Analytics</div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Action Items</span>
                    <span className="text-2xl font-bold text-blue-600">12</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Participants</span>
                    <span className="text-2xl font-bold text-cyan-600">8</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Duration</span>
                    <span className="text-2xl font-bold text-purple-600">45m</span>
                  </div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-3/4 bg-gradient-to-r from-blue-500 to-cyan-500" />
                </div>
              </div>
            </motion.div>

            {/* Bottom Right: Integrations */}
            <motion.div
              className="absolute bottom-12 right-4 sm:bottom-20 sm:right-16 hidden xl:block"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              style={{
                animation: 'float 5.5s ease-in-out infinite 2s'
              }}
            >
              <div className="rounded-2xl bg-white p-6 shadow-2xl shadow-slate-900/15">
                <div className="mb-3 text-sm font-semibold text-slate-900">6 Thinking Hats Analysis</div>
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-pink-500 shadow-lg shadow-red-500/30">
                    <span className="text-2xl font-bold text-white">R</span>
                  </div>
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg shadow-yellow-500/30">
                    <span className="text-2xl font-bold text-white">Y</span>
                  </div>
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 shadow-lg shadow-green-500/30">
                    <span className="text-2xl font-bold text-white">G</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.section>
      )}
    </main>
  );
}
