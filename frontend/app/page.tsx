"use client";

import { useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { MeetingDashboard } from '@/components/MeetingDashboard';
import { uploadAndSummarize, APIError } from '@/lib/api';
import { PipelineResponse } from '@/types/api';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Sparkles } from 'lucide-react';

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PipelineResponse | null>(null);

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
  };

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="bg-white/90 dark:bg-slate-900/80 border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary/90 rounded-md flex items-center justify-center shadow-sm">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold leading-tight">Meeting Summarizer</h1>
                <p className="text-xs text-muted-foreground">AI-powered meeting intelligence</p>
              </div>
            </div>
            {data && (
              <Button onClick={handleReset} variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                New Analysis
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-2">
        {!data ? (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="w-full max-w-2xl">
              <div className="text-center mb-8">
                <h2 className="text-4xl font-bold mb-4">Welcome!</h2>
                <p className="text-lg text-muted-foreground">
                  Upload your meeting transcript to get started with AI-powered analysis
                </p>
              </div>
              <FileUpload onFileSelect={handleFileSelect} isLoading={isLoading} />
              {error && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <MeetingDashboard data={data} />
        )}
      </div>

    </main>
  );
}
