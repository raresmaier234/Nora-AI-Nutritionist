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
  if (data && typeof data === 'object' && 'detail' in data) {
    const detail = (data as { detail: unknown }).detail;
    if (typeof detail === 'string') return detail;
  }
  return undefined;
}

/**
 * path must start with '/' and must NOT include the /api/v1 prefix, e.g. '/health'.
 * The prefix is appended here, once, so every caller stays version-agnostic.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const url = `${API_BASE_URL}${API_VERSION_PREFIX}${path}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
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
