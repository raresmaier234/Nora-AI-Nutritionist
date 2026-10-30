import { endSession, getAccessToken, refreshAccessToken } from '@/services/auth/session';

import { API_BASE_URL, API_VERSION_PREFIX } from './config';
import type { ApiErrorKind } from './types';

const DEFAULT_TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly path: string;
  readonly cause?: unknown;

  constructor(params: { kind: ApiErrorKind; message: string; path: string; status?: number; cause?: unknown }) {
    super(params.message);
    this.name = 'ApiError';
    this.kind = params.kind;
    this.status = params.status;
    this.path = params.path;
    this.cause = params.cause;
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

function extractDetail(data: unknown): string | undefined {
  if (!data || typeof data !== 'object' || !('detail' in data)) return undefined;
  const detail = (data as { detail: unknown }).detail;
  if (typeof detail === 'string') return detail;
  // FastAPI's validation errors (422): [{ loc: ['body', 'targets', 'kcal'], msg: '…' }, …]
  if (Array.isArray(detail)) {
    const messages = detail.flatMap((d: { loc?: unknown; msg?: unknown }) => {
      if (typeof d?.msg !== 'string') return [];
      const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : undefined;
      return [typeof field === 'string' ? `${field}: ${d.msg}` : d.msg];
    });
    if (messages.length > 0) return messages.join('; ');
  }
  return undefined;
}

/**
 * path must start with '/' and must NOT include the /api/v1 prefix, e.g. '/health'.
 * The prefix is appended here, once, so every caller stays version-agnostic.
 *
 * Every request carries the signed-in user's Supabase access token as `Authorization: Bearer`.
 * If the API answers 401, the session is refreshed once and the request retried; if it's still
 * refused, the user is signed out (the app returns to sign-in) and the 401 is thrown.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const token = await getAccessToken();
  try {
    return await send<T>(path, options, token);
  } catch (err) {
    if (!token || !(err instanceof ApiError) || err.status !== 401) throw err;

    const refresh = await refreshAccessToken(token);
    if (refresh.status === 'unreachable') throw err;
    if (refresh.status === 'expired') {
      await endSession();
      throw err;
    }
    try {
      return await send<T>(path, options, refresh.token);
    } catch (retryErr) {
      if (retryErr instanceof ApiError && retryErr.status === 401) await endSession();
      throw retryErr;
    }
  }
}

/** One HTTP request: timeout, JSON in and out, and any failure as an ApiError. */
async function send<T>(path: string, options: ApiRequestOptions, token: string | null): Promise<T> {
  const { method = 'GET', body, headers, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const url = `${API_BASE_URL}${API_VERSION_PREFIX}${path}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError({ kind: 'timeout', message: `${method} ${path} timed out after ${timeoutMs}ms`, path, cause: err });
    }
    throw new ApiError({
      kind: 'network',
      message: `${method} ${path} failed: ${err instanceof Error ? err.message : String(err)}. Is the backend running and reachable at ${API_BASE_URL}?`,
      path,
      cause: err,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const rawText = await response.text();
  let data: unknown;
  if (rawText.length > 0) {
    try {
      data = JSON.parse(rawText);
    } catch (err) {
      throw new ApiError({
        kind: 'invalid_response',
        message: `${method} ${path} returned a non-JSON response (status ${response.status})`,
        path,
        status: response.status,
        cause: err,
      });
    }
  }

  if (!response.ok) {
    const kind: ApiErrorKind = response.status >= 500 ? 'http_server_error' : 'http_client_error';
    const detail = extractDetail(data);
    throw new ApiError({
      kind,
      message: `${method} ${path} failed with HTTP ${response.status}${detail ? `: ${detail}` : ''}`,
      path,
      status: response.status,
    });
  }

  return data as T;
}

/** A user-facing sentence for a failed request. */
export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.kind === 'network' || err.kind === 'timeout') return "Can't reach the server. Is the backend running?";
    if (err.status === 401) return 'Your session has ended. Please sign in again.';
    const detail = err.message.split(': ').slice(1).join(': ');
    return detail || `The server returned an error (${err.status ?? 'unknown'}).`;
  }
  return 'Something went wrong.';
}
