// hooks/use-api.ts
// Minimal data-fetching hook for the Phase 2 foundation (TARGET_ARCHITECTURE.md §3,
// NEW-5: online-only — NO persisted cache; in-memory state only).
//
// Deliberately dependency-free (no react-query install authorized): provides the
// four required UI states from the audit (loading / success / empty / error) plus
// manual retry and refresh. Server-state invalidation is by remount or explicit
// refetch; tenant-switch purge is handled by callers dropping keys (AUTH_AND_TENANCY).
//
// ApiResult-returning functions are consumed here so components never see raw
// ApiError unions — they get `data | null` + a normalized `error`.

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ApiError, ApiResult } from '@/lib/api/types';

export interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  /** True when the last successful fetch returned an empty array — drives EmptyState UI. */
  isEmpty: boolean;
}

export interface UseApiActions {
  /** Manual retry after error (same params). Safe to call during loading (ignored). */
  retry: () => void;
  /** Force refetch (pull-to-refresh). Runs even during loading; latest result wins. */
  refresh: () => void;
}

type Fetcher<T> = () => Promise<ApiResult<T>>;

export function useApi<T>(fetcher: Fetcher<T>, deps: readonly unknown[] = []): UseApiState<T> & UseApiActions {
  const [state, setState] = useState<UseApiState<T>>({ data: null, loading: true, error: null, isEmpty: false });

  // Latest-wins guard: each run gets an id; only the newest run may write state.
  const runRef = useRef(0);
  const mountedRef = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    const myRun = ++runRef.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetcherRef.current();
      if (myRun !== runRef.current || !mountedRef.current) return; // stale run
      if (res.ok) {
        setState({
          data: res.data,
          loading: false,
          error: null,
          isEmpty: Array.isArray(res.data) && res.data.length === 0,
        });
      } else {
        // Keep previous data on REFRESH errors (stale-while-error UX), clear on first load.
        setState((prev) => ({
          data: prev.data,
          loading: false,
          error: res.error,
          isEmpty: prev.data !== null && Array.isArray(prev.data) && prev.data.length === 0,
        }));
      }
    } catch (e: unknown) {
      if (myRun !== runRef.current || !mountedRef.current) return;
      setState((prev) => ({
        ...prev,
        loading: false,
        error: { kind: 'unknown', status: undefined, message: e instanceof Error ? e.message : 'Unexpected client error.' },
      }));
    }
  }, []);

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps); // caller-supplied deps drive refetch (e.g. [tenantId, studentId])

  const retry = useCallback(() => {
    void run();
  }, [run]);

  const refresh = useCallback(() => {
    void run();
  }, [run]);

  return { ...state, retry, refresh };
}
