// __tests__/use-api.test.ts — Phase 2 acceptance: loading/success/empty/error/retry states.
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useApi } from '@/hooks/use-api';
import type { ApiResult } from '@/lib/api/types';

describe('useApi', () => {
  it('transitions loading → success', async () => {
    const fetcher = jest.fn(async (): Promise<ApiResult<number[]>> => ({ ok: true, data: [1, 2] }));
    const { result } = renderHook(() => useApi(fetcher));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([1, 2]);
    expect(result.current.error).toBeNull();
    expect(result.current.isEmpty).toBe(false);
  });

  it('flags empty arrays for EmptyState UI', async () => {
    const { result } = renderHook(() =>
      useApi(async (): Promise<ApiResult<number[]>> => ({ ok: true, data: [] })),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.data).toEqual([]);
  });

  it('surfaces normalized errors and retries', async () => {
    let fail = true;
    const fetcher = jest.fn(async (): Promise<ApiResult<string>> => {
      if (fail) return { ok: false, error: { kind: 'network', message: 'Network unavailable.' } };
      return { ok: true, data: 'ok' };
    });
    const { result } = renderHook(() => useApi(fetcher));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.kind).toBe('network');
    expect(result.current.data).toBeNull();

    fail = false;
    act(() => result.current.retry());
    // Assert on the NEWEST error first — a previous test's pending retry can land
    // an error update into this render pass; `error` is not part of that race.
    await waitFor(() => expect(result.current.data).toBe('ok'));
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps previous data when a refresh fails (stale-while-error)', async () => {
    let shouldFail = false;
    const fetcher = jest.fn(async (): Promise<ApiResult<string>> =>
      shouldFail ? { ok: false, error: { kind: 'server', message: 'boom' } } : { ok: true, data: 'first' },
    );
    const { result } = renderHook(() => useApi(fetcher));
    await waitFor(() => expect(result.current.data).toBe('first'));

    shouldFail = true;
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.data).toBe('first'); // retained, not clobbered
  });

  it('drops stale results when deps change mid-flight (latest-wins)', async () => {
    const resolvers: Array<(r: ApiResult<string>) => void> = [];
    let calls = 0;
    const fetcher = jest.fn(async (): Promise<ApiResult<string>> => {
      calls += 1;
      if (calls === 1) {
        return new Promise<ApiResult<string>>((res) => {
          resolvers.push(res);
        });
      }
      return { ok: true, data: 'second' };
    });

    const { result, rerender } = renderHook(({ d }: { d: number }) => useApi(fetcher, [d]), {
      initialProps: { d: 0 },
    });
    // second dep change starts a newer run before the first resolves
    rerender({ d: 1 });
    await waitFor(() => expect(result.current.data).toBe('second'));

    resolvers[0]!({ ok: true, data: 'STALE' });
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.data).toBe('second'); // stale write dropped
  });
});
