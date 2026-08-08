# Quality Bar Loop — Risk Register (`/organization/risks`, RiskRegisterPage.tsx)

Target: average >= 9/10, every axis >= 7/10 floor. Max rounds: 10.
Active judges: industry-standards, UX, efficiency, accessibility, visual polish,
resilience & edge cases, code quality, mobile/responsive, security (both
conditional judges activated by the user at Setup).

Standing merge authorization: yes, merge automatically once a fix passes review.

Note: this page already received one prior fix from the Dashboard loop
(PR #607/#606-era work added a client-side `?status=` filter with a
`FilteredByNotice` component, `isError` handling, and an empty-state row —
see quality-bar-loop-log.md's Dashboard entries for that history). This
loop judges the page's current state fresh, not from a zero baseline.

## Round 1

| Axis | Score |
|---|---|
| Industry-standards | 5/10 |
| UX | 5/10 |
| Efficiency | 5/10 |
| Accessibility | 7/10 |
| Visual polish | 6/10 |
| Resilience & edge cases | 8/10 |
| Code quality | 7/10 |
| Mobile/responsive | 4/10 |
| Security | 10/10 |

**Average: 6.33/10.** Below target (9) and 4 axes below floor (7): industry-standards, UX, efficiency, mobile/responsive.

Key findings by axis:

- **Industry-standards (5/10):** no sorting anywhere on the table; no real pagination — `useGetAllRisksQuery({ page: 1, limit: 100, ... })` hardcodes a silent 100-row cap with zero page UI, so an org with >100 risks loses rows with no indication; no bulk operations; no column customization/export. Filtering, approval workflow, and error/empty-state handling are genuinely above-bar.
- **UX (5/10):** subtitle still says "0 risks found" during a fetch error (contradicts the correctly-shown error row — a live-reproduced instance of the same "false all-clear" class already fixed once for the table itself); no retry affordance in the error state; the Add/Edit modal is one long undifferentiated ~15-field form; approval controls are cramped/low-discoverability; no bulk actions or sortable columns.
- **Efficiency (5/10):** search has no debounce — every keystroke fires a full new 100-row network request; hardcoded `page:1, limit:100` is a silent scale/correctness bug, not just inefficiency; `RiskApprovalControls` re-derives `useMyOrgRole()` per row instead of using the value the parent already computed; no `useMemo` on the two chained `.filter()` passes, so unrelated modal-field keystrokes re-trigger table filtering.
- **Accessibility (7/10):** table `<th>` elements lack `scope="col"`; empty actions-column header has no visually-hidden label; search input has no `aria-label`/associated `<label>` (placeholder-as-name anti-pattern). Modal focus management, `role="alert"` on the error state, accessible names on icon buttons, and color-not-alone severity signaling are all solid and live-verified.
- **Visual polish (6/10):** doesn't reuse the shared `RiskBadge` (hand-rolls severity pill inline) or `SourceBadge` (bare icon+text for AI/manual instead of the shared pill); inconsistent with sibling `RiskDetails.tsx`/`RiskGraphPage.tsx`'s `font-mono-data` convention for score/financial figures; no KPI/summary strip unlike `Overview.tsx`/`SitesEntities.tsx`.
- **Resilience (8/10):** the known-good `isError` fix on `useGetAllRisksQuery` is intact and live-verified (distinct error row with `role="alert"`, real outage reproduced). Gap found: `useGetAllSitesQuery` (feeds the site filter dropdown) has no `isError` handling at all — same real outage silently rendered "All Sites" with no options and no error indicator. Also: `(risk.financial_impact_max / 1000).toFixed(1)` has no null guard (renders literal "NaNM"); no loading skeleton for initial fetch.
- **Code quality (7/10):** doesn't reuse `RiskBadge` or the shared `Pagination` component (unlike sibling list pages `AllFindingsPage.tsx`, `AuditPage.tsx`, `CompliancePage.tsx`, `TemplatesPage.tsx`); file-wide `eslint-disable @typescript-eslint/no-explicit-any` at line 1 is broader than the two lines that actually need it; category badge computed via an inline IIFE in JSX; 1124-line monolith mixing list + 20+ field CRUD modal with no sub-component extraction. Test coverage is substantive and genuinely good (real business-logic regression tests, not superficial).
- **Mobile/responsive (4/10):** Edit/Delete row-action buttons measure 20×20px live (well under the 44×44 touch-target minimum), sitting ~4px apart with one being destructive; Name column stays hard-truncated (`max-w-32`) even at 768px tablet width where there's spare room; Add/Edit modal's internal grids are fixed `grid-cols-2`/`grid-cols-3` with no mobile stacking fallback, causing visible label-wrap and truncated `<select>` text at 375px. Table itself doesn't overflow the viewport (real breakpoints do hide columns), but no card-based mobile layout exists.
- **Security (10/10):** no `dangerouslySetInnerHTML`; role gating via the established `useMyOrgRole`/`canWriteOrgResource` pattern is used consistently; `?status=` URL param only feeds a strict string-equality filter, no injection surface; no sensitive console logging. Clean.

**Next fix (Round 2):** the missing-pagination gap is flagged independently by 3 axes (industry-standards: no page UI/silent data loss; efficiency: full-payload re-fetch with no debounce; code quality: sibling pages already reuse a shared `Pagination` component this page skips) — the single highest-leverage fix is wiring real pagination via the existing shared `Pagination` component, replacing the hardcoded `page:1, limit:100` fetch. This directly targets the worst structural gap in industry-standards and closes a real silent-data-loss bug at the same time.
