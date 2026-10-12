// contexts/zn-auth-context.tsx
// ZN session provider (Phase 2 foundation). PARALLEL to the legacy AuthContext —
// nothing here imports Base44. Legacy screens keep working until Phase 3 flips
// app/_layout.tsx to this provider and deletes the old one (D-6 housekeeping).
//
// Lifecycle implemented per docs/audit/AUTH_AND_TENANCY.md:
//   restore → login(password [,OTP when flag+backend ready]) → refresh-on-401
//   → logout wipe-all → onSessionExpired cleanup.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';

import { assertEnv, ENV } from '@/lib/env';
import { initApiClient } from '@/lib/api/client';
import { secureStorage } from '@/lib/storage/secure';
import { identityService, isPendingOtp } from '@/lib/api/services/identity';
import type { ApiError, IdentityUser, LoginResponseActive } from '@/lib/api/types';

export type ZnAuthStatus = 'restoring' | 'signed-out' | 'pending-otp' | 'authenticated';

interface ZnAuthContextValue {
  status: ZnAuthStatus;
  user: IdentityUser | null;
  activeTenantId: string | null;
  /** Placeholder until /portal/guardian/me lands (Phase 2B); set from env in dev. */
  setActiveTenantId: (id: string | null) => void;
  login: (email: string, password: string) => Promise<{ ok: boolean; needsOtp?: boolean; error?: ApiError }>;
  completeOtpLogin: (tokens: LoginResponseActive) => Promise<void>;
  logout: () => Promise<void>;
}

const ZnAuthContext = createContext<ZnAuthContextValue | null>(null);

export function ZnAuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ZnAuthStatus>('restoring');
  const [user, setUser] = useState<IdentityUser | null>(null);
  const tenantRef = useRef<string | null>(ENV.defaultTenantId);
  const [activeTenantId, setActiveTenantIdState] = useState<string | null>(ENV.defaultTenantId);

  const router = useRouter();
  const segments = useSegments();

  // Wire the API client once; token getter reads SecureStore so refresh rotation
  // is picked up without re-rendering the tree.
  useEffect(() => {
    assertEnv();
    initApiClient(
      () => secureStorage.getAccessToken(),
      () => tenantRef.current,
      { onSessionExpired: () => void handleSessionExpired() },
    );
    void restoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restoreSession = useCallback(async () => {
    const access = await secureStorage.getAccessToken();
    const refresh = await secureStorage.getRefreshToken();
    if (!access && !refresh) {
      setStatus('signed-out');
      return;
    }
    // Probe with the verified identity endpoint; client auto-refreshes on 401.
    // Response is FLAT (IdentityMeResponse) — mapped to IdentityUser by the service (Phase 2 correction).
    const probe = await identityService.me();
    if (!probe.ok && probe.error.kind === 'unauthorized') {
      await secureStorage.clearAll();
      setUser(null);
      setStatus('signed-out');
      return;
    }
    if (probe.ok && probe.data.id) {
      setUser(probe.data);
      setStatus('authenticated');
    } else {
      // Network/server issue during restore: stay signed-out but don't wipe tokens
      // — next launch or pull-to-refresh can retry. UI shows a retry affordance.
      setStatus('signed-out');
    }
  }, []);

  async function handleSessionExpired() {
    await secureStorage.clearAll();
    setUser(null);
    setActiveTenantIdState(null);
    tenantRef.current = null;
    setStatus('signed-out');
  }

  const setActiveTenantId = useCallback((id: string | null) => {
    // Tenant switch MUST drop cached data (AUTH_AND_TENANCY §tenant switching).
    tenantRef.current = id;
    setActiveTenantIdState(id);
  }, []);

  const persistSession = useCallback(async (r: LoginResponseActive) => {
    await secureStorage.setTokens(r.accessToken, r.refreshToken);
    // Verified v1.1.0 login response carries NO user object — hydrate from the
    // server-verified identity probe (also validates the freshly issued token).
    const me = await identityService.me();
    setUser(me.ok ? me.data : (r.user ?? null));
    setStatus('authenticated');
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await identityService.login({
        email,
        password,
        ...(ENV.otpActivationEnabled ? { deviceId: 'mobile-device-pending-id' } : {}),
      });
      if (!res.ok) return { ok: false, error: res.error };

      if (isPendingOtp(res.data)) {
        // ADR-0060 branch: hold otpToken in memory only (never persisted).
        pendingOtpRef.current = res.data.otpToken;
        setStatus('pending-otp');
        return { ok: true, needsOtp: true };
      }
      await persistSession(res.data);
      return { ok: true };
    },
    [persistSession],
  );

  const pendingOtpRef = useRef<string | null>(null);

  const completeOtpLogin = useCallback(
    async (tokens: LoginResponseActive) => {
      pendingOtpRef.current = null;
      await persistSession(tokens);
    },
    [persistSession],
  );

  const logout = useCallback(async () => {
    await identityService.logout();
    await secureStorage.clearAll();
    setUser(null);
    pendingOtpRef.current = null;
    setStatus('signed-out');
  }, []);

  // Route guard: unauthenticated users belong in (auth); authenticated in tabs/portal.
  useEffect(() => {
    if (status === 'restoring') return;
    const inAuthGroup = segments[0] === '(auth)';
    if (status !== 'authenticated' && !inAuthGroup) router.replace('/(auth)/student-login');
    if (status === 'authenticated' && inAuthGroup) router.replace('/(tabs)');
  }, [status, segments, router]);

  const value = useMemo<ZnAuthContextValue>(
    () => ({
      status,
      user,
      activeTenantId,
      setActiveTenantId,
      login,
      completeOtpLogin,
      logout,
    }),
    [status, user, activeTenantId, setActiveTenantId, login, completeOtpLogin, logout],
  );

  return <ZnAuthContext.Provider value={value}>{children}</ZnAuthContext.Provider>;
}

export function useZnAuth(): ZnAuthContextValue {
  const ctx = useContext(ZnAuthContext);
  if (!ctx) throw new Error('useZnAuth must be used inside <ZnAuthProvider>');
  return ctx;
}
