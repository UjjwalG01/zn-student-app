// lib/api/client.ts
// Central typed API client for the ZN backend (Phase 2, docs/audit/TARGET_ARCHITECTURE.md §3).
// Responsibilities:
//  - bearer injection + explicit tenantId convention (ADR-0004)
//  - single-flight refresh on 401 with rotating token persistence
//  - request timeout + cancellation
//  - error normalization into the ApiError union
//  - NO logging of tokens or response bodies containing PII

import { ENV } from '../env';
import { secureStorage } from '../storage/secure';
import type { ApiError, ApiResult, RefreshResponse } from './types';

const DEFAULT_TIMEOUT_MS = 15_000;

type TokenProvider = () => Promise<string | null>;
type TenantProvider = () => string | null;

interface ClientHooks {
  /** Called when refresh fails permanently — AuthContext should sign out. */
  onSessionExpired: () => void;
}

export class ApiClient {
  private getAccessToken: TokenProvider;
  private getTenantId: TenantProvider;
  private hooks: ClientHooks;

  /** Single-flight refresh: concurrent 401s share one refresh promise. */
  private refreshPromise: Promise<boolean> | null = null;

  constructor(
    getAccessToken: TokenProvider,
    getTenantId: TenantProvider,
    hooks: ClientHooks,
  ) {
    this.getAccessToken = getAccessToken;
    this.getTenantId = getTenantId;
    this.hooks = hooks;
  }

  // -- public verbs ---------------------------------------------------------

  async get<T>(path: string, opts?: RequestOptions): Promise<ApiResult<T>> {
    return this.request<T>('GET', path, undefined, opts);
  }

  async post<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<ApiResult<T>> {
    return this.request<T>('POST', path, body, opts);
  }

  // -- core ------------------------------------------------------------------

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body: unknown,
    opts: RequestOptions = {},
    isRetry = false,
  ): Promise<ApiResult<T>> {
    const url = `${ENV.apiUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    if (opts.signal) {
      opts.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = await this.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e: unknown) {
      clearTimeout(timeout);
      if (controller.signal.aborted) {
        return { ok: false, error: apiError('timeout', 'Request timed out. Pull to retry.') };
      }
      return { ok: false, error: apiError('network', 'Network unavailable. Check your connection.') };
    }
    clearTimeout(timeout);

    // 401 → attempt exactly one transparent refresh, then replay once.
    if (res.status === 401 && !isRetry && !opts.skipRefresh) {
      const refreshed = await this.refresh();
      if (refreshed) return this.request<T>(method, path, body, opts, true);
      this.hooks.onSessionExpired();
      return { ok: false, error: await this.toApiError(res, 'unauthorized') };
    }

    if (!res.ok) {
      return { ok: false, error: await this.toApiError(res, statusKind(res.status)) };
    }

    if (res.status === 204) return { ok: true, data: undefined as T };
    try {
      const data = (await res.json()) as T;
      return { ok: true, data };
    } catch {
      return { ok: false, error: apiError('unknown', 'Malformed response from server.') };
    }
  }

  // -- refresh lifecycle -------------------------------------------------------

  /** Rotating refresh per ADR-0003. Returns false on permanent failure. */
  async refresh(): Promise<boolean> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      try {
        const refreshToken = await secureStorage.getRefreshToken();
        if (!refreshToken) return false;
        const res = await fetch(`${ENV.apiUrl}/identity/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const json = (await res.json()) as RefreshResponse;
        if (!json?.accessToken || !json?.refreshToken) return false;
        await secureStorage.setTokens(json.accessToken, json.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        // Clear the slot BEFORE resolving so callers chained on the shared
        // promise don't re-enter a stale (already-settling) promise.
        this.refreshPromise = null;
      }
    })();
    return this.refreshPromise;
  }

  // -- error normalization -----------------------------------------------------

  private async toApiError(res: Response, kind: ApiError['kind']): Promise<ApiError> {
    let message: string | undefined;
    let fields: Record<string, string[]> | undefined;
    let requestId: string | undefined;
    try {
      const body = await res.json();
      if (typeof body?.message === 'string') message = body.message;
      if (Array.isArray(body?.message)) {
        // class-validator array style
        fields = collectFieldErrors(body.message);
        message = firstHumanMessage(body.message) ?? message;
      }
      if (typeof body?.error === 'string') message = message ?? body.error;
      if (typeof body?.requestId === 'string') requestId = body.requestId;
    } catch {
      /* non-JSON error body — fall through to generic text below */
    }
    const fallback: Record<ApiError['kind'], string> = {
      network: 'Network unavailable.',
      timeout: 'Request timed out.',
      unauthorized: 'Your session has expired. Please sign in again.',
      forbidden: "You don't have access to this information.",
      notfound: 'The requested record was not found.',
      conflict: 'This action conflicts with existing data.',
      validation: 'Some fields need correction.',
      'rate-limit': 'Too many attempts. Please wait a moment.',
      server: 'The server had a problem. Please try again shortly.',
      unknown: 'Something went wrong.',
    };
    return {
      kind,
      status: res.status,
      message: sanitize(message) ?? fallback[kind],
      ...(fields ? { fields } : {}),
      ...(requestId ? { requestId } : {}),
    };
  }
}

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Set for auth endpoints themselves (login/refresh) to avoid refresh recursion. */
  skipRefresh?: boolean;
}

// -- helpers -------------------------------------------------------------------

function statusKind(status: number): ApiError['kind'] {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'notfound';
  if (status === 409) return 'conflict';
  if (status === 400 || status === 422) return 'validation';
  if (status === 429) return 'rate-limit';
  if (status >= 500) return 'server';
  return 'unknown';
}

function apiError(kind: ApiError['kind'], message: string): ApiError {
  return { kind, message };
}

/** Never surface raw strings that could echo tokens/PII back into UI logs. */
function sanitize(msg?: string): string | undefined {
  if (!msg) return undefined;
  if (/token|secret|authorization|bearer/i.test(msg) && msg.length > 120) return undefined;
  return msg.slice(0, 300);
}

function collectFieldErrors(messages: unknown[]): Record<string, string[]> | undefined {
  const out: Record<string, string[]> = {};
  for (const m of messages) {
    if (typeof m === 'string') {
      const match = /^(\w+)\s/.exec(m);
      if (match) (out[match[1]] ??= []).push(m);
    }
  }
  return Object.keys(out).length ? out : undefined;
}

function firstHumanMessage(messages: unknown[]): string | undefined {
  const first = messages.find((m) => typeof m === 'string');
  return typeof first === 'string' ? first : undefined;
}

// -- singleton wiring ------------------------------------------------------------

let _client: ApiClient | null = null;

/**
 * Wired by AuthContext once session state providers exist (app/_layout.tsx mount).
 * Kept lazy so service modules can import `api` safely at module scope.
 */
export function initApiClient(getAccessToken: TokenProvider, getTenantId: TenantProvider, hooks: ClientHooks): ApiClient {
  _client = new ApiClient(getAccessToken, getTenantId, hooks);
  return _client;
}

export function getApiClient(): ApiClient {
  if (!_client) throw new Error('ApiClient not initialized — call initApiClient() from AuthProvider.');
  return _client;
}

/** Proxy-style accessor used by service modules: `api.get<T>(...)`. */
export const api = {
  get: <T>(p: string, o?: RequestOptions) => getApiClient().get<T>(p, o),
  post: <T>(p: string, b?: unknown, o?: RequestOptions) => getApiClient().post<T>(p, b, o),
};
