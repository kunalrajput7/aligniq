import { PipelineResponse } from '@/types/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

export interface UploadOptions {
  userId?: string;
  projectId?: string;
}

export async function uploadAndSummarize(
  file: File,
  options?: UploadOptions
): Promise<PipelineResponse> {
  const formData = new FormData();
  formData.append('file', file);

  if (options?.userId) {
    formData.append('user_id', options.userId);
  }

  if (options?.projectId) {
    formData.append('project_id', options.projectId);
  }

  const response = await fetch(`${API_URL}/summarize`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new APIError(response.status, error.detail || 'Failed to process file');
  }

  return response.json();
}

export async function checkHealth(): Promise<{ status: string; azure_ai_configured: boolean }> {
  const response = await fetch(`${API_URL}/health`);

  if (!response.ok) {
    throw new APIError(response.status, 'Health check failed');
  }

  return response.json();
}
