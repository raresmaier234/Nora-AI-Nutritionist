const DEFAULT_DEV_API_URL = 'http://127.0.0.1:8000';

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return stripTrailingSlash(fromEnv);

  if (__DEV__) {
    console.warn(
      '[api/config] EXPO_PUBLIC_API_URL is not set — falling back to ' +
        `${DEFAULT_DEV_API_URL}. Set it in .env.local (see documentation/api-integration.md).`
    );
  }
  return DEFAULT_DEV_API_URL;
}

/** Host + port only — no /api/v1 suffix. The versioned prefix is appended once, centrally, in client.ts. */
export const API_BASE_URL = resolveApiBaseUrl();

export const API_VERSION_PREFIX = '/api/v1';
