# IMPLEMENTATION_ROADMAP — Phase 0 → 6 (dependency-driven)

Decisions D-1…D-6, **NEW-1 (Option A, read-only)**, **NEW-2 (Option B: full push domain)**, **NEW-3 (Option A: post-password OTP)**, **NEW-4 (teacher excluded from Phases 2–5)**, and **NEW-5 (Jest + jest-expo + typecheck; Phase 2 installs authorized)** are all **approved** (2026-10-12). No decision items remain open; the Phase-1 wrap-up is COMPLETE: ADR-0059/0060/0061 drafted and ACCEPTED by the owner on 2026-10-12 (`docs/audit/proposed-adrs/`); remaining pre-coding item: contract-clarification session during Phase 2B. No phase is "done" without its evidence artifacts (test runs, screenshots/recordings on staging, updated docs).

## Phase 0 — Audit & documentation ✅ COMPLETE (this folder)
Evidence: `docs/audit/*`. Remaining within Phase 0: none.

## Phase 1 — Migration design & approval ✅ APPROVED (2026-10-12)
Outcome: NEW-1 resolved as Option A (**read-only** portal), NEW-2 as **full push domain**, NEW-3 as **Option A OTP step**, NEW-4 confirmed (teacher out of scope), NEW-5 confirmed (Jest+jest-expo+typecheck; installs authorized). Residual Phase-1 wrap-up items that must land before dependent phases start:
1. ~~Draft~~ **ADR-0059 (ACCEPTED 2026-10-12): Guardian Portal Access** — auth model + `guardians.user_id` schema change + RLS registry + GET-only `/portal/guardian/*` routes.
2. ~~Draft~~ **ADR-0060 (ACCEPTED 2026-10-12): First-Login OTP** — `POST /identity/otp/send|verify`, OTP store (expiry, attempt limits, send rate limit), device/session enrollment record.
3. ~~Draft~~ **ADR-0061 (ACCEPTED 2026-10-12): Notifications Domain** — `notifications` + `device_tokens` tables, Expo push integration, school-initiated sends, subscription/preferences, deep-link payloads. (Final numbering sequential per repo convention when drafted; three separate ADRs recommended since concerns are independent.)
4. Contract-clarification session: results publication filter, pagination conventions, access-token TTL, login rate limiting, draft-invoice exclusion from portal responses.
Acceptance: every row of the migration matrix has an agreed status; ADRs drafted (accepted by owner); zero implementation started. *(Matrix statuses updated accordingly — see API_MIGRATION_MATRIX.)* ✅ Design decisions portion achieved 2026-10-12; ADR drafting + acceptance completed 2026-10-12; Phase 1 CLOSED. Item 4 (contract clarification) runs at the start of Phase 2B.

## Phase 2 — Mobile integration foundation *(gated: Phase 1 approved ✅ — can start)*
Deliverables: `.env.example` + EAS-style env profiles; `lib/api/client.ts` (bearer inject, tenantId helper, error union, single-flight refresh); `lib/storage/secure.ts` (two-key tokens, wipe-all); AuthContext rewrite against ZN lifecycle (password path only — OTP step stubbed behind feature flag until the NEW-3 OTP endpoints (ADR-0060) land); TenantContext (my-schools, my-permissions, mobile-modules flags); `useApiFetch`; D-6 housekeeping (delete starter/mock/dev-probe files, add `typecheck`/`test` scripts — package installs happen here with approval).
Acceptance gate: end-to-end login→`/identity/me`→school list→logout against **staging** backend passes automated tests; token rotation verified by clock-skew test; no Base44 call remains reachable from new auth flows.
Session-token policy (owner requirement 2026-10-12): access JWT ≈15 min stateless window, refresh 14–30 days with rotation, silent background refresh, revocation bounded to ≤15-min residual window (optional Redis blocklist only if later justified) — full rationale in AUTH_AND_TENANCY §"Session-token load model & TTL policy". Verify actual backend `exp` during the staging integration test; reconcile or raise a config-change request if it deviates.

**Phase 2 status (2026-10-12): foundation code + tests COMPLETE** (`lib/env.ts`, `lib/storage/secure.ts`, `lib/api/{client,types}.ts`, `lib/api/services/{identity,portal-guardian}.ts`, `contexts/zn-auth-context.tsx`, Jest harness, `typecheck`/`test` scripts). Evidence in TESTING_AND_RELEASE §Phase 2 evidence. Remaining acceptance items need external inputs: staging backend credentials for the e2e gate and live JWT-exp check (NEW-6), plus ZnAuthProvider wiring into `app/_layout.tsx` during Phase 3 cutover (legacy screens stay on Base44 until then).

## Phase 2B — Backend guardian portal extension *(NEW: gated: ADR accepted; blocks Phase 3+)*
Scope per approved NEW-1 (read-only): `guardians.user_id` migration + partial unique index; `PATCH /guardians/:id` accepts `userId` (staff `guardian.update`, 409 on claimed userId); `PortalGuardianAuthGuard`; GET-only `/portal/guardian/*` routes (`me`, `students`, `students/:id/profile|attendance|exam-results`, `invoices`, `payments`) reusing existing services (student profile, attendance, exam results, GuardianBillingService); entitlement gating (`fees`/`academic`); web-admin provisioning UX task tracked separately.
Acceptance gate: backend tests green — linkage resolution, cross-guardian studentId → 403, other-tenant → 403/empty under RLS, consolidated-vs-separate family totals equal per-student sums, published-results-only visibility; OpenAPI/docs (`ENDPOINTS.md`) updated in the same PR; portal endpoints deployed to staging.
Rollback: endpoints are additive; disable via route removal/flag — no staff-facing behavior changes.

## Phase 2C — Backend notifications domain + mobile push *(NEW-2 Option B approved; gated: ADR accepted)*
Scope (backend, own PR series): `notifications` + `device_tokens` tables (tenant-scoped, RLS per ADR-0014 pattern); Expo push integration (`expo-server-sdk` or equivalent — package choice recorded in ADR, subject to install approval); school-initiated send endpoints (staff permission) + web-admin compose UI; automated senders for due reminders / result publication / attendance alerts wired via existing scheduled-job framework (ADR-0056); per-user subscription/preferences endpoints; deep-link payload contract with the app router.
Scope (mobile, can start early): `expo-notifications` install (add to NEW-5 authorized list — flag: not in original four-package list, needs explicit go), permission prompt UX, token registration/unregistration tied to login/logout/tenant-switch, notification tap → deep link into the right student's screen, in-app alert surface rendering received notifications.
Sequencing note: token registration (Phase 3 shell) precedes any meaningful push delivery; if 2C slips past Phase 5, the fees tab still ships with **display-only** due state from invoice reads (no polling-as-notification).
Acceptance gate: backend tests — fan-out targets only linked guardians of the triggering tenant, token invalidation on uninstall-equivalent (Expo error responses handled), duplicate-send protection/idempotency, preferences respected; mobile tests — token registered after login and wiped on logout, deep-link routing per role/student; staging end-to-end: staff sends test alert → device receives → tap opens correct screen.
Rollback: disable senders via feature flag; client tolerates absent push (in-app lists unaffected).

## Phase 2B — Staging gate *(owner instruction 2026-10-12; BLOCKED in this sandbox)*
Attempted this session with full evidence:
- **Migration apply + integration tests:** NOT RUN. Environment inspection: no Docker, no Postgres client/server binaries, and no staging database credentials available in this sandbox. The read-only backend clone (`/tmp/audit/zn-backend`, v1.1.0 `5e57b1b`) is clean at HEAD — the Phase 2B code described as "delivered" in the prior turn is **not present in any repository I can verify** (no portal files, no migration beyond `0206_day_end_round_off_permissions.sql`). Recorded as unverified pending location of the actual 2B branch/repo.
- **Web-admin provisioning UI (link users→guardians):** NOT PRESENT / not verifiable here; tracked as open sub-task.
- **Mobile-side validation actually run:** `npx tsc --noEmit` → exit 0 (clean); `npx jest` → 3 suites / 12 tests passed (`__tests__/api-client.test.ts`, `secure-storage.test.ts`, `use-api.test.ts`). Portal service stubs type-check against the ADR-0059 contract so mobile work stays aligned once endpoints deploy.
**Gate to clear before Phase 3 acceptance:** (1) apply migration `guardians.user_id` (+ partial unique index, RLS registry entry) to staging via the project's drizzle pipeline; (2) run the 2B integration suite on staging (linkage, cross-guardian 403, tenant isolation, consolidated-vs-separate totals parity); (3) deploy `/portal/guardian/*` routes to staging; (4) ship web-admin `userId` field on the guardian form (`guardian.update` per ADR-0059 §Linking).

## Phase 3 — Core guardian shell *(gated: Phase 2B endpoints merged to staging — GATE NOT YET CLEARED; coding may proceed against the frozen ADR-0059 contract, but acceptance requires staging evidence)*
Order: login completion (incl. school-select screen) → GuardianContext linked-students rows (`GET /portal/guardian/students`) → family dashboard fan-out (profile, attendance summary, invoice summary) → profile/logout → per-student detail routes skeleton → push-token registration hook (client side of 2C; no-op until senders exist).
Acceptance: real multi-student data renders combined + per-student views; switching schools purges caches (verified by request-log test); zero Base44 in shipped flows except not-yet-migrated dead paths.

## Phase 4 — Academic reads per student
Sequence: attendance history (date range) → exam schedule/published results (after publication-filter clarification) → marksheet download → documents list/download. Each item ships only after its permission + academic-year behavior is verified on staging (read-only app side; no writes in scope).
Acceptance per feature: functional tests + negative authorization tests (other tenant's IDs → 403 handled gracefully).

## Phase 5 — Approved extras
Fees tab rebuild on real payments/invoices (D-3), **push-based due/result alerts** consuming the Phase 2C domain (poll interim dropped per NEW-2=B; display-only due state allowed as fallback if 2C slips), deep links hardening (incl. notification-tap payloads), accessibility pass (contrast/dynamic type on kept screens). Scope grows only by explicit approval.

## Phase 6 — Hardening & Base44 retirement
Remove `@base44/sdk`, `utils/base44.ts`, bus tab/WebView usage, legacy env vars; grep-gate: no `base44` outside docs/changelog. Credential follow-ups executed under separate authorization: rotate `BASE44_API_KEY`, revoke legacy sessions, rotate exposed GitHub PAT, confirm published bundles never contained server keys. Full regression suite + Android release build (+iOS where environment supports). Release plan + rollback tag documented.
Acceptance: signed staging build passes full test matrix with Base44 services unreachable (kill-switch simulation).

## Cross-phase risk register
| Risk | Mitigation |
|---|---|
| NEW-1 slips → app has no core journey | Ship Phase 2 foundation + staff-free polish meanwhile; keep legacy app alive read-only until cutover |
| OTP extension delays first-login requirement | Password-only interim explicitly allowed by D-1 interpretation (§OPEN_DECISIONS); revisit before store release |
| NEW-2 push domain (2C) is the largest backend item and may slip past Phase 5 | Fees tab fallback: display-only due state from invoice reads; push alerts ship when 2C lands; client tolerates absent push |
| `expo-notifications` / push provider packages not in NEW-5 authorized install list | Flagged for explicit approval before Phase 2/2C installs (OPEN_DECISIONS §NEW-2, §Phase 2B note) |
| Contract drift between audit and implementation tags | Re-verify cited controllers at implementation branch HEAD before each phase gate |
| Legacy users stranded | Forced re-login banner in first migrated build; admission-no lookup helper in school admin as fallback |

## Rollback posture
Per-phase feature flags (`mobile-modules` + local flags); old Base44 app remains installable until Phase 6 sign-off; no irreversible client-side storage migrations (legacy key preserved untouched until deletion gate).
