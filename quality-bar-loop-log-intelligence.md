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

## Round 2 (resilience -- isError handling, PR #655)

Added `isError` handling to all 5 queries. Items query failure replaces
the item list (search/pagination stay live, unlike sibling pages, since
this page's header hosts independent action buttons that don't depend
on the items fetch) with a distinct error state. Each of the 4
report-run queries failing shows an inline notice in place of that
panel, gated on `!xResult` so a stale-but-valid result from an earlier
success is never clobbered by a later failed refetch.

Negative control confirmed the new tests fail without their respective
halves of the fix. Review round 1: angle A found a real bug -- the
items-list branch checked `itemsError` alone (no `!items.length`-style
guard), unlike the 4 report panels' correct `xError && !xResult`
pattern, so a failed REFETCH after an already-successful page (e.g.
paginating) would have discarded a real, valid stale list in favor of
the error message. Fixed same-round with a new regression test (stale
data survives isError=true when real data is still present) and its
own negative control; angle B live-verified the diff's structure and
i18n completeness, confirmed unit-test coverage was faithful, but
couldn't force a genuine live failure through a `window.fetch`
monkey-patch in this specific attempt -- a known environmental
limitation (documented in this session's own memory: RTK Query's
internal fetch reference can miss a post-load patch) -- rather than a
code issue; I had already live-verified all 5 error states rendering
correctly before opening the PR. Review round 2 (scoped to the fix
commit): implicitly clean, same negative-control discipline applied.

**Status:** resilience should clear the floor now, and clear it more
convincingly than any prior instance of this fix pattern this session
(5 queries fixed at once, plus a genuine stale-data-preservation bug
caught and fixed in the same round). Remaining below-floor axes:
industry-standards (4/10, the lowest -- needs real feature/design work:
run history, timestamps, confidence indicators, source citations),
UX (6/10), mobile (5/10 -- the proven touch-target fix pattern, not yet
applied here). Picking mobile next: same well-established h-11/h-11-w-11
pattern already shipped on 3 sibling pages this session, lowest risk of
the remaining below-floor axes.

## Round 3 (mobile -- touch targets, PR #656)

Bumped every button on the page to a 44px touch target (`h-11`): the 2
primary actions (40px), the 4 AI-report buttons (28px), severity filter
chips (28px), the search input (36px), the per-item Create Risk button
(~24px), and pagination Previous/Next (26px) -- the widest single
application of this session's proven fix pattern (9+ buttons on one
page, vs. 3-5 on each sibling page).

Negative control confirmed the new test fails without the fix. One
review round, both reviewers returned zero blocking findings -- angle A
verified the severity-chip template literal's conditional background
class survived the edit correctly, and flagged one pre-existing,
unrelated i18n pluralization question (not introduced or worsened by
this PR); angle B live-verified all button groups (primary actions, AI
reports cluster, severity chips, pagination) at 44px with correct
vertical centering and no visual cramping, matching the class-ordering
convention already established on 3 sibling pages.

**Status:** mobile should clear the floor now. Remaining below-floor
axes: industry-standards (4/10, still the lowest) and UX (6/10). Both
need real product/design scoping this loop shouldn't make unilaterally
-- run history/versioning, timestamps on AI reports, surfacing the
confidence score already in the data, source citations back to
specific intelligence items, and a preview/confirmation step before
create-risk. This is a natural pause point for the Threat Intelligence
loop: 3 rounds shipped (isError x5, touch-targets x9+), the two
remaining gaps are feature-shaped work, not mechanical fixes -- the
same wall CorrelationMatrixPage's industry-standards axis and the KRI
Dashboard's industry-standards/code-quality axes hit. A fresh
full-panel re-score would be the natural next step before deciding
whether to attempt a scoped industry-standards fix (e.g. surfacing the
already-computed `confidence`/`*_date` fields, the cheapest of the
industry-standards findings) or pause here per the standing "scope
ambiguous things, keep going down the list of tabs" instruction.
