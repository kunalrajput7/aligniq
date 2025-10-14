"use client";

import { useState } from 'react';
import { PipelineResponse } from '@/types/api';
import { MeetingHeader } from './dashboard/MeetingHeader';
import { MeetingSummary } from './dashboard/MeetingSummary';
import { ChaptersList } from './dashboard/ChaptersList';
import { TimelineBar } from './dashboard/TimelineBar';
import { HatSystem } from './dashboard/HatSystem';
import { DecisionDiagram } from './dashboard/DecisionDiagram';
import { MentionsCounter } from './dashboard/MentionsCounter';
import { TasksList } from './dashboard/TasksList';
import { DeadlinesList } from './dashboard/DeadlinesList';
import { DecisionsList } from './dashboard/DecisionsList';
import { AchievementsList } from './dashboard/AchievementsList';
import { BlockersList } from './dashboard/BlockersList';
import { LayoutDashboard, BookOpen, CheckSquare, Users, GitBranch } from 'lucide-react';

interface MeetingDashboardProps {
  data: PipelineResponse;
}

const sections = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'chapters', label: 'Chapters', icon: BookOpen },
  { id: 'tasks', label: 'Tasks & Items', icon: CheckSquare },
  { id: 'people', label: 'People', icon: Users },
  { id: 'decisions', label: 'Decisions', icon: GitBranch },
];

export function MeetingDashboard({ data }: MeetingDashboardProps) {
  const [activeSection, setActiveSection] = useState('overview');

  return (
    <div className="container mx-auto py-8">
      {/* Meeting Header */}
      <div className="mb-8">
        <MeetingHeader details={data.meeting_details} />
      </div>

      {/* Timeline Bar */}
      <div className="mb-8">
        <TimelineBar
          duration={data.meeting_details.duration_ms}
          chapters={data.chapters}
          segments={data.segment_summaries}
        />
      </div>

      {/* Main Content with Floating Sidebar */}
      <div className="flex gap-8">
        {/* Floating Sidebar Navigation */}
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

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          {/* Overview Section */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              <MeetingSummary summary={data.collective_summary.collective_summary} />

              <MentionsCounter
                whoDidWhat={data.items.who_did_what}
                participants={data.meeting_details.participants}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <AchievementsList achievements={data.items.achievements} />
                <BlockersList blockers={data.items.blockers} />
                <DeadlinesList tasks={data.items.tasks} />
              </div>
            </div>
          )}

          {/* Chapters Section */}
          {activeSection === 'chapters' && (
            <div className="space-y-6">
              <ChaptersList chapters={data.chapters} />
            </div>
          )}

          {/* Tasks & Items Section */}
          {activeSection === 'tasks' && (
            <div className="space-y-6">
              <TasksList tasks={data.items.tasks} whoDidWhat={data.items.who_did_what} />
            </div>
          )}

          {/* People Section */}
          {activeSection === 'people' && (
            <div className="space-y-6">
              <HatSystem
                hats={data.items.hats}
                participants={data.meeting_details.participants}
              />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AchievementsList achievements={data.items.achievements} />
                <BlockersList blockers={data.items.blockers} />
              </div>
            </div>
          )}

          {/* Decisions Section */}
          {activeSection === 'decisions' && (
            <div className="space-y-6">
              <DecisionDiagram decisions={data.items.decisions} />
              <DecisionsList decisions={data.items.decisions} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
