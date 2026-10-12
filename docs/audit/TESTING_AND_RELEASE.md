# TESTING_AND_RELEASE — Current State, Target Matrix, Gates

## 1. Current test state (verified)
- **No tests exist** in the mobile repo: no `__tests__`, no jest config, no test script (`package.json` scripts = start/android/ios/web/lint/reset-project). Nothing was runnable; therefore **no test outcome is claimed**.
- Checks executed during audit: static inspection only (file reads, greps, git status/log). `npm install`, lint, typecheck, builds deliberately **not run** (§17 restrictions + would mutate lockfile/node_modules).
- Backend side (read-only): cited routes were verified against controller source at tag v1.1.0; several have companion `*.spec.ts` files present in-repo (e.g., `identity.service.spec.ts`, `student-field-registry.spec.ts`, finance billing specs) — their pass status was not re-executed here.

## 2. Tooling plan (**NEW-5 APPROVED 2026-10-12** — installs authorized at Phase 2 start: jest, jest-expo, @testing-library/react-native, @types/jest; expo-notifications flagged separately under Phase 2C)
- Jest + jest-expo preset (unit/component), `tsc --noEmit` as `typecheck` script, existing `expo lint` kept. Mock fetch layer for services; MSW-style handlers optional later. E2E (Maestro/Detox) deferred until Phase 3 shell exists.

## 2b. Backend portal test gate (NEW-1 approved → Phase 2B acceptance)
Phase 2B endpoints ship only when these backend tests pass (backend test runner to be confirmed from repo config during Phase 2B planning; ADR-0002 covers TS/lint toolchain):
- Linkage: user with `guardians.user_id` set → portal `me`/`students` return exactly their linked students (multi-student family + single-student edge).
- Negative auth: JWT whose user is not a guardian in the tenant → 403/empty; unlinked or other-family `studentId` path param → 403.
- Tenant isolation: cross-tenant probe under RLS → no rows leak; disabled/inactive guardian row → denied.
- Billing parity: consolidated-vs-separate family totals equal Σ per-student positions (`StudentFinancialPositionService` reuse — never a second calculator); draft invoices absent from portal responses.
- Published-results-only visibility on exam-results route; entitlement 403 (`fees`/`academic`) paths.
- `PATCH /guardians/:id` userId linking: happy path, nonexistent user 400, already-claimed userId 409; audit trail recorded.

## 3. Target test matrix (mapped to phases)
| Area | Test | Level | Phase gate |
|---|---|---|---|
| Auth | login success / invalid creds / unknown email same-message | unit+integration | P2 |
| Auth | session restore after restart; access-token expiry → transparent refresh; reused rotated refresh → forced logout | integration | P2 |
| Auth | logout offline → local wipe completes | unit | P2 |
| Auth | first-time OTP flow (**NEW-3=A approved**; tests required when ADR-0060 builds): send rate limit, expiry, replay rejection | backend+integration | post-P2 |
| Tenancy | my-schools render; tenant switch purges cache & aborts in-flight; zero prior-tenant IDs in next request batch | integration | P2/P3 |
| Tenancy | guardian requesting foreign studentId/invoice → 403 handled, no data leak | integration+backend | P3/P4 |
| Guardian | multi-student rows; combined totals == Σ per-student; single-student edge case | component | P3 |
| Dashboard | loading/empty/error/retry states each rendered; pull-to-refresh | component | P3 |
| Attendance | date-range query mapping; enum status rendering incl. late/half-day variants; no "unknown⇒present" fallback regression | unit | P4 |
| Results | unpublished results hidden; marksheet download failure → retry UI | integration | P4 |
| Fees | due vs paid classification from API statuses (no client derivation); currency formatting | unit | P5 |
| Alerts | poll-based due alerts dedupe within session | component | P5 |
| Network | offline banner, timeout normalization, 401-during-refresh queue single-flight | unit | P2 |
| Deep links | protected route cold-link → login → return path; malformed link fallback | integration | P5 |
| Accessibility | dynamic type & contrast on shipped screens | manual+snapshot | P5 |
| Release | Android release build succeeds; iOS build where env supports; grep-gate zero `base44`; rollback flag toggles tested | CI job | P6 |

## 4. Environment requirements
Staging ZN API instance with seeded tenant(s): multi-guardian family, single-student guardian, cross-tenant probe accounts, unlicensed-module tenant (entitlement 403 path), disabled-account user. Device matrix: Android min target TBD at Phase 2, iOS current supported by Expo 54 defaults.

## 5. Release readiness criteria (Phase 6 exit)
All matrix rows green on staging; security review re-run (tenant isolation spot tests); credential rotation completed under separate authorization; store listing metadata updated (app renamed away from legacy branding if approved); rollback = previous store version + feature flags off; CHANGELOG entry referencing this audit folder.


## Phase 2 evidence (2026-10-12)
Commands executed in `/workspace` (Expo SDK 54 / RN 0.81.5, Node sandbox):
- `npm install` — existing lockfile only; NEW-5 authorized dev packages added (`jest@~29.7`, `jest-expo@~54.0.18`, `@types/jest`, `@testing-library/react-native@12.5.2`, `react-test-renderer@19.1.0`). No runtime dependency changes.
- `npm run typecheck` (`tsc --noEmit`) — **exit 0, clean** (baseline verified before changes and after every edit batch).
- `npm test` (`jest`) — **2 suites, 7 tests, all passing** (~2s):
  - `__tests__/api-client.test.ts`: bearer injection; single-flight rotating refresh with concurrent-401 replay-once (NEW-6 silent-refresh model); refresh-failure → `onSessionExpired` + unauthorized; `skipRefresh` recursion guard (login/logout); network-failure normalization; 204 handling.
  - `__tests__/secure-storage.test.ts`: two-key token storage + wipe-all (revocation cleanup).
- Bug found by tests and fixed: `ApiClient.refresh()` finally-block awaited its own promise slot → permanent hang on any refresh path. Fix: clear slot before resolution. Regression now covered by the single-flight test.
- Corrections applied per ENDPOINTS.md re-verification: logout now calls `POST /identity/logout {refreshToken}` best-effort before mandatory local wipe; `/identity/me` probe consumes the flat `IdentityMeResponse` shape (incl. `sessionTimeoutMinutes` typing for the ADR-0022 inactivity window).
- Limitations: no staging backend available in this environment → end-to-end login→me→logout integration test and live JWT `exp` verification (NEW-6 obligation) deferred to when staging credentials are provided. Android/iOS builds not run (no emulator toolchain here). Legacy Base44 code paths untouched and still reachable from legacy screens until Phase 3 cutover.
