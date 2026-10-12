# TARGET_ARCHITECTURE — Proposed React Native Structure (PROPOSAL, not implemented)

Baseline: existing Expo Router + Contexts app is small and mostly sound. The proposal **preserves** the stack, routing style, theme system (`constants/theme.ts`, `contexts/theme-context.tsx`), SecureStore usage, and component conventions; it replaces the data/auth layer and reshapes navigation for the guardian persona (D-2). No template rewrite required.

## 1. Persona & shell decision — ✅ APPROVED with Phase 1 (2026-10-12; NEW-1 read-only portal confirmed)
Approved scope = **guardian-first shared app**. Two options evaluated (§9 of mission):
1. *Shared shell with role-specific screens* — one tab set mutated by permissions.
2. *Separate navigation experiences in one app* — distinct route groups per persona sharing infrastructure.
**Recommend option 2**, because teacher journeys (if re-scoped later, NEW-4 confirmed out of Phases 2–5) have fundamentally different tab structures and write flows; expo-router groups make this cheap while `lib/api`, auth, and theme stay shared. Guardian is the only persona shipping now, so teacher group remains absent until approved.

Multi-membership reality: users may belong to several schools and a user can be linked to multiple students as guardian; nothing assumes one role / one school. Navigation visibility derives from `my-permissions` + `mobile-modules`; server enforces everything.

## 2. Proposed directory tree (additions marked 🆕, kept ↻, deleted ✂)
```
app/
  _layout.tsx                       ↻ providers (swap StudentProvider → GuardianProvider)
  (auth)/login.tsx                  🆕 email+password (+OTP step; NEW-3=A approved, ships when ADR-0060 builds)
  (auth)/school-select.tsx          🆕 my-schools switcher post-login
  (auth)/student-login.tsx          ✂ replaced by login.tsx
  (tabs)/_layout.tsx                ↻ tabs: Home(Family), Students, Fees, Alerts?, Profile
  (tabs)/index.tsx                  ↻ family dashboard (parallel fetches, pull-to-refresh)
  (tabs)/transactions.tsx           ↻ real payments/due list
  (tabs)/attendance.tsx             ✂→ moves under student detail (per-student concern)
  (tabs)/bus.tsx                    ✂ retired (D-4)
  (tabs)/profile.tsx                ↻ account, schools, logout
  (students)/[studentId]/
      index.tsx                     🆕 student overview row → detail
      attendance.tsx                🆕 date-range history
      results.tsx                   🆕 published results + marksheet link
      documents.tsx                 🆕 Phase 5
  modal.tsx, starter components     ✂ (D-6)
contexts/
  AuthContext.tsx                   ↻ rewritten against ZN lifecycle (see AUTH_AND_TENANCY §2)
  TenantContext.tsx                 🆕 active tenant, memberships, permissions, module flags
                                       (guardians: no membership rows — school context comes from
                                       the NEW-1 portal `me` response; approved design)
  GuardianContext.tsx               🆕 linked students (`GET /portal/guardian/students`, Phase 2B),
                                       selected-student vs combined mode
  theme-context.tsx                 ↻ unchanged
hooks/
  useApiFetch.ts                    🆕 loading/error/empty/retry state machine + AbortController
  use-color-scheme*, use-theme-color ↻ unchanged
lib/
  api/client.ts                     🆕 base URL (EXPO_PUBLIC_ZN_API_URL), bearer injection,
                                       tenantId param helper, 401 single-flight refresh queue,
                                       error normalization (ApiError union)
  api/types/<domain>.ts             🆕 DTO types mirroring ZN responses (identity, tenancy,
                                       student, attendance, academic, finance, settings)
  api/services/<domain>.ts          🆕 thin typed call wrappers (one per domain, no cross-domain logic)
  storage/secure.ts                 🆕 wrapper over expo-secure-store (key names, wipe-all)
utils/base44.ts                     ✂ deleted in Phase 6 after gate
utils/error-message.ts              ↻ keep getSafeErrorMessage; feed normalized ApiError
types/, constants/                  ↻ keep
docs/audit/                         ↻ this audit trail
```

## 3. Responsibility boundaries
| Concern | Owner |
|---|---|
| Presentation, forms, display formatting, tab visibility | Mobile |
| Session issuance/rotation, membership & permission checks, RLS, attendance/marks math, billing aggregation, document generation, academic-year resolution | Backend (verified domains: identity, tenancy, authorization, student, academic, attendance, finance, document-engine, settings) |
| Caching | In-memory request cache only (D-5); keyed by `tenantId + studentId + endpoint`; purged on tenant switch/logout |
| Files/PDF | Streamed via authorized endpoints into ephemeral viewer; never persisted to disk caches |

## 4. Data-fetch pattern
No new server-state library proposed yet (would need approval, NEW-5 adjacent). Interim: `useApiFetch` hook implementing `{idle, loading, success, empty, error}` with retry + pull-to-refresh; revisit TanStack Query in Phase 2 review if fan-out complexity demands it.

## 5. Environment config
`.env.example` (values redacted here): `EXPO_PUBLIC_ZN_API_URL` (dev/staging/prod profiles via EAS env), no non-public vars consumed by client code ever again (lesson from `BASE44_API_KEY`). Dev builds must point at staging API only.

## 6. Testing boundaries
Unit: mappers/services (mock fetch), auth context state machine, hooks. Component: dashboard states, student rows, fees list. Integration (device/simulator, Phase gates): full login→dashboard, tenant switch purge, refresh rotation. Contract tests against staging backend before each feature ships. See TESTING_AND_RELEASE.md matrix.
