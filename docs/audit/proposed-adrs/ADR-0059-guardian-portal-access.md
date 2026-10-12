# ADR-0059 — Guardian Portal Access Model (Read-Only)

## Status

**Accepted** — 2026-10-12, on the owner's instruction "APPROVE THE ADRS AND MOVE TO PHASE 2". Written on the owner's approval of the Phase 1 migration design: D-2 (guardian app with multiple linked students, combined + separate detail views) and NEW-1 = Option A ("guardian portal routes to be mostly readonly for now"). Acceptance authorizes the *design*; implementation occurs in backend Phase 2B under its own acceptance gate (docs/audit/IMPLEMENTATION_ROADMAP.md). No code has been written.

Numbering note: drafted as the next sequential number after backend ADR-0058 (`docs/adr/` at tag v1.1.0, commit `5e57b1b`). If the backend repo allocates a different number when filed, renumber here and update references in `docs/audit/*`. Related: ADR-0003 (auth), ADR-0004 (tenancy convention), ADR-0014 (RLS), ADR-0015 (portal-user separation).

---

## Context

The ZN mobile app is migrating from Base44 to the existing NestJS/PostgreSQL backend. The first approved consumer scope is a **guardian portal**: a guardian installs the app, logs in with ZN credentials, sees their linked students as rows, with combined and per-student read-only detail views.

Verified constraints (backend source inspection at v1.1.0):

- `guardians` table has **no `user_id` column** (`apps/api/src/database/schema/student.ts:261-280`) — today there is no way to authenticate as a guardian.
- `student_guardians` link table exists (`student.ts:282-310`), already modeling many-to-many guardian↔student relationships with `defaultBillingMode` / `billingModeOverride` (combined vs separate family billing).
- All existing data routes are membership + permission gated; guardians hold **no membership rows**. `GET /tenancy/my-schools` is staff-only.
- Tenancy convention: explicit `tenantId` on scoped requests, validated server-side (ADR-0004); RLS provides defense-in-depth (ADR-0007, ADR-0014).
- Billing reads exist internally (`GuardianBillingService`) but are exposed only via staff-permissioned controllers.

## Options Considered

- **A. Parallel read-only `/portal/guardian/*` surface** with a dedicated guardian auth guard, reusing domain services. *(Chosen — NEW-1 approved.)*
- **B. Membership-based access** — synthetic guardian memberships/permissions. Rejected: pollutes the staff authorization model, contradicts ADR-0015's separation of portal users from staff members, grants broader write-capable permission surface than a read-only portal needs.
- **C. Client-side filtering of staff endpoints with a guardian token.** Rejected: treats the client as a security boundary, which the migration's security review forbids (docs/audit/AUTH_AND_TENANCY.md).

## Decisions

### D1. Schema change (additive only)

```sql
ALTER TABLE guardians ADD COLUMN user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX guardians_tenant_user_uq ON guardians (tenant_id, user_id) WHERE user_id IS NOT NULL;
```

One app user maps to at most one guardian record per tenant. Nullable, so existing guardians remain usable by staff flows until linked. Follows repo migration conventions; RLS registry updated so the linkage respects tenant isolation.

### D2. Linking lifecycle (staff act; no self-signup)

- Extend `PATCH /guardians/:id` (permission `guardian.update`) to accept `userId`; return **409** if that `userId` is already claimed by another guardian in the tenant.
- No public registration path. ADR-0015 Rule-5 rationale preserved: identity creation stays under administrative control.
- Web-admin provisioning UX for linking is tracked as a separate backend task, outside this ADR's acceptance.

### D3. Authentication & access model

- New **`PortalGuardianAuthGuard`**: validates the standard JWT (ADR-0003 stack), resolves the caller's `guardians` row via `user_id`, loads linked students via `student_guardians`.
- Guardians hold no membership rows; excluded from `my-schools` and all staff permission checks.
- Every portal request carries explicit `tenantId`; the guard re-validates the resolved guardian belongs to that tenant (ADR-0004 convention enforced server-side).
- Every `:studentId` path parameter is checked against the caller's linked students → **403** otherwise. A client-supplied student ID never grants access by itself.

### D4. Route surface (GET only)

| Route | Backing capability | Notes |
|---|---|---|
| `GET /portal/guardian/me` | guardian row + linked-student summary | profile, school, linkage info |
| `GET /portal/guardian/students` | `student_guardians` join | roster rows; billing mode included for combined/separate rendering |
| `GET /portal/guardian/students/:id/profile` | existing student profile service | aggregate re-shaped, not recomputed |
| `GET /portal/guardian/students/:id/attendance` | existing attendance read service | repo pagination conventions |
| `GET /portal/guardian/students/:id/exam-results` | existing exam results service | **published results only**, filtered server-side |
| `GET /portal/guardian/students/:id/invoices` | `GuardianBillingService` | respects `billingModeOverride` for consolidated family totals |
| `GET /portal/guardian/students/:id/payments` | `GuardianBillingService` | recent payments; draft invoices excluded |

All routes reuse existing domain services — no duplicated business logic, no new calculation paths. No write endpoints in this phase ("mostly readonly" per owner approval).

### D5. Error conventions

Standard repo error envelope: 401 missing/expired JWT · 403 unlinked student or wrong tenant · 404 resource absent within tenant · 409 duplicate userId claim.

## Consequences

- **Security/tenancy:** authorization fully server-side; a guardian can never read an unlinked student; RLS remains defense-in-depth. `guardians.user_id` is PII-adjacent linkage data covered by existing encryption-at-rest conventions.
- **Backend impact:** additive migration, one guard, thin read-only controller layer. Existing staff routes and the web app are untouched.
- **Mobile impact:** unblocks Phase 3 guardian shell (student rows; combined/separate views map onto `defaultBillingMode`/`billingModeOverride`). Login uses `POST /identity/login`; first-time OTP governed separately by ADR-0060.
- **Migration/rollback:** purely additive. Rollback = remove portal routes + `ALTER TABLE guardians DROP COLUMN user_id` after unlinking. No destructive rollout.

## Testing Requirements (Phase 2B acceptance gate)

1. Link/unlink lifecycle incl. 409 duplicate claim.
2. Cross-guardian access attempt → 403 (guardian A requesting guardian B's student).
3. RLS isolation: two tenants, identical student IDs — no leakage.
4. Consolidated-vs-separate totals parity against `GuardianBillingService` fixtures.
5. Exam-results endpoint returns published records only.
6. Unauthenticated/expired token → 401; wrong-tenant `tenantId` → 403.
7. Existing staff suites remain green (no regression).
