import axios from 'axios';

/**
 * Extracts a human-readable error message from any thrown value.
 *
 * - Axios errors: includes HTTP status + the first API error detail from the response body
 * - Standard Error: returns .message
 * - Unknown: String(error)
 */
export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 'unknown status';
    const body = error.response?.data;
    // Most REST APIs (Klaviyo, Meta, GA4) return errors as { errors: [{ detail }] }
    const detail =
      body?.errors?.[0]?.detail ??
      body?.error?.message ??
      body?.message ??
      error.message;
    return `API error ${status}: ${detail}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
