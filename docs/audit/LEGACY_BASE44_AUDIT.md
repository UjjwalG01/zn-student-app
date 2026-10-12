# LEGACY_BASE44_AUDIT — Exhaustive Dependency Inventory

Every Base44 touchpoint found by full-source grep (`base44|BASE44` across `/workspace`, excluding `node_modules`, lockfile, `.git`). Each entry: file → symbol → type → runtime status → ZN equivalent → required work.

## Dependency matrix

### A. SDK / client initialization
| # | File : Symbol | Type | Runtime? | Purpose | ZN equivalent | Replacement work |
|---|---|---|---|---|---|---|
| A1 | `utils/base44.ts` : `createClient({appId, headers:{api_key}})` | SDK init | ✅ active (imported app-wide via contexts) | Instantiates Base44 client from `EXPO_PUBLIC_BASE44_APP_ID` + `BASE44_API_KEY` | None needed — replaced by typed fetch client w/ `EXPO_PUBLIC_ZN_API_URL` | Delete; new `lib/api/client.ts` |
| A2 | `utils/base44.ts` : `setAuthToken()` → `base44.setToken()` | Session binding | ✅ active | Injects user token into outbound SDK headers | `Authorization: Bearer <accessToken>` in central client | Delete |
| A3 | `package.json` : `@base44/sdk ^0.8.38` | Dependency | ✅ bundled | SDK itself | — | Remove in Phase 6 after replacements verified |

### B. Authentication
| # | File : Symbol | Type | Runtime? | Details | ZN equivalent | Work |
|---|---|---|---|---|---|---|
| B1 | `contexts/AuthContext.tsx` : `loginOrRequestOtp()` → `base44.functions.invoke("verifyStudentCredentials", {email, admissionNo})` | Server function (auth) | ✅ active | Returns `{isVerified, token}`; auto-login path when verified | `POST /identity/login` (email+password) — **contract differs**: no admission-number credential, password required; first-time OTP needs NEW backend extension (D-1/NEW-3=A approved, ADR-0060 ACCEPTED) | Rewrite login screen to email+password (+OTP step once backend exists) |
| B2 | `contexts/AuthContext.tsx` : `verifyOtpAndLogin()` → `base44.auth.verifyOtp({email, otpCode})` | Built-in auth API | ✅ active | Device-activation OTP fallback | No ZN OTP endpoint exists (verified `identity.controller.ts`) | Blocked until D-1 backend extension approved |
| B3 | Token persistence `SecureStore "user_token"` | Storage | ✅ active | Single opaque token; **no refresh rotation** | ZN issues `{accessToken, refreshToken}` pair with rotating refresh (`POST /identity/refresh`) | Store two keys; implement proactive+reactive refresh |
| B4 | `logout()` | Auth hygiene | ✅ active | Local delete only | `POST /identity/logout` revokes refresh server-side | Add server call + guaranteed local cleanup |

### C. Data access (entity reads/writes)
| # | File : Symbol | Type | Runtime? | Data read | ZN equivalent | Work |
|---|---|---|---|---|---|---|
| C1 | `utils/base44.ts` : `fetchStudentDashboardData()` → `base44.functions.fetch('getStudentData')` | Server function (aggregate read) | ✅ active — sole data source for every tab | Flat object: `user{school_id, admission_no, class_name, section}`, `profile`, `school_settings{school_name, is_bus_tracking_enabled…}`, `fees[]`, `attendance[]`, `exam_routines[]`, `exam_results[]`, `bus_routes[]`, `assigned_bus` | Fan-out: `GET /identity/me`; `GET /tenancy/my-schools`; `GET /students/:id/profile`; `GET /academic/enrollments/history`; `GET /attendance/records`; `GET /academic/exam-results(+ /:id/marksheet)`; finance per NEW-1 portal endpoints | Build service modules + response mappers; dashboard becomes parallel-fetch composition |
| C2 | `contexts/student-context.tsx` : mapping of aggregate → `Student` | Client model | ✅ active | Assumes one student per account | Multi-student guardian model absent in ZN today | Replaced by `GuardianContext` (student rows list) — NEW-1 approved: served by Phase 2B portal endpoints |
| C3 | Writes (attendance entry, marks, etc.) | — | ❌ none exist | App is read-only; no `base44.entities.*` usage found anywhere (grep-verified) | N/A | Nothing to migrate |

### D. Files / storage / realtime / notifications
| # | Finding | Status |
|---|---|---|
| D1 | `base44.storage` / file upload usage | **Absent** (grep-verified) |
| D2 | Realtime subscriptions (`base44.realtime`) | **Absent**. The only realtime element is `app/(tabs)/bus.tsx`: raw WebSocket to an external onrender.com tracker — not Base44, retired by D-4 |
| D3 | Notification services | **Absent** both in app and ZN backend (**NEW-2 resolved: full push domain, Phase 2C**) |
| D4 | Automations/workflows callable from app | **None referenced**; server functions are opaque (definitions live in the legacy Base44 platform repo — **not available for inspection; recorded limitation**) |

### E. Base44-specific assumptions embedded in models
- `user.id`, `school_id`, `admission_no` as identity handles; `profile.is_verified`; fee rows with `status`/`is_paid`; attendance rows with `status` or `is_present` (two-shape tolerance); snake_case aggregate keys throughout `AuthContext.StudentData` interface. All must be re-typed against ZN DTOs (camelCase, UUID tenant/student IDs, enum statuses).

### F. Mock/dev fallbacks & dead references
- `transactions.tsx` hardcoded `FEE_HEADS` (mock standing in for missing real UI wiring).
- jsonplaceholder probe in `fetchStudentDashboardData` (network smoke test, remove per D-6).
- Mentions of Base44 in comments only: `student-context.tsx` header comment — historical reference, not runtime.

## Credentials & configuration risk (names only — values never printed)
| Variable | Location used | Classification | Risk | Remediation (authorized follow-up, NOT executed in audit) |
|---|---|---|---|---|
| `BASE44_API_KEY` | `utils/base44.ts` headers | Non-`EXPO_PUBLIC` var consumed by client code | **HIGH** — if provided at build time it can end up in the JS bundle; it is a platform-level key, not per-user | Rotate after migration cutover; ensure removed from any CI/bundle env; verify past published builds didn't embed it |
| `EXPO_PUBLIC_BASE44_APP_ID` | same | Public identifier | Low-moderate (tenant enumeration aid) | Retire with SDK |
| `EXPO_PUBLIC_API_URL` | referenced in login probe + client init | Config | Low | Replace with `EXPO_PUBLIC_ZN_API_URL` |
| SecureStore `user_token` | `AuthContext` | Session secret at rest | Acceptable (hardware-backed), but single-token/no-expiry handling | Two-key pair storage + expiry logic |
| GitHub fine-grained PAT observed during session bootstrap | environment, not repo | **HIGH** | Rotate immediately (explicit authorization required; flagged, not acted upon) |

## Removal scope summary (Phase 6 gate criteria)
Delete: A1–A3, B1–B4 call sites, C1–C2 consumers, bus WS dependency (D-4), mock fees constants (replaced by real data), env vars above. Gate: each deletion happens only after its ZN replacement passes functional + security tests, and a final grep shows zero `base44` references outside changelog/docs.

## Unresolved questions
1. `verifyStudentCredentials` / `getStudentData` server-side logic lives in the inaccessible legacy Base44 platform — field derivations (e.g., attendance %, fee statuses) could not be diffed against ZN semantics. Flagged as contract-clarification items in API_MIGRATION_MATRIX.md.
2. Legacy token TTL/expiration behavior unknown.
3. Whether any production device still holds valid Base44 sessions (migration must handle forced re-login gracefully).
