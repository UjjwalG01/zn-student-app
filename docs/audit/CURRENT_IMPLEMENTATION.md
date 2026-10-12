# CURRENT_IMPLEMENTATION — Screens, Journeys & Status

Statuses: **Implemented-verified** · **Implemented-unverified** (code exists; not run against live backend in this audit) · **Partial** · **Mock/prototype** · **Planned** · **Blocked**.
No screen was runtime-verified (audit restriction: no installs/builds). "Verified" below means *code-level verification only*.

## Auth group `app/(auth)/`
### student-login.tsx — Login (student/guardian email + admission no.)
- Role: student (legacy). Status: **Implemented-unverified**, with defects.
- Flow step 1: `loginOrRequestOtp(email, admissionNo)` → Base44 function `verifyStudentCredentials`; if server returns `{isVerified, token}` → store token in SecureStore (`user_token`), fetch dashboard.
- Flow step 2 (fallback): OTP entry → `base44.auth.verifyOtp({email, otpCode})` → same token storage.
- UI: two-step credential/OTP card, loading/disabled states via `submitting`, Alert-based errors through `getSafeErrorMessage`. No success/error state machine, no rate-limit handling.
- Defects: broken link to non-existent `/(auth)/login` ("Staff & Teacher Login"); dotenv probe console.log; no password path at all (→ target per D-1: password + first-time OTP on ZN).
- Tests: none. Migration complexity: **High** (full auth redesign; see AUTH_AND_TENANCY.md).

## Tabs group `app/(tabs)/` (protected by root Stack + AuthContext segment guard)
### index.tsx — Dashboard
- Status: **Implemented-unverified**. Data: entire aggregate from `AuthContext.studentData` (single Base44 function `getStudentData`).
- Displays: name/class/section banner; attendance % card (client-computed: `presentDays/totalDays`, with fallback `presentDays = totalDays` when status fields absent — **logic defect**: silently counts unknown rows as present); pending-invoice count (`status==='unpaid' || !is_paid`); exam routine card; bus route number (retiring, D-4).
- States: global `loading` spinner only; no empty/error/retry UI; no pull-to-refresh; no pagination/search.
- Migration: fan-out to multiple ZN read endpoints (see API_MIGRATION_MATRIX.md). Complexity: Medium.

### transactions.tsx — Fees
- Status: **Mock/UI prototype**. Renders hardcoded `FEE_HEADS` array; computes totals client-side; ignores `AuthContext.fees` entirely. Currency shown as `$`.
- Target (D-3): recent payments + due alerts from guardian billing endpoints. Complexity: Medium. Approved as Phase 2B backend extension (read-only portal).

### bus.tsx — Bus Route
- Status: **Implemented-unverified, external dependency**. `react-native-webview` loading an OpenStreetMap page + WebSocket telemetry from an onrender.com host; gated by `schoolSettings.is_bus_tracking_enabled`. Not a ZN capability (backend has no transport module — verified absence).
- Decision D-4: **RETIRE** in Phase 6 (remove tab, WebView dep if unused elsewhere, related context fields).

### attendance.tsx — Attendance history
- Status: **Implemented-unverified**. Read-only list built from `AuthContext.attendance` (subset of the aggregate payload). No filtering/date-range/pagination.
- Target: `GET /attendance/records` (tenant-scoped; verified controller `apps/api/src/attendance/attendance.controller.ts` @Controller('attendance/records'), @Get()). Guardian read-access via approved NEW-1 portal (Phase 2B). Complexity: Low-Medium.

### profile.tsx — Profile & logout
- Status: **Implemented-unverified**. Shows user/profile fields from aggregate; logout clears SecureStore token + context state (Base44 has no server-side revocation call here).
- Target: `GET /identity/me` + student profile + `POST /identity/logout` with refresh-token revocation. Complexity: Low.

### _layout.tsx — Tab bar
- 5 tabs, platform-specific heights, theme tokens. Role logic: none (student-only). Post-D-2 this becomes the guardian shell with per-student drill-in routes (rows → detail), plus a combined/family view toggle.

## Root & infrastructure
- `_layout.tsx`: providers ThemeProvider > AuthProvider > StudentProvider; header hidden. Guarding done inside AuthContext via `useSegments` redirect effect (**Implemented-unverified**; edge case: restore failure → `loading=false`, token null → redirect to login — acceptable but silent).
- `contexts/AuthContext.tsx`: session bootstrap from SecureStore, single aggregate fetch, flattened memos (className, fees, attendance, examRoutines, examResults, busRoutes, schoolSettings, assignedBus). **No refresh-token rotation, no expiry handling.**
- `contexts/student-context.tsx`: maps aggregate → one `Student` object. Single-student assumption must be replaced by multi-student list (D-2).
- `modal.tsx`, starter components: unused prototypes.

## User journeys (current reality)
1. Install → student-login → credentials → (auto-verified OR OTP) → dashboard with live-but-unverified data → browse tabs → logout. ✅ code-complete, ⚠️ untested.
2. Teacher journey: **Planned/not implemented** (no screens exist). Out of initial scope per NEW-4 (CONFIRMED 2026-10-12).
3. Notifications, schedules, marksheet download, documents, deep links, offline: **absent** (no code found; grep-verified).

## Known defects / missing behavior summary
- Mock fees tab vs real `fees` data available but unused (duplicate/dead data path).
- Attendance percent fallback overstates attendance.
- Broken staff-login link; env-probe logging; verbose error dumps.
- No error UI beyond Alerts; no retry; no pull-to-refresh; no empty states.
- Session never refreshed → mid-day forced re-login once legacy token expires (behavior depends on Base44 TTL — unknown).
