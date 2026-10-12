// lib/api/services/identity.ts
// Identity service — verified existing routes (backend v1.1.0, docs/api/ENDPOINTS.md §1):
//   POST /identity/login    {email, password} → {accessToken, refreshToken, user}
//   POST /identity/refresh  {refreshToken}    → {accessToken, refreshToken}   (rotation)
//   POST /identity/logout   {refreshToken}    → 204                            (server-side revoke)
//   GET  /identity/me       → {id, email, fullName, isPlatformAdmin, sessionTimeoutMinutes}
// ADR-0060 OTP branch is typed in ../types but only reachable once Phase 2C ships it.

import { api } from '../client';
import { secureStorage } from '../../storage/secure';
import type { ApiResult, IdentityMeResponse, IdentityUser, LoginRequest, LoginResponse } from '../types';

/** Map the verified flat GET /identity/me payload into the client-normalized user. */
export function toIdentityUser(me: IdentityMeResponse): IdentityUser {
  return {
    id: me.id,
    email: me.email,
    name: me.fullName,
    isPlatformAdmin: me.isPlatformAdmin,
    sessionTimeoutMinutes: me.sessionTimeoutMinutes,
  };
}

export const identityService = {
  /** Password login. Verified v1.1.0 response is `{accessToken, refreshToken}` only (no `user`).
   *  `deviceId` optional until the OTP endpoints exist (feature-flagged, ADR-0060). */
  login(payload: LoginRequest): Promise<ApiResult<LoginResponse>> {
    return api.post<LoginResponse>('/identity/login', payload, { skipRefresh: true });
  },

  /** Server-verified identity probe. Used for session restore AND post-login user hydration. */
  async me(): Promise<ApiResult<IdentityUser>> {
    const res = await api.get<IdentityMeResponse>('/identity/me');
    if (!res.ok) return res; // ApiError passthrough preserves discriminated union
    return { ok: true, data: toIdentityUser(res.data) };
  },

  /**
   * Logout per AUTH_AND_TENANCY §2 step 6: best-effort server revocation of the
   * rotating refresh token (residual access bounded to the ≤15-min stateless
   * access window — NEW-6 policy), then ALWAYS wipe local credentials, even if
   * the request fails (offline users must not be stranded logged-in).
   */
  async logout(): Promise<void> {
    const refreshToken = await secureStorage.getRefreshToken().catch(() => null);
    if (refreshToken) {
      try {
        await api.post<void>('/identity/logout', { refreshToken }, { skipRefresh: true });
      } catch {
        /* best-effort; local wipe below is mandatory regardless */
      }
    }
    await secureStorage.clearAll();
  },
};

/** Type guard for the ADR-0060 pending branch. */
export function isPendingOtp(r: LoginResponse): r is Extract<LoginResponse, { enrollment: 'pending' }> {
  return (r as { enrollment?: string }).enrollment === 'pending';
}
