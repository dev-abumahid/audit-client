# Quality Bar Loop — Threat Intelligence (`/organization/intelligence`, IntelligencePage.tsx)

Target: average >= 9/10, every axis >= 7/10 floor. Max rounds: 10 (default,
not a hard stop per standing user instruction carried over from earlier
loops in this same session).
Active judges: industry-standards, UX, efficiency, accessibility, visual
polish, resilience & edge cases, code quality, mobile/responsive, security
(both conditional judges activated -- the page has role-gated mutations
and at least one real input, same risk profile as the other org pages
already looped this session).

Standing merge authorization: yes (carried over from earlier loops in this
same session -- merge automatically once a fix passes review).

Started as the next item in the sidebar-navigation sweep, immediately
after the KRI Dashboard loop paused at avg ~7.44/10 (industry-standards
and code quality both needing product/design-scoped work this loop
shouldn't make unilaterally). No prior quality-bar-loop history exists
for this page. User instruction: "keep going down the list of tabs."

## Round 1

| Axis | Score |
|---|---|
| Industry-standards | 4/10 |
| UX | 6/10 |
| Efficiency | 8/10 |
| Accessibility | 7/10 |
| Visual polish | 8/10 |
| Resilience & edge cases | 4/10 |
| Code quality | 7/10 |
| Mobile/responsive | 5/10 |
| Security | 8/10 |

**Average: 6.33/10.** Below target (9); 4 axes below floor (7):
industry-standards, UX, resilience, mobile.

Key findings by axis:

- **Industry-standards (4/10, lowest):** no run history/versioning --
  every AI report query uses `limit: 1`, only the single latest run per
  type is ever shown, no way to browse/compare past runs despite
  `IntelligenceRun` being a paginated, timestamped resource
  server-side. No "generated on" timestamp rendered anywhere even
  though `rcsa_date`/`analysis_date` exist in the schema.
  `PredictResult.confidence` exists in the typed response but is never
  displayed. Significant AI output fields are silently dropped from
  rendering across all 4 panels (category/estimated_impact/
  early_indicators, key_drivers, mitigation_type/norm_reference/
  risk_reduction, type/source/affected_sites/corrective_action/
  financial_impact, management_actions). No citation/source-tracing
  back to specific intelligence items. `canCreateRisk` finding->risk
  conversion IS done well (role-gated, tag-invalidating, deep-links to
  the created risk) -- a genuine strength.
- **UX (6/10):** action bar well organized (ingestion actions visually
  distinct from a labeled "AI REPORTS" cluster); loading states
  per-button with visible spinners; real backend failures surfaced as
  clear toasts. Gap: could not verify actual in-progress experience for
  a multi-minute AI run (backend 500'd instantly in this environment);
  create-risk flow has no confirmation/preview step before creating a
  formal risk record.
- **Efficiency (8/10):** no unmemoized-derived-data bug class found
  (unlike the sibling KriDashboardPage) -- search is server-side and
  debounced 500ms, no client-side re-filtering. No polling; RTK Query
  tag invalidation drives refetch. Minor: 6 separate query hooks fire
  on mount (N+1-style fan-out), though each payload is tiny.
- **Accessibility (7/10):** all actions are real buttons with visible
  text labels (no icon-only buttons); severity never color-only
  (RiskBadge always pairs color + text); heading hierarchy correct and
  tested. Gap: no focus management when a report panel first appears
  (no ref/focus(), no aria-live) -- a screen-reader user gets no
  indication new content was added below the action bar. The
  itemsFetching spinner has no aria-label/sr-only text either.
- **Visual polish (8/10):** correctly reuses the shared
  `severityStyles.ts` vocabulary via `RiskBadge`, not a hand-rolled
  color map (unlike 2 sibling pages this session). Consistent card/panel
  language across all 4 very different AI-report data shapes.
  Intentional visual hierarchy in the action bar (explicitly commented
  as a deliberate fix). Minor: "worsening" trend icon reuses
  `SEVERITY_STYLES.high.text`, conflating severity and trend semantics.
- **Resilience (4/10, tied-lowest):** confirmed LIVE via a
  `window.fetch` monkey-patch -- none of the 5 RTK Query hooks
  (items query + 4 run-history queries) destructure `isError`. A
  simulated fetch failure rendered the exact same "No intelligence
  items yet" empty state as a genuinely empty org, with zero error
  indication -- the same isError-omission bug class already found and
  fixed on 3 sibling pages this session, but the WORST instance of it
  yet (5 queries, not 1-2). Mutations by contrast are handled well
  (try/catch -> toast on all 6). Malformed AI-response handling is
  solid (explicit runtime type guards before rendering each panel). No
  timeout/progress messaging for slow AI calls.
- **Code quality (7/10):** the isError gap above is also this axis's
  main finding. Mutations share a clean `errorMessage()` helper (avoids
  6x duplicated error-extraction). Good self-documentation citing real
  issue numbers. Minor duplication: 4 structurally-identical AI-report
  handlers could collapse into one parameterized helper.
- **Mobile (5/10):** no horizontal clipping/overflow, responsive grids
  collapse correctly. But touch targets are undersized across the
  board: the 4 AI-report buttons measure 28px tall, severity filter
  chips 28px, pagination buttons 26px, per-item Create-Risk button
  ~24px, theme toggle 28x28px, search input 36px -- only the two
  primary ingestion buttons reach 40px (still short of 44px). Same bug
  class fixed on 3 sibling pages this session, but more pervasive here.
- **Security (8/10):** `canCreateRisk` role gate genuinely enforced
  server-side (`assertCanWriteOrgResource`), not just client-side --
  confirmed in aexa-server's own route comments and test coverage
  across all 4 roles. No dangerouslySetInnerHTML anywhere; all
  AI-generated content rendered as plain JSX text (auto-escaped).
  Search term flows through RTK Query's typed params object, safely
  encoded. Minor: raw backend error messages forwarded verbatim to
  toasts (low severity); 2 risk-id URL interpolations unencoded
  (low-risk, DB-generated UUIDs).

**Next fix (Round 2):** resilience is tied for the lowest score (4/10)
and the fix is the most proven, lowest-risk pattern in this entire
session -- add `isError` handling to the 5 RTK Query hooks (items query
+ 4 run-history queries), mirroring the exact fix already shipped on 3
sibling pages this session.
