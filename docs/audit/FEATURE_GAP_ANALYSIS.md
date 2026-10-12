# FEATURE_GAP_ANALYSIS — Working / Mock / Missing / Blocked

Legend: ✅ working (code-verified) · 🟡 partial · ⛔ mock/dead · ❓ unverified at runtime · 🚫 blocked by backend gap · ➖ absent.

## Working (code-verified, runtime-unverified ❓)
| Feature | Evidence | Gap to target |
|---|---|---|
| OTP/credential login UI flow | `app/(auth)/student-login.tsx` two-step state machine | Wrong authority + wrong credential model (D-1 → password+first-time OTP on ZN) |
| Session restore + route guard | `AuthContext.bootstrapAsync`, segments redirect | No refresh/expiry; silent failure |
| Dashboard composition | `(tabs)/index.tsx` cards from aggregate | Fan-out APIs; fix attendance-% fallback defect |
| Attendance list render | `(tabs)/attendance.tsx` | Date-range/pagination missing; status mapping must use ZN enum |
| Profile + logout (local) | `(tabs)/profile.tsx` | Server revocation missing |

## Mock / dead paths (must not be mistaken for features)
| Item | Evidence | Action |
|---|---|---|
| Fees tab entirely hardcoded | `FEE_HEADS` const in `transactions.tsx`; live `fees` from context unused | Rebuild on real data (Phase 5, on approved NEW-1 portal endpoints — Phase 2B) |
| Bus tracker external service | WS host onrender.com + WebView; no ZN transport module | Retire (D-4 approved) |
| Starter kit components & modal | `hello-wave`, `parallax-scroll-view`, `modal.tsx`, `reset-project.js` | Delete (D-6) |
| jsonplaceholder probe + dotenv log | `utils/base44.ts`, login screen | Delete (D-6) |
| Broken teacher-login link | `<Link href="/(auth)/login">` — route nonexistent | Remove or wire to future staff auth (NEW-4) |

## Absent features with intended demand (from mission areas + D-2/D-3)
| Feature | Backend capability | Status |
|---|---|---|
| Multi-student guardian rows + combined view | ❌ user↔guardian link missing | **APPROVED — NEW-1 Option A, read-only** (build in Phase 2B; app work Phase 3) |
| School/membership switcher | ✅ `GET /tenancy/my-schools` | Ready client-side work |
| Recent payments & due alerts | ✅ invoices/payments routes exist but staff-permissioned; push channel ❌ | Backend extension approved (Phase 2B); **NEW-2 RESOLVED = full push domain (Phase 2C, ADR-0061 ACCEPTED)** |
| Exam schedule & published results | ✅ exam-results routes (publication filter needs contract clarification) | CONTRACT-CLARIFY |
| Marksheets/documents download | ✅ marksheet + student documents routes | Phase 5 |
| Push notifications | ❌ none anywhere (backend + app verified absent) | **NEW-2 RESOLVED: build Notifications domain (Phase 2C)** |
| Offline cache/sync | n/a | Not required (D-5 online-only) |
| Teacher experience (roster, attendance marking, marks entry) | ✅ rich staff APIs (`POST /attendance/records` w/ `attendance.mark`, roster, admit-cards) but zero mobile screens | Out of initial scope (**NEW-4 CONFIRMED** 2026-10-12) |

## Business-logic duplication / ownership findings (§5 of mission)
| Rule found in app | Location | Correct owner | Verdict |
|---|---|---|---|
| Attendance % computation incl. "unknown ⇒ present" fallback | `index.tsx` | Backend/Attendance domain (status enums authoritative) | **Move to server-provided stats or compute strictly from enum; remove fallback** |
| Pending-invoice count (`unpaid || !is_paid`) | `index.tsx` | Finance (`financial-position`, invoice statuses) | Replace with API figures — legacy derivation unverifiable |
| Billing separate/consolidated grouping | exists only in ZN schema (`student.ts:259`) | Finance | Client displays, never computes |
| Admission-number validation | login form + legacy fn | Identity/School structure | Unverifiable against Base44 internals — flagged contract-clarify |
| Role gating | none (single role) | Authorization registry (`permission-registry.ts`) | Client visibility via `my-permissions`; server enforces |

## Inconsistencies between docs and code
- Mobile README claims a generic create-expo-app starter ("Student Portal" reality differs); treat README as stale after D-6 cleanup.
- Backend `docs/api/ENDPOINTS.md` was used as orientation only; every endpoint cited in API_MIGRATION_MATRIX.md was re-verified in controller source. No doc-vs-code conflicts observed at v1.1.0 for the cited routes.

## Blockers summary (priority order)
1. ~~NEW-1 Guardian portal design~~ **RESOLVED 2026-10-12** (Option A, read-only; Phase 2B). Matrix rows 7–14 now gate on Phase 2B delivery, not on a decision.
2. ~~NEW-3~~ **RESOLVED = Option A** — OTP extension approved; still gates D-1 first-login requirement (password-only interim ships without it, behind feature flag).
3. ~~NEW-2~~ **RESOLVED = Option B (full push domain)** — gates the "due pushed by school" wording of D-3; poll interim dropped; Phase 2C added to roadmap.
4. Contract clarifications: results publication filter, pagination conventions, access-token TTL, login rate limiting.
