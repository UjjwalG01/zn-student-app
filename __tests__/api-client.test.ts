// Phase 2 acceptance tests for the central API client (NEW-6 session-token policy).
import { ApiClient } from '@/lib/api/client';
import * as SecureStore from 'expo-secure-store';

const store = (SecureStore as any).__store as Map<string, string>;

let fetchMock: jest.Mock;
beforeEach(() => {
  store.clear();
  fetchMock = jest.fn();
  (global as any).fetch = fetchMock;
});

function makeClient(hooks: Partial<{ onSessionExpired: () => void }> = {}) {
  return new ApiClient(
    async () => store.get('zn.accessToken') ?? null,
    () => 'tenant-1',
    { onSessionExpired: hooks.onSessionExpired ?? (() => {}) },
  );
}

const json = (status: number, body: unknown) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
} as Response);

describe('ApiClient auth behavior', () => {
  it('injects bearer token and tenantId on requests', async () => {
    store.set('zn.accessToken', 'A1');
    fetchMock.mockResolvedValueOnce(json(200, { id: 'u1' }));
    const c = makeClient();
    const r = await c.get('/identity/me');
    expect(r.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/identity/me');
    expect((init.headers as any).Authorization).toBe('Bearer A1');
  });

  it('on 401 performs single-flight rotating refresh then replays once', async () => {
    store.set('zn.accessToken', 'A-expired');
    store.set('zn.refreshToken', 'R1');
    let calls = 0;
    fetchMock.mockImplementation(async (url: string, init?: any) => {
      if (String(url).includes('/identity/refresh')) {
        calls++;
        // simulate concurrent consumers of the same refresh promise
        await new Promise((res) => setTimeout(res, 5));
        return json(200, { accessToken: 'A2', refreshToken: 'R2' });
      }
      return store.get('zn.accessToken') === 'A2'
        ? json(200, { id: 'u1' })
        : json(401, { message: 'expired' });
    });
    const c = makeClient();
    const [r1, r2] = await Promise.all([c.get('/identity/me'), c.get('/identity/me')]);
    expect(r1.ok && r2.ok).toBe(true);
    expect(calls).toBe(1); // ONE refresh for two concurrent 401s
    expect(store.get('zn.refreshToken')).toBe('R2'); // rotation persisted
  });

  it('refresh failure triggers onSessionExpired and returns unauthorized', async () => {
    store.set('zn.accessToken', 'A-bad');
    store.set('zn.refreshToken', 'R-revoked');
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes('/identity/refresh') ? json(401, {}) : json(401, {}),
    );
    const expired = jest.fn();
    const c = makeClient({ onSessionExpired: expired });
    const r = await c.get('/identity/me');
    expect(expired).toHaveBeenCalledTimes(1);
    expect(!r.ok && r.error.kind).toBe('unauthorized');
  });

  it('skipRefresh never attempts refresh (used by login/logout)', async () => {
    store.set('zn.refreshToken', 'R1');
    fetchMock.mockResolvedValueOnce(json(401, { message: 'bad credentials' }));
    const c = makeClient();
    await c.post('/identity/login', { email: 'a@b.c', password: 'x' }, { skipRefresh: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).not.toContain('/identity/refresh');
  });

  it('network failure normalizes to kind=network without crashing', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    const c = makeClient();
    const r = await c.get('/portal/guardian/students');
    expect(!r.ok && r.error.kind).toBe('network');
  });

  it('204 responses resolve ok with undefined data (logout path)', async () => {
    store.set('zn.accessToken', 'A1');
    store.set('zn.refreshToken', 'R1');
    fetchMock.mockResolvedValueOnce(json(204, undefined));
    const c = makeClient();
    const r = await c.post('/identity/logout', { refreshToken: 'R1' }, { skipRefresh: true });
    expect(r.ok).toBe(true);
  });
});
