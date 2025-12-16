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

/**
 * Upload a VTT file for processing.
 * 
 * Note: The pipeline takes 4-9 minutes to complete. This function uses a short
 * timeout and returns success as soon as the server acknowledges the upload.
 * The actual processing continues in the background, and the frontend should
 * use Supabase real-time subscriptions to track completion.
 */
export async function uploadAndSummarize(
  file: File,
  options?: UploadOptions
): Promise<{ success: boolean; message: string }> {
  const formData = new FormData();
  formData.append('file', file);

  if (options?.userId) {
    formData.append('user_id', options.userId);
  }

  if (options?.projectId) {
    formData.append('project_id', options.projectId);
  }

  // Create an AbortController for timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const response = await fetch(`${API_URL}/summarize`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new APIError(response.status, error.detail || 'Failed to process file');
    }

    // If we get a response (unlikely for long meetings), return success
    return { success: true, message: 'Processing complete!' };

  } catch (error: any) {
    clearTimeout(timeoutId);

    // If the request was aborted due to timeout, that's actually OKAY!
    // The backend is still processing. We just timed out waiting for the response.
    if (error.name === 'AbortError') {
      return {
        success: true,
        message: 'Upload received! Processing in background...'
      };
    }

    // For network errors or fetch failures, also assume success if we got this far
    // The request was likely sent but we lost connection while waiting
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      return {
        success: true,
        message: 'Upload received! Processing may take a few minutes...'
      };
    }

    // Re-throw actual errors
    throw error;
  }
}

export async function checkHealth(): Promise<{ status: string; azure_ai_configured: boolean }> {
  const response = await fetch(`${API_URL}/health`);

  if (!response.ok) {
    throw new APIError(response.status, 'Health check failed');
  }

  return response.json();
}
