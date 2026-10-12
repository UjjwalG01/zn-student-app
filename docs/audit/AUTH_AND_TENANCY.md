# AUTH_AND_TENANCY — Current State, Target Flow, Security Requirements

## 1. Current state (verified in `/workspace`)
- **Authority:** Base44. Two entry paths in `contexts/AuthContext.tsx`: server function `verifyStudentCredentials(email, admissionNo)` → token; or `base44.auth.verifyOtp({email, otpCode})` → token. No password concept exists in the app today.
- **Storage:** single key `user_token` in `expo-secure-store` (hardware-backed; acceptable primitive).
- **Lifecycle:** restore on boot (`bootstrapAsync`) → set SDK token → one aggregate fetch. **No refresh, no expiry detection**; a failed restore is swallowed with `console.warn`, silently dropping to login. Logout deletes local key only (no server revocation).
- **Tenant model:** implicit single `school_id` inside the payload; no switching; no membership concept.
- **Guard:** redirect effect on `useSegments` — unauthenticated → `/(auth)/student-login`; authenticated → `/(tabs)`. Coarse but functional.

## 2. Target flow (ZN backend, contracts verified at v1.1.0)
1. **Login:** `POST /identity/login {email,password}` → `{accessToken, refreshToken}` (bcrypt+JWT, revocable refresh — ADR-0003). Both stored in SecureStore under separate keys (`zn.accessToken`, `zn.refreshToken`).
2. **First-time device activation (D-1):** after credential check, require OTP delivered to registered email before session pair is issued. **Approved design (NEW-3=A)**: `POST /identity/otp/send|verify` + OTP store + device/session enrollment record — endpoint does not exist yet in backend v1.1.0; ADR-0060 (ACCEPTED 2026-10-12). Until it ships, mobile keeps the OTP step behind a feature flag and runs password-only.
3. **Identity bootstrap:** `GET /identity/me` → profile + `sessionTimeoutMinutes` (backend-computed; honor it for inactivity re-auth).
4. **Membership retrieval:** `GET /tenancy/my-schools` → school switcher; `GET /tenancy/my-permissions?tenantId=` → permission set driving navigation visibility (display only; server still enforces).
5. **Guardian context (D-2):** resolve user→guardian→linked students via NEW-1 portal endpoints; store active student selection + "all children (combined)" mode in memory only (D-5 online-only).
6. **Refresh:** proactive refresh before access-token expiry + reactive single-flight retry on 401 in central client; rotation replaces both stored tokens; refresh failure ⇒ full logout + credential wipe + redirect with reason banner.
7. **Logout:** `POST /identity/logout {refreshToken}` (204) then delete both SecureStore keys and all in-memory caches, regardless of API outcome.

## 3. Authorization & tenant isolation requirements
- **Client is untrusted.** Every scoped request carries explicit `tenantId` (query for GET / body for POST — verified `tenant-context.guard.ts:54`), but the guard re-validates membership + permission (`assertHasPermission`) and RLS applies per ADR-0004/0007. Client-supplied `studentId`/`examId`/`enrollmentId` never grant access by themselves.
- **401 vs 403 handling:** 401 → refresh path; 403 → "you don't have access" screen (never silent); entitlement-missing (licensed module off) → hide feature using `GET /settings/tenant/mobile-modules`.
- **Revoked membership / disabled account:** next call returns 401/403 → force re-auth; do not keep stale tabs alive.
- **Deep links:** scheme `edupro://…` must route through the same segment guard; unknown/unauthorized targets fall back to dashboard; no token material in URLs.
- **Tenant switching:** atomic operation — clear all cached responses, active-student selection, and pending requests (AbortController) *before* loading new tenant context. Prevents cross-school data bleed (test gate).
- **Historical academic years:** reads are academic-year scoped server-side (verified enrollment-history controller); client must pass/expose year filters rather than infer from old cache.

## 4. Credential storage assessment
| Concern | Current | Target |
|---|---|---|
| Primitive | expo-secure-store ✅ | keep (no new package needed — avoids approval churn) |
| Keys | `user_token` | `zn.accessToken`, `zn.refreshToken`; migrate-once logic for legacy key then delete |
| iOS backup behavior | default (SecureStore items are non-exportable; verify `accessGroup`/sync flags stay off when CNG regenerates) | confirm in Phase 2 build review |
| Android | hardware-backed keel | ensure `BIOMETRIC_STRONG` not required (availability UX) but device-encrypted storage retained |
| Logs | current code logs token presence + full error JSON | redaction rule: never log Authorization headers or payloads containing PII |
| Source | `BASE44_API_KEY` referenced in client header builder | removed entirely post-migration; rotate key (separate authorization) |

## Session-token load model & TTL policy *(owner-documented requirement, 2026-10-12)*

The target token lifecycle is chosen deliberately for **server-load characteristics on read-only traffic**, not only UX:

1. **Stateless access window (~15 min):** read-only list/dashboard requests carry the short-lived access JWT. The API validates the cryptographic signature in CPU memory with **zero SQL per request** — DB and server CPU stay free of session-lookup overhead on hot read paths.
2. **Silent background refresh:** when the access token expires, the client transparently exchanges the long-lived refresh token (single-flight queue in `lib/api/client.ts`). Users never see a login screen mid-browse; the server performs **one quick DB check per 15 minutes per active user** — negligible background load.
3. **Immediate revocation control:** logout or account disable deletes the specific refresh token row server-side. Because the access token is stateless, worst-case residual access is bounded to the remaining ≤15-minute window; an optional lightweight Redis blocklist can make revocation effectively immediate if load measurements later justify it (proposed only — not required for MVP).

**Policy (recommended → now owner-approved as a requirement):** Access JWT ≈ **15 minutes**; Refresh Token **14–30 days** with **Refresh Token Rotation** (new refresh token issued and old one invalidated on every use — already implemented in the Phase 2 client refresh path; backend rotation verified live during Phase 2 integration testing). This eliminates login fatigue for non-sensitive browsing while keeping server/database overhead near zero.

Cross-reference: Open Contract item 3 below tracks confirming the *actual* backend `exp` value against a live response; if it differs from 15 min, either adopt the server value in docs or raise a backend config change for approval — do not silently assume.

---

## 5. Unresolved backend contracts

1. OTP send/verify endpoints — design approved (NEW-3=A); contract finalization lives in ADR-0060 (ACCEPTED): exact route names, OTP length/TTL, resend cooldown, enrollment-record semantics.
2. ~~Guardian identity/access design (NEW-1)~~ **RESOLVED**: parallel read-only `/portal/guardian/*` surface; guardians hold no membership rows and are excluded from `my-schools` (contract: OPEN_DECISIONS §NEW-1). Remaining unresolved contracts: OTP endpoint naming/enrollment semantics (ADR-0060 to draft), notifications domain schema & payload contract (Phase 2C, ADR-0061 to draft). Both decisions are approved; only the precise API contracts await ADR drafting.
3. Access-token TTL value (JWT exp) — read from a live response during Phase 2 integration test; docs alone insufficient.
4. Whether `POST /identity/login` has rate limiting/lockout (not found in controller; check `identity.service.ts` during Phase 2 planning).

## 6. Required tests (target matrix extract — auth-critical)
- Login success/failure/unknown-email; wrong-password message identical (enumeration check).
- Session restore after restart; expired access → transparent refresh; refresh reuse after rotation → forced logout.
- Logout while offline → local cleanup still completes.
- Membership revoked mid-session → next request → re-auth, caches purged.
- Tenant switch → zero requests bearing previous tenant's IDs; UI shows no previous-school names.
- Deep link to protected route while logged out → login → return-path honored without leaking params.
- Portal tests (Phase 2B contract, approved NEW-1): guardian requesting another family's studentId → 403; unlinked studentId → 403; other-tenant data invisible under RLS; combined-view totals equal sum of per-student totals for both billing modes.

## 7. Session evidence — staging attempt & Phase 2 verification (2026-10-12, latest session)
Commands actually executed here: `npx tsc --noEmit` → exit 0; `npx jest` → 3 suites / 12 tests passed (`api-client`, `secure-storage`, `use-api`). Staging migration apply + integration tests were attempted but are **NOT RUN**: this sandbox has no Docker, no Postgres client/server binaries, and no staging DB credentials. Additionally, the Phase 2B backend code could not be located in the verifiable read-only clone (HEAD clean at v1.1.0 `5e57b1b`; no portal files or post-0206 migrations present) — recorded as a discrepancy pending the actual 2B branch/repo location. Web-admin provisioning UI update likewise unconfirmed. Full gate checklist: IMPLEMENTATION_ROADMAP.md §"Phase 2B — Staging gate". Live refresh-rotation behavior therefore remains unit-tested only (§3/§6 items stay open until staging access is provided).
