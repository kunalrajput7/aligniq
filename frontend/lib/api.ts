import { PipelineResponse } from '@/types/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

export async function uploadAndSummarize(file: File): Promise<PipelineResponse> {
  const formData = new FormData();
  formData.append('file', file);

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

export async function checkHealth(): Promise<{ status: string; ollama_api_key_set: boolean }> {
  const response = await fetch(`${API_URL}/health`);

  if (!response.ok) {
    throw new APIError(response.status, 'Health check failed');
  }

  return response.json();
}
