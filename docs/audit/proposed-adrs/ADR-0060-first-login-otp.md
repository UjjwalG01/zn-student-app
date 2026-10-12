# ADR-0060 — First-Login OTP Device Activation

## Status

**Accepted** — 2026-10-12, on the owner's instruction "APPROVE THE ADRS AND MOVE TO PHASE 2". Written on the owner's decisions D-1 ("email/password only but OTP for the first time") and NEW-3 = Option A. Acceptance authorizes the *design*; implementation occurs in backend Phase 2B alongside ADR-0059 routes under its own acceptance gate (docs/audit/IMPLEMENTATION_ROADMAP.md). No code has been written. Until these endpoints ship, the mobile app runs **password-only** with the OTP step stubbed behind a feature flag; no Base44 OTP stopgap is retained.

---

## Context

The legacy app authenticated via Base44 OTP/server functions. The ZN backend (v1.1.0) supports only email+password login (`POST /identity/login`, bcrypt + JWT access/refresh per ADR-0003) — verified: no OTP endpoint exists anywhere in `apps/api/src` or `docs/api/ENDPOINTS.md`.

The owner wants an extra assurance step when a guardian signs in from a device that has never been used before (shared family devices, weak passwords, PII-bearing portal). Option A keeps password as the primary credential and adds OTP as a second factor **only on unrecognized devices**; Option B (one-time activation token replacing first login) was rejected because it changes the recovery story and duplicates email plumbing without giving returning users any protection.

## Options Considered

- **A. Post-password OTP step on unenrolled devices.** *(Chosen — NEW-3 approved.)* Password verified first; if the device/session is not enrolled, an OTP is delivered to the user's registered email and must be verified before any session pair is issued.
- **B. One-time activation token instead of first password login.** Rejected: bypasses the existing bcrypt pipeline, complicates lost-token recovery, and cannot distinguish "new device" from "forgot password" cleanly.
- **C. TOTP authenticator apps.** Rejected for this phase: heavier UX for a school-guardian audience; may supersede later by amendment if demand arises.

## Decisions

### D1. Flow

```
POST /identity/login {email, password, deviceId}
 → 401 invalid credentials (existing behavior, unchanged)
 → 275-ish contract decision: response is one of
    { enrollment: "active" } → normal {accessToken, refreshToken} pair   (device recognized)
    { enrollment: "pending", otpToken }                                  (new device; NO session issued yet)
POST /identity/otp/send   (Bearer-less; authenticated by short-lived otpToken)
 → emails a 6-digit OTP to the user's registered email
POST /identity/otp/verify {otpToken, code, deviceId}
 → 200 { accessToken, refreshToken } and creates the device/session enrollment record
 → 4xx wrong/expired/consumed code (attempt counter incremented)
```

Exact status codes and field names are finalized during Phase 2B contract session; the security properties below are binding.

### D2. Security parameters (binding)

- OTP: 6 digits, cryptographically random, TTL ≤ 5 minutes, single-use, bound to `(user_id, otpToken, deviceId)`.
- Send rate limit: max 3 sends per user per hour; verify attempt limit: max 5 per OTP; both enforced server-side with lockout back-off.
- OTP stored hashed (same convention as refresh-token storage per ADR-0003 revocable-refresh design); never logged, never returned in responses.
- No session pair is issued before OTP verification on an unenrolled device — a leaked password alone cannot produce a working session.
- Delivery channel: email via the existing notification/email infrastructure. SMS is out of scope (cost/provider risk); can be added by amendment.

### D3. Enrollment records

- New table `device_enrollments (id, tenant_id?, user_id, device_id, label?, enrolled_at, last_seen_at, revoked_at NULL)` — exact tenancy treatment decided in Phase 2B schema review; users are global, enrollments are per-user.
- Logout offers "forget this device"; staff/admin cannot silently enroll devices on behalf of users.
- Revoking an enrollment forces re-verification on next login and revokes associated refresh tokens (reuses ADR-0003 revocation path).

### D4. Compatibility rules

- Existing web-app logins are unaffected: they always present a recognized browser session context; backend treats missing `deviceId` as "unenrolled" only for portal-scope clients, preserving current staff behavior (contract detail fixed in Phase 2B clarification session).
- Mobile feature-flag: `FEATURE_OTP_ACTIVATION` in the RN app gates the OTP screen; ships off until endpoints exist on staging.

## Consequences

- **Security:** positive — stolen-password-without-device attacks blocked for guardians; negative — email deliverability becomes an availability dependency for new devices; documented fallback: staff-assisted device reset.
- **Backend impact:** additive migration (`device_enrollments`, OTP store), two new endpoints, one extension to `/identity/login` response shape (backward-compatible branch). No change to existing staff auth flows' semantics.
- **Mobile impact:** login screen gains a conditional OTP step; AuthContext handles the intermediate `otpToken` state (never persisted to SecureStore beyond session lifetime of the pending flow).
- **Migration/rollback:** additive; rollback removes endpoints and leaves enrollment rows inert. Legacy Base44 OTP dependency is retired outright (no parallel authority).

## Testing Requirements (Phase 2B acceptance gate)

1. Recognized device → session issued without OTP; unknown device → `enrollment: pending`, **no tokens issued**.
2. OTP expiry, single-use replay rejection, wrong-code attempt limit, send rate limit.
3. Enrollment revoke → refresh tokens revoked → next login requires OTP.
4. Staff/web login regression suite green.
5. No OTP codes/tokens in logs or error envelopes (log-audit test).
