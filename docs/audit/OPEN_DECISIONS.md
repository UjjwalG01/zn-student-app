# OPEN_DECISIONS — ZN Mobile Migration (Phase 0 Audit)

Status legend: **RESOLVED** = approved by product owner on 2026-10-12 · **PROPOSED** = awaiting explicit approval.

## Phase 1 approval record (2026-10-12)

Product owner approved **Phase 1 (Migration design)**. Consequences:

| ID | Status now | Approved content |
|----|-----------|------------------|
| NEW-1 | **RESOLVED — Option A, read-only scope** | Guardian portal as a dedicated backend extension: `guardians.userId` link + guardian-scoped **read-only** `/portal/guardian/*` endpoints. No portal writes in the initial migration. Requires an ADR before implementation (see §NEW-1 design below). |
| Phase 1 gate | Passed | Design may be finalized; Phase 2 (mobile foundation) may be planned, but backend portal work must land with its own ADR + tests before Phase 3's guardian journey ships. |

Second approval batch (2026-10-12): **NEW-2 = Option B (full push domain)**, **NEW-3 = Option A (post-password OTP step)**, **NEW-4 = CONFIRMED (teacher out of Phases 2–5)**, **NEW-5 = CONFIRMED + Phase 2 package installs authorized**. All decision items are now RESOLVED; remaining Phase-1 wrap-up is ADR drafting (see below) and the contract-clarification session.

## Resolved decisions (approved)

| ID | Topic | Approved decision |
|----|-------|-------------------|
| D-1 | Login method | Email/password only, **plus OTP for first-time device activation**. |
| D-2 | Primary mobile persona | **Guardian app**: a guardian account links to one or more students; UI shows linked students as rows with both combined (family) and per-student views. Teacher experience is out of the initial migration scope (see NEW-4). |
| D-3 | Fees visibility | Guardians see **recent payments** and **due/unpaid notifications pushed by the school**. |
| D-4 | Bus tracker | **Retire.** Remove `app/(tabs)/bus.tsx` and the external OpenStreetMap/onrender WebSocket dependency in Phase 6. |
| D-5 | Offline behavior | **Online-only** with controlled in-memory caching. No local DB, no offline mutation queue. |
| D-6 | Housekeeping | Remove dev/demo artifacts (`scripts/reset-project.js`, unused starter components, dotenv console probes, verbose error logging) and add test scripts (`typecheck`, `test`, CI-ready lint). |

## Consequences of D-1 (OTP at first login) — backend gap

Verified against backend commit `5e57b1b` (tag v1.1.0):

- `apps/api/src/identity/identity.controller.ts` exposes only `POST /identity/login` (email+password), `POST /identity/refresh`, `POST /identity/logout`, `GET /identity/me`. There is **no OTP send/verify endpoint**. The only OTP code in the API is break-glass TOTP (`src/break-glass/`), which is platform-admin infrastructure and not reusable here.
- Therefore D-1 requires a **backend extension** (new Identity capability + ADR). Options:
  - **A (recommended):** Password login → if device not previously enrolled, require an OTP delivered to the user's registered email before issuing the session pair. Reuses existing bcrypt/JWT stack (ADR-0003). Needs new endpoints (`POST /identity/otp/send`, `POST /identity/otp/verify` or equivalent), an OTP store with rate limiting/expiry, and a device/session enrollment record.
  - **B:** Enrollment-token model — school issues a one-time activation link/code at membership creation; app redeems it once, then pure password login. Smaller auth surface, but needs issuance UX in web admin.
- **No Base44 OTP (`base44.auth.verifyOtp`) may be retained as a stopgap** — it would keep Base44 as a parallel authentication authority, which the mission (§8) forbids. Until the ZN OTP path exists, the migrated app ships password-only.

## Consequences of D-2 (guardian app) — critical unresolved gap

Verified gaps in the current backend model:

1. **No guardian↔user link.** `guardians` table (`apps/api/src/database/schema/student.ts:261`) has `fullName`, `phone`, `email` but **no `userId` column**; `studentGuardians` (:282) links students↔guardians only. Grep across all schema files found no FK from guardians/students to `users`. A logged-in identity user cannot currently resolve "which students are mine".
2. **No tenant access for guardians.** Guardian billing routes (`apps/api/src/finance/guardian-billing.controller.ts`) require `JwtAuthGuard + TenantContextGuard + TenantEntitlementGuard('fees') + finance.read` permission — i.e., the caller must already hold a **staff membership** in the school. Guardians are not modeled as app users today.
3. **Combined vs separate view is half-supported.** Billing mode enum `separate | consolidated` exists per guardian (`guardians.defaultBillingMode`) and per student link (`studentGuardians.billingModeOverride`) — this governs *invoicing*, not app presentation. The app can render both combined and per-student views client-side once student resolution works.

→ See **NEW-1** below. This is the largest backend dependency of the whole migration.

## New decisions requiring approval

### NEW-1: Guardian portal design — ✅ APPROVED (Option A, read-only scope) 2026-10-12
Options considered:
- **A (approved):** Add `guardians.userId` (nullable FK to `users`, uniqueness enforced per tenant), a dedicated guard resolving caller→guardian→linked students, and guardian-scoped **read-only** `/portal/guardian/*` endpoints. All authorization server-side; RLS preserved. Requires an ADR (auth strategy + tenancy model changes ⇒ mandatory per `docs/adr/README.md`).
- **B:** Model guardians as full memberships with a `guardian` tenant role whose permissions are restricted to portal reads. Rejected: pollutes staff membership semantics and seat/licensing counts (ADR-0035 tiers).
- **C:** Client-side only (pass guardianId in requests) — **rejected**, violates the security-boundary rules (§8: client-supplied IDs must never grant access).

#### Approved design contract (PROPOSED future state — nothing implemented yet)

Evidence base: backend v1.1.0 / commit `5e57b1b`. Verified schema facts: `guardians` table has no `userId` (`apps/api/src/database/schema/student.ts:261-280`); `studentGuardians` links students↔guardians only (:282-310, incl. `student_guardians_one_primary_per_student` unique index :307); memberships live in `tenancy.ts:55` (roles via `membership_roles` :74-84); RLS registry already covers `guardians`/`student_guardians` (`docs/security/rls/registry.yaml:107-116`); `GET /tenancy/my-schools` served from `memberships` under ADR-0015 own-rows policy (`tenancy.controller.ts:157`).

1. **Schema (migration required — not created):** `guardians.user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL` + partial unique index on `(tenant_id, user_id)` WHERE `user_id IS NOT NULL` (one login → at most one guardian row per tenant). Column added via drizzle-kit migration with hand-reviewed SQL (ADR-0001 convention).
2. **Linking act = staff operation:** extend `PATCH /guardians/:id` (permission `guardian.update`) to accept `userId`; validations: target user exists; userId already claimed by another guardian in this tenant → 409. Web-admin provisioning UX is a separate tracked backend task. No public self-signup (Rule 5 / ADR-0015 rationale preserved).
3. **Access model:** new `PortalGuardianAuthGuard`: valid JWT → resolve `guardians WHERE tenant_id = :tenantId AND user_id = :caller AND active` → attach guardian identity to request. Guardians hold **no membership rows**; `my-schools` stays staff-only. Tenant still supplied explicitly per the verified ADR-0004 convention (`tenantId` query/body) and re-validated server-side — a client-supplied tenantId never grants access by itself.
4. **Endpoints (all GET — read-only per approval):**
   | Route | Returns | Backing service (existing) |
   |---|---|---|
   | `GET /portal/guardian/me` | guardian identity + linked-student summary | student domain |
   | `GET /portal/guardian/students` | rows `{studentId, fullName, admissionNumber, className, sectionName, relationship, isPrimary}` | `studentGuardians` join current enrollment |
   | `GET /portal/guardian/students/:studentId/profile` | same DTO as `GET /students/:id/profile`, only if linked | student profile service |
   | `GET /portal/guardian/students/:studentId/attendance?dateFrom=&dateTo=` | records for linked student only | attendance service |
   | `GET /portal/guardian/students/:studentId/exam-results` (+ marksheet) | published results only | academic result service |
   | `GET /portal/guardian/invoices` / `GET /portal/guardian/payments` | family view honoring `defaultBillingMode`/`billingModeOverride` (consolidated vs separate) | `GuardianBillingService` (today staff-gated `finance.read`, `guardian-billing.controller.ts:32-48`) |
   - Every `:studentId` path param checked against the caller's linked students server-side → 403 otherwise. Draft invoices excluded from portal responses (staff-only concept) — confirm in ADR.
5. **Entitlements:** portal billing routes gated by tenant `fees` entitlement (mirrors ENDPOINTS.md module-gating section); academic routes by `academic`. Recorded in the ADR.
6. **Governance prerequisites before implementation:** new ADR(s) after 0058 (guardian-as-portal-user auth + schema change; touches ADR-0003, ADR-0014/0015); RLS policy additions documented in `docs/security/rls/`; backend tests for linkage resolution, cross-guardian 403, consolidated-vs-separate totals equality, tenant isolation.
7. **Mobile impact:** combined (family) + per-student views rendered purely from these reads (D-2 satisfied); zero portal writes (approval scope). Attendance/marks entry remain staff/web.

Consequence: former blocker resolved. Sequencing: guardian journeys (Phases 3–4) depend on this backend extension shipping first → added as **Phase 2B** in IMPLEMENTATION_ROADMAP.

### NEW-2: Due-notification delivery mechanism — **RESOLVED: Option B (full push domain)** (approved 2026-10-12)
Owner chose the full Notifications domain rather than the poll-based interim. Consequences recorded honestly against verified evidence:
- Backend today has **no notification module** (verified: no notification controllers/services; no FCM/Expo-push/APNs references anywhere in `apps/api/src`; ENDPOINTS.md has no notification routes). This is a net-new domain, not an extension of existing code.
- Approved scope: tenant-scoped `notifications` + `device_tokens` tables (RLS per ADR-0014 pattern), server-side fan-out via the existing scheduled-job framework (ADR-0056) or event hooks, Expo push-token registration (`expo-notifications` client SDK), school-initiated sends (due reminders, result publication, attendance alerts) with staff UI in web admin, per-user subscription/preferences, and deep-link payloads.
- Sequencing impact: due-alert UX can no longer rely on invoice polling as its delivery channel; the interim poll surface is **dropped** from Phase 5. New roadmap phase added (**2C**) ahead of Phase 5's alert feature; ship order must respect "tokens registered → senders exist → alerts render".
- Governance: dedicated ADR filed: **ADR-0061** (ACCEPTED 2026-10-12; renumbered from the provisional placeholder); touches identity/device privacy (token storage = PII-adjacent, encrypt at rest conventions per repo security docs).
- Cost/risk note: largest backend item of the migration; if it slips, Phase 5 fees tab still ships with in-app due state rendered from invoice reads (display only), while true push alerts wait for 2C. Recorded so no silent scope creep either way.

### NEW-3: OTP implementation — **RESOLVED: Option A** (approved 2026-10-12)
Password login → if device/session not previously enrolled, require OTP delivered to the user's registered email before issuing the session pair. Implementation shape (for the ADR, not yet built): `POST /identity/otp/send` + `POST /identity/otp/verify` (names subject to ADR), OTP store with expiry + attempt limits + send rate limiting, device/session enrollment record so subsequent logins skip OTP. Reuses existing bcrypt/JWT stack (ADR-0003). No Base44 OTP stopgap (mission §8 forbids parallel auth authority). Mobile: OTP step screen wired behind feature flag in Phase 2, unflagged when backend endpoints land on staging.

### NEW-4: Teacher scope — **CONFIRMED** (approved 2026-10-12)
Teacher experience excluded from Phases 2–5. Repo currently has zero teacher screens; rich staff APIs remain web-only. The broken "Staff & Teacher Login" link is removed under D-6 housekeeping rather than wired. Revisit only after guardian MVP ships.

### NEW-5: Test framework — **CONFIRMED + installs authorized** (approved 2026-10-12)
Jest + jest-expo (unit/component) plus `tsc --noEmit` `typecheck` script; Maestro/Detox E2E deferred. Authorization covers exactly the Phase 2 install list: `jest`, `jest-expo`, `@testing-library/react-native`, `@types/jest` (+ dev-config files). Any package outside this list requires fresh approval.

## Non-decision housekeeping list (D-6 scope, for confirmation)
- Delete `scripts/reset-project.js` + boilerplate README content.
- Delete unused starter components: `components/hello-wave.tsx`, `parallax-scroll-view.tsx`, `external-link.tsx`, `ui/collapsible.tsx`, `ui/icon-symbol*.tsx` (verify no remaining imports first).
- Remove the `console.log("✅ Dotenv is working!…")` block in `app/(auth)/student-login.tsx`, the jsonplaceholder network-probe fetch in `utils/base44.ts`, and the `JSON.stringify(error)` dumps in `fetchStudentDashboardData`.
- Fix broken `<Link href="/(auth)/login">` ("Staff & Teacher Login") — that route does not exist in `app/(auth)/`.
- Add npm scripts: `typecheck`, `test`, `test:watch`. (No package installs during audit.)

## NEW-6 — Session-token load model & TTL policy (2026-10-12)
**Status: APPROVED as an owner-documented requirement.** Access JWT ≈15 minutes, stateless signature-only validation on read paths (zero SQL per request); refresh token 14–30 days with Refresh Token Rotation; silent background refresh so browsing never drops to a login screen; revocation via server-side refresh-token deletion with residual access bounded to the ≤15-min window (optional lightweight Redis blocklist only if later measurements justify it). Rationale and cross-references: AUTH_AND_TENANCY §"Session-token load model & TTL policy"; Phase 2 acceptance note in IMPLEMENTATION_ROADMAP. Verification obligation retained: confirm the live backend `exp` during Phase 2 staging integration testing; reconcile or raise a backend config-change request if it deviates — no silent assumptions.
