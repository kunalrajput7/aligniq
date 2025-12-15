"use client";

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import { PipelineResponse } from '@/types/api';
import { MeetingHeader } from './meeting_dashboard/MeetingHeader';
import { ChaptersList } from './meeting_dashboard/ChaptersList';
import { HatSystem } from './meeting_dashboard/HatSystem';
import { AchievementsList } from './meeting_dashboard/AchievementsList';
import { BlockersList } from './meeting_dashboard/BlockersList';
import { DeadlinesList } from './meeting_dashboard/DeadlinesList';
import { DeadlinesCard } from './meeting_dashboard/DeadlinesCard';
import { MindmapCanvas } from './meeting_dashboard/MindmapCanvas';
import { LayoutDashboard, BookOpen, Network, FileText } from 'lucide-react';
import { Card, CardContent } from './ui/card';

interface MeetingDashboardProps {
  data: PipelineResponse;
}

const sections = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'chapters', label: 'Chapters', icon: BookOpen },
  { id: 'mindmap', label: 'Mindmap', icon: Network },
];

// Animation variants for content transitions
const contentVariants = {
  hidden: {
    opacity: 0,
    y: 20,
    transition: { duration: 0.2 }
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1] as const
    }
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.2 }
  }
};

// Animation variants for staggered entrance
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },
};

const slideFromLeft = {
  hidden: { opacity: 0, x: -30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.6,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },
};

const slideFromRight = {
  hidden: { opacity: 0, x: 30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.6,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },
};

// Header animation variants for smooth show/hide
const headerVariants = {
  hidden: {
    opacity: 0,
    height: 0,
    marginBottom: 0,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1] as const
    }
  },
  visible: {
    opacity: 1,
    height: 'auto',
    marginBottom: 32,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1] as const
    }
  },
};

export function MeetingDashboard({ data }: MeetingDashboardProps) {
  const [activeSection, setActiveSection] = useState('overview');
  const isMindmap = activeSection === 'mindmap';

  // Enhanced safeguards for backward compatibility and undefined handling
  const collectiveSummary = data?.collective_summary || {
    narrative_summary: "",
    action_items: [],
    achievements: [],
    blockers: []
  };
  const meetingDetails = data?.meeting_details || {
    title: "Meeting",
    date: "",
    duration_minutes: 0,
    participants: []
  };

  const scrollAreaClass =
    'custom-scrollbar pr-2 h-[calc(100vh-220px)] overflow-y-auto';

  return (
    <motion.div
      className={isMindmap ? 'mx-auto w-full px-6 py-5' : 'container mx-auto py-5'}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Meeting Header with smooth transition */}
      <AnimatePresence mode="wait">
        {!isMindmap && (
          <motion.div
            key="header"
            variants={headerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <MeetingHeader details={meetingDetails} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3-Column Layout */}
      <div className={`flex gap-4 ${isMindmap ? 'items-stretch' : ''}`}>
        {/* Left Sidebar - Navigation */}
        <motion.aside className="w-44 flex-shrink-0" variants={slideFromLeft}>
          <div className="space-y-2">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${activeSection === section.id
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'bg-card hover:bg-accent text-card-foreground hover:text-accent-foreground'
                    }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium">{section.label}</span>
                </button>
              );
            })}
          </div>
        </motion.aside>

        {/* Center Content Area with AnimatePresence for smooth transitions */}
        <main
          className={`flex-1 min-w-0 ${isMindmap ? 'max-w-full' : 'max-w-4xl'}`}
        >
          <AnimatePresence mode="wait">
            {/* Overview Section */}
            {activeSection === 'overview' && (
              <motion.div
                key="overview"
                className={`${scrollAreaClass} space-y-5`}
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {/* Meeting Summary with Markdown */}
                <motion.div variants={itemVariants}>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-6 w-6" />
                    <h2 className="text-2xl font-bold">Meeting Summary</h2>
                  </div>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="prose prose-slate prose-lg max-w-none dark:prose-invert
                        prose-headings:font-bold prose-headings:tracking-tight
                        prose-h1:text-2xl prose-h1:mt-8 prose-h1:mb-4
                        prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-h2:border-b prose-h2:border-border prose-h2:pb-2
                        prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
                        prose-p:text-base prose-p:leading-relaxed prose-p:my-4 prose-p:text-foreground
                        prose-strong:font-semibold prose-strong:text-foreground
                        prose-em:italic prose-em:text-muted-foreground
                        prose-ul:list-disc prose-ul:my-4 prose-ul:pl-6 prose-ul:space-y-2
                        prose-ol:list-decimal prose-ol:my-4 prose-ol:pl-6 prose-ol:space-y-2
                        prose-li:text-base prose-li:leading-relaxed prose-li:text-foreground
                        prose-li:marker:text-primary
                        prose-code:text-sm prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                        prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-lg
                        prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:italic
                        prose-hr:border-border prose-hr:my-8">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {collectiveSummary?.narrative_summary || "No summary available"}
                        </ReactMarkdown>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Deadlines - Full Width Row */}
                <motion.div variants={itemVariants}>
                  <DeadlinesCard tasks={collectiveSummary?.action_items || []} />
                </motion.div>

                {/* Achievements, Blockers */}
                <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-5" variants={itemVariants}>
                  <AchievementsList achievements={collectiveSummary?.achievements || []} />
                  <BlockersList blockers={collectiveSummary?.blockers || []} />
                </motion.div>

                {/* Hats System - Full Width Row */}
                <motion.div variants={itemVariants}>
                  <HatSystem
                    hats={data?.hats || []}
                    participants={meetingDetails?.participants || []}
                  />
                </motion.div>
              </motion.div>
            )}

            {/* Chapters Section */}
            {activeSection === 'chapters' && (
              <motion.div
                key="chapters"
                className={`${scrollAreaClass} space-y-5`}
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <ChaptersList chapters={data?.chapters || []} />
              </motion.div>
            )}

            {/* Mindmap Section */}
            {activeSection === 'mindmap' && (
              <motion.div
                key="mindmap"
                className="h-[calc(100vh-8rem)]"
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <MindmapCanvas mindmap={data?.mindmap || { center_node: { id: 'root', label: 'Meeting', type: 'root' }, nodes: [], edges: [] }} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Right Sidebar - To-Dos (Hidden on Mindmap) with smooth transition */}
        <AnimatePresence mode="wait">
          {activeSection !== 'mindmap' && (
            <motion.aside
              key="sidebar"
              className="w-80 flex-shrink-0"
              variants={slideFromRight}
              initial="hidden"
              animate="visible"
              exit="hidden"
            >
              <div className={`${scrollAreaClass}`}>
                <DeadlinesList tasks={collectiveSummary?.action_items || []} />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
