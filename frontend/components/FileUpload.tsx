"use client";

import { useState, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Upload, FileText, Loader2 } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

export function FileUpload({ onFileSelect, isLoading }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.vtt')) {
        setSelectedFile(file);
      } else {
        alert('Please upload a .vtt file');
      }
    }
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
    }
  }, []);

  const handleSubmit = () => {
    if (selectedFile) {
      onFileSelect(selectedFile);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-6 w-6" />
          Upload Meeting Transcript
        </CardTitle>
        <CardDescription>
          Upload a .vtt transcript file from Microsoft Teams to get started
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            dragActive ? 'border-primary bg-primary/5' : 'border-gray-300'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept=".vtt"
            onChange={handleChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isLoading}
          />

          <div className="space-y-4">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              {isLoading ? (
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
              ) : (
                <FileText className="h-6 w-6 text-primary" />
              )}
            </div>

            {selectedFile ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium">
                  Drop your .vtt file here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum file size: 10MB
                </p>
              </div>
            )}
          </div>
        </div>

        {selectedFile && !isLoading && (
          <Button
            onClick={handleSubmit}
            className="w-full mt-4"
            size="lg"
          >
            <Upload className="mr-2 h-4 w-4" />
            Analyze Meeting
          </Button>
        )}

        {isLoading && (
          <div className="mt-6 space-y-4">
            <div className="text-center">
              <p className="text-sm font-medium text-primary mb-2">
                Processing your meeting transcript...
              </p>
              <p className="text-xs text-muted-foreground">
                This may take a few minutes. Please don't close this window.
              </p>
            </div>

            {/* GIF Gallery */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="space-y-2">
                <div className="aspect-video bg-muted rounded-lg overflow-hidden border-2 border-primary/20">
                  <img
                    src="/loading/segment_summary.gif"
                    alt="Creating segment summaries"
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-xs text-center font-medium">Analyzing segments</p>
              </div>

              <div className="space-y-2">
                <div className="aspect-video bg-muted rounded-lg overflow-hidden border-2 border-primary/20">
                  <img
                    src="/loading/filtering_employee_input.gif"
                    alt="Filtering and processing"
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-xs text-center font-medium">Extracting insights</p>
              </div>

              <div className="space-y-2">
                <div className="aspect-video bg-muted rounded-lg overflow-hidden border-2 border-primary/20">
                  <img
                    src="/loading/tasks_todos.gif"
                    alt="Generating tasks and todos"
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-xs text-center font-medium">Creating action items</p>
              </div>
            </div>

            {/* Progress indicator */}
            <div className="flex items-center justify-center gap-2 pt-2">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-150" />
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-300" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
