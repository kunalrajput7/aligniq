"use client";

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PipelineResponse } from '@/types/api';
import { MeetingHeader } from './dashboard/MeetingHeader';
import { ChaptersList } from './dashboard/ChaptersList';
import { HatSystem } from './dashboard/HatSystem';
import { MentionsCounter } from './dashboard/MentionsCounter';
import { AchievementsList } from './dashboard/AchievementsList';
import { BlockersList } from './dashboard/BlockersList';
import { DeadlinesList } from './dashboard/DeadlinesList';
import { DeadlinesCard } from './dashboard/DeadlinesCard';
import { LayoutDashboard, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface MeetingDashboardProps {
  data: PipelineResponse;
}

const sections = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'chapters', label: 'Chapters', icon: BookOpen },
];

export function MeetingDashboard({ data }: MeetingDashboardProps) {
  const [activeSection, setActiveSection] = useState('overview');

  // Enhanced safeguards for backward compatibility and undefined handling
  const supplementary = data?.supplementary || { who_did_what: [], hats: [] };
  const collectiveSummary = data?.collective_summary || {
    narrative_summary: "",
    decisions: [],
    action_items: [],
    achievements: [],
    blockers: [],
    concerns: []
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
                  <div className="prose prose-slate max-w-none dark:prose-invert prose-headings:font-bold prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-lg prose-h3:mt-4 prose-h3:mb-2 prose-p:text-base prose-p:leading-relaxed prose-ul:my-3 prose-li:my-1 prose-strong:font-semibold prose-strong:text-foreground prose-em:italic">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {collectiveSummary?.narrative_summary || "No summary available"}
                    </ReactMarkdown>
                  </div>
                </CardContent>
              </Card>

              {/* Mentions Counter */}
              <MentionsCounter
                whoDidWhat={supplementary?.who_did_what || []}
                participants={meetingDetails?.participants || []}
              />

              {/* Deadlines - Full Width Row */}
              <DeadlinesCard tasks={collectiveSummary?.action_items || []} />

              {/* Achievements, Blockers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AchievementsList achievements={collectiveSummary?.achievements || []} />
                <BlockersList blockers={collectiveSummary?.blockers || []} />
              </div>

              {/* Hats System - Full Width Row */}
              <HatSystem
                hats={supplementary?.hats || []}
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
        </main>

        {/* Right Sidebar - To-Dos (Fixed) */}
        <aside className="w-80 flex-shrink-0">
          <div className="sticky top-8">
            <DeadlinesList tasks={collectiveSummary?.action_items || []} />
          </div>
        </aside>
      </div>
    </div>
  );
}
