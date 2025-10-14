"use client";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface MeetingDashboardProps {
  data: PipelineResponse;
}

export function MeetingDashboard({ data }: MeetingDashboardProps) {
  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Meeting Header */}
      <MeetingHeader details={data.meeting_details} />

      {/* Timeline Bar */}
      <TimelineBar
        duration={data.meeting_details.duration_ms}
        chapters={data.chapters}
        segments={data.segment_summaries}
      />

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="chapters">Chapters</TabsTrigger>
          <TabsTrigger value="tasks">Tasks & Items</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="decisions">Decisions</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MeetingSummary summary={data.collective_summary.collective_summary} />
            <MentionsCounter whoDidWhat={data.items.who_did_what} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <AchievementsList achievements={data.items.achievements} />
            <BlockersList blockers={data.items.blockers} />
            <DeadlinesList tasks={data.items.tasks} />
          </div>
        </TabsContent>

        {/* Chapters Tab */}
        <TabsContent value="chapters" className="space-y-6">
          <ChaptersList chapters={data.chapters} />
        </TabsContent>

        {/* Tasks & Items Tab */}
        <TabsContent value="tasks" className="space-y-6">
          <TasksList tasks={data.items.tasks} whoDidWhat={data.items.who_did_what} />
        </TabsContent>

        {/* People Tab */}
        <TabsContent value="people" className="space-y-6">
          <HatSystem
            hats={data.items.hats}
            participants={data.meeting_details.participants}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AchievementsList achievements={data.items.achievements} />
            <BlockersList blockers={data.items.blockers} />
          </div>
        </TabsContent>

        {/* Decisions Tab */}
        <TabsContent value="decisions" className="space-y-6">
          <DecisionDiagram decisions={data.items.decisions} />
          <DecisionsList decisions={data.items.decisions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
