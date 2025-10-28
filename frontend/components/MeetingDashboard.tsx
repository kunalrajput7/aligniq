"use client";

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PipelineResponse } from '@/types/api';
import { MeetingHeader } from './dashboard/MeetingHeader';
import { ChaptersList } from './dashboard/ChaptersList';
import { HatSystem } from './dashboard/HatSystem';
import { AchievementsList } from './dashboard/AchievementsList';
import { BlockersList } from './dashboard/BlockersList';
import { DeadlinesList } from './dashboard/DeadlinesList';
import { DeadlinesCard } from './dashboard/DeadlinesCard';
import { MindmapCanvas } from './dashboard/MindmapCanvas';
import { LayoutDashboard, BookOpen, Network } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface MeetingDashboardProps {
  data: PipelineResponse;
}

const sections = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'chapters', label: 'Chapters', icon: BookOpen },
  { id: 'mindmap', label: 'Mindmap', icon: Network },
];

export function MeetingDashboard({ data }: MeetingDashboardProps) {
  const [activeSection, setActiveSection] = useState('overview');

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

  return (
    <div className="container mx-auto py-8">
      {/* Meeting Header */}
      <div className="mb-8">
        <MeetingHeader details={meetingDetails} />
      </div>

      {/* 3-Column Layout */}
      <div className="flex gap-6">
        {/* Left Sidebar - Navigation */}
        <aside className="w-64 flex-shrink-0">
          <div className="sticky top-8 space-y-2">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                    activeSection === section.id
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
        </aside>

        {/* Center Content Area */}
        <main className="flex-1 min-w-0">
          {/* Overview Section */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              {/* Meeting Summary with Markdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Meeting Summary</CardTitle>
                </CardHeader>
                <CardContent>
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

              {/* Deadlines - Full Width Row */}
              <DeadlinesCard tasks={collectiveSummary?.action_items || []} />

              {/* Achievements, Blockers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AchievementsList achievements={collectiveSummary?.achievements || []} />
                <BlockersList blockers={collectiveSummary?.blockers || []} />
              </div>

              {/* Hats System - Full Width Row */}
              <HatSystem
                hats={data?.hats || []}
                participants={meetingDetails?.participants || []}
              />
            </div>
          )}

          {/* Chapters Section */}
          {activeSection === 'chapters' && (
            <div className="space-y-6">
              <ChaptersList chapters={data?.chapters || []} />
            </div>
          )}

          {/* Mindmap Section */}
          {activeSection === 'mindmap' && (
            <div>
              <MindmapCanvas mindmap={data?.mindmap || { center_node: { id: 'root', label: 'Meeting', type: 'root' }, nodes: [], edges: [] }} />
            </div>
          )}
        </main>

        {/* Right Sidebar - To-Dos (Hidden on Mindmap) */}
        {activeSection !== 'mindmap' && (
          <aside className="w-80 flex-shrink-0">
            <div className="sticky top-8">
              <DeadlinesList tasks={collectiveSummary?.action_items || []} />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
