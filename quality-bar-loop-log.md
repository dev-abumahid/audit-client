# Quality Bar Loop — Organization Dashboard (`/organization`, Overview.tsx)

Target: average >= 9/10, every axis >= 7/10 floor. Max rounds: 10.
Active judges: industry-standards, UX, efficiency, accessibility, visual polish,
resilience & edge cases, code quality, mobile/responsive (security judge skipped —
page is read-only, no user input).

## Round 1 (baseline)

| Axis | Score |
|---|---|
| Industry-standards | 4/10 |
| UX | 5/10 |
| Efficiency | 5/10 |
| Accessibility | 6/10 |
| Visual/design polish | 7/10 |
| Resilience & edge cases | 3/10 |
| Code quality/maintainability | 7/10 |
| Mobile/responsive | 6/10 |

**Average: 5.4/10** — not converged (6/8 axes below floor of 7).

### Judge findings

**Industry-standards (4/10):**
- Hardcoded fake trend deltas (`trend="up" trendValue="+2"`/`"+3"`) on 3 of 6 KPI cards, presented as real period-over-period data. Code's own comment admits they're static placeholders.
- The entire "EBITDA at Risk / Monte Carlo" chart (the largest, most prominent chart on the page) is 100% fabricated static data with zero backend endpoint and zero "sample data" visual indication.
- Chart-type mismatch: percentile/Monte Carlo distribution data rendered as a continuous AreaChart, which visually implies a time series/trend rather than a static distribution snapshot.
- No time-range control or data-freshness indicator anywhere on the page.
- KPI cards have a `hover:border-primary/30` style implying clickability but no `onClick`/`Link` — contradicts the drill-down pattern already used correctly elsewhere on the same page (Tipping Points, Recent Alerts do link out).

**UX (5/10):**
- No drill-down on any of the 6 KPI cards (confirms industry-standards finding above).
- Same fabricated trend-badge issue, live-verified: "Critical alerts" card showed 0 while still displaying a red "+2 up" badge.
- All-or-nothing loading gate: 7 independent RTK Query hooks ORed into one `isLoading` — one slow query blocks the entire page behind a spinner.
- Same risk (CYB-001) shows two contradictory "PageRank" numbers on two different pages (100.0 on the dashboard's Tipping Points card vs. 0 on the risk's own detail page) with zero explanation of the discrepancy.
- Alerts are read-only, no dismiss/acknowledge/snooze action, empty state has no CTA.

**Efficiency (5/10):**
- `computePageRank` is called twice per render with identical inputs — once directly, once again internally inside `topPercentileByPageRank`. The codebase already has `topPercentileFromScores` specifically to avoid this double computation (its own doc comment says so), but Overview.tsx doesn't use it despite already holding `pageRankScores` in scope.
- Zero memoization anywhere in the file — no `useMemo`/`useCallback`/`React.memo` at all. All derived data (category breakdown, alert filters, revenue totals, PageRank pipeline) recomputes from scratch on every render regardless of cause.
- Chart source data (`categoryData`) is iterated 3 separate times per render (Pie data, Cell mapping, legend list) with no caching.
- Positive: per-item work is appropriately cheap at realistic scale (dozens/hundreds of rows), no O(n^2) patterns, `ebitdaData` is a module constant.

**Accessibility (6/10):**
- Both Recharts charts render as unlabeled `role="application"` landmarks with `aria-label: null` — no accessible data fallback at all, and tooltips are hover-only (never triggered by focus).
- Header icon-only controls (theme toggle, notification bell) have no accessible names.
- Heading hierarchy is correct and was clearly a deliberate prior fix (sr-only h2s, referenced issue #471) — genuine strength.
- Color is never used alone for severity/trend meaning — always paired with text or icon.
- Text contrast measured well above WCAG AA in dark mode (5.86:1 to 8.99:1 across sampled elements).

**Visual/design polish (7/10):**
- Strong, disciplined structural consistency: identical card shell, consistent type scale, `font-mono-data` used consistently for numeric values, matches sibling pages (Compliance, KRI Dashboard).
- Un-themed seam artifact on the category pie chart (a default Cell stroke line) sitting right next to the carefully-themed EBITDA chart.
- Ref badge in "Systemic Tipping Points" clips its own content: a 7-char ref like "CYB-001" wraps to two lines inside a fixed 36x36px box (no `shortRef()`-style truncation guard, unlike RiskGraphPage.tsx's equivalent).
- Asymmetric, unexplained trend-badge treatment: only 3 of 6 KPI cards get a colored trend pill, with no visual grouping/divider to explain why.
- Severity color-language diverges from sibling pages (flat teal icon for every metric here vs. tinted/colored status cards elsewhere).

**Resilience & edge cases (3/10) — lowest score, most severe finding:**
- **Critical finding, live-verified**: killing the backend entirely (`aexa-server` stopped) and reloading `/organization` renders a fully normal-looking dashboard with every metric silently showing 0/€0.0M and zero error banner, toast, or any visual cue that data failed to load. For a GRC/risk platform, this presents a false "all clear" on total backend failure — worse than a blank screen.
- None of the 7 `useGetXQuery` hooks check `isError`/`error`, only `isLoading`.
- Empty states (0 risks, 0 alerts) ARE handled well — verified live, genuinely good.
- Loading state is an all-or-nothing spinner (see UX/efficiency notes above) with no skeleton matching the actual layout.
- No defense against a well-formed-but-malformed API payload (missing/wrong-shaped fields would throw at render, not degrade gracefully).

**Code quality/maintainability (7/10):**
- File-wide `/* eslint-disable @typescript-eslint/no-explicit-any */` just to permit one `any` cast, when a real type already exists elsewhere in the codebase for that data.
- Duplicated Recharts `Tooltip` contentStyle object copy-pasted verbatim across two charts, where RiskGraphPage.tsx's convention would be a shared constant.
- 6 KPI cards hand-written individually instead of driven by a data array + `.map()` — fine at 6, but doesn't scale.
- Comment discipline is genuinely good (WHY not WHAT) and matches codebase convention.
- Test coverage (825-line Overview.test.tsx) is strong and behavioral, not superficial — asserts real business logic, i18n, locale-aware dates, a11y heading order.
- Loading-state check is a 7-way `||` boolean chain instead of one derived value.

**Mobile/responsive (6/10):**
- KPI grid and chart-row breakpoints work correctly and were deliberately built (`sm:grid-cols-2 lg:grid-cols-3`), verified at 375/768/1280px with no horizontal scroll.
- Sidebar collapses to hamburger appropriately at narrow widths.
- Same "Systemic Tipping Points" row bug independently confirmed (see visual polish above) — at 375px width, the rigid `flex` row with fixed-width blocks forces the ref badge to wrap and the risk name to truncate, with no mobile-specific stacking unlike the KPI/chart grids.
- Touch targets measured under the 44x44px guideline (risk-name link measured 86x20px), with `hover:underline` as the only affordance — meaningless on touch.
- `MetricCard` has zero responsive classes; not broken, but a long scroll to reach charts on mobile with 6 stacked cards.

### Chosen fix for round 2

**Resilience & edge cases (3/10, lowest score)**: add error-state handling so a
backend/API failure shows an explicit error indication instead of a silent,
misleading "everything is 0" false all-clear. This is the single most severe,
concrete, and highest-leverage finding across all 8 judges — a risk-management
platform silently presenting fabricated-looking "all clear" data on total
backend failure is a real trust/safety issue, not just a polish gap.

### Round 1 outcome — merged as PR #599

Shipped via `ship-with-review-loop`, 3 review rounds before converging clean:

- **Implementation**: added `isError` checks to all 7 RTK Query hooks in
  `Overview.tsx`, with a full-page error state (icon, message, Retry button
  that reloads) taking over when any query errors. Added the same isError
  check to `CriticalAlertBanner.tsx`'s own separate `useGetAllAlertsQuery()`
  call — a second, independent instance of the identical false-all-clear
  pattern the round-1 judges didn't call out individually but is in-scope
  for the same fix.
- **Review round 1** (on the initial commit): found `CriticalAlertBanner.tsx`
  had no error check at all — same bug class as Overview.tsx, different file.
  Fixed same round.
- **Review round 2** (on the CriticalAlertBanner fix): found the error notice
  and the normal banner shared one `dismissed` boolean — dismissing the error,
  then a later refetch succeeding with real critical alerts, left the banner
  permanently hidden (the same false-all-clear failure, delayed one step).
  Fixed by splitting into independent `dismissed`/`errorDismissed` flags.
- **Review round 3**: clean, no findings. Converged.
- Live-verified against a real backend outage (`aexa-server` stopped,
  `/organization` reloaded): both the full-page error state and the banner's
  error notice render correctly; both return to normal once the backend is
  back and the page reloads.
- QA gate: typecheck clean, lint clean (0 errors), full suite 1537/1537
  passing.

This closes the resilience axis's most severe finding. Industry-standards
(4/10, fabricated trend data + fabricated chart), UX (5/10, no drill-down +
all-or-nothing loading), efficiency (5/10, no memoization + duplicate
PageRank computation), and the rest of resilience's remaining findings
(no malformed-payload defense, all-or-nothing loading spinner) are still
open — round 2 re-scores before picking the next fix.

## Round 2 (re-score after PR #599)

| Axis | Round 1 | Round 2 | Δ |
|---|---|---|---|
| Industry-standards | 4/10 | 4/10 | — |
| UX | 5/10 | 5/10 | — |
| Efficiency | 5/10 | 5/10 | — |
| Accessibility | 6/10 | 5/10 | **↓ regression** |
| Visual/design polish | 7/10 | 7/10 | — |
| Resilience & edge cases | 3/10 | 7/10 | ↑↑ |
| Code quality/maintainability | 7/10 | 7/10 | — |
| Mobile/responsive | 6/10 | 6/10 | — |

**Average: 5.75/10** (up from 5.4/10) — not converged (5/8 axes below floor of 7).

**Guardrail tripped: regression.** Accessibility dropped 6→5. Per the skill's
own guardrail, this stops the loop for user escalation rather than
auto-picking round 3's fix.

### Why the regression happened

Round 1's fix added two new dynamic UI surfaces — `Overview.tsx`'s full-page
error block and `CriticalAlertBanner.tsx`'s error notice — that didn't exist
in round 1's baseline. Both inherited the same accessibility gaps round 1
had only flagged on the charts (no `role="alert"`/`aria-live` on
dynamically-appearing content, no focus management when the page's content
is replaced) and introduced one new one: `CriticalAlertBanner`'s icon-only
dismiss button (`&lt;X /&gt;`) has zero accessible name at all, worse than the
pre-existing header bell case round 1 flagged, since it has no text
fallback whatsoever. Net: two more places to fix, not new never-seen bugs.

### Other notable round-2 findings

- **Resilience's own review-loop fix may be dead code in production.**
  Both the resilience and mobile judges independently found that
  `CriticalAlertBanner`'s error path can never actually mount on the real
  `/organization` route: `Overview.tsx`'s own `isError` gate already
  includes `alertsError` (same query, same cache entry) and returns its
  full-page error first, before `&lt;CriticalAlertBanner /&gt;` ever renders.
  The dismiss/recover fix from PR #599's review round 2 is correct and
  unit-tested, but currently unreachable through the app's real render
  path — this needs its own decision (see below).
- **New, out-of-scope bug spotted by the UX judge**: navigating to a risk
  detail page (`/organization/risks/:id`) unexpectedly redirects back to
  `/organization`, both via direct URL and via the risk-name link. Not
  part of either target file; flagged for separate follow-up, not
  addressed in this loop.
- **New minor cross-axis observation**: the new error-state block's fixed
  400px-tall centered box leaves a large dead-space gap on real viewports
  (visual polish), and its Retry button is under the 44px touch-target
  guideline (mobile/responsive) — both are refinements to the round-1 fix,
  not new categories of problem.

### Round 2.5 outcome — merged as PR #600

User chose to fix both the regression and the dead-code finding before
continuing the loop, rather than deferring either. Shipped via
`ship-with-review-loop`, converged clean on review round 1:

- **Accessibility regression fix**: added `role="alert"` + a
  focus-on-mount effect to both error surfaces (Overview's full-page
  error block, CriticalAlertBanner's error notice) — these can appear
  from a background refetch failing after the page already rendered
  successfully (RTK Query keeps `isLoading` false on a refetch), not
  just on first paint, so they need an explicit announcement rather than
  relying on being present at initial render. Added
  `aria-label={t("common.close")}` (matching the codebase's existing
  convention) to both of CriticalAlertBanner's dismiss buttons.
- **Dead-code fix**: excluded `alerts`/`alertsError` from Overview's
  page-level `hasPageLevelError` gate. An alerts-only failure no longer
  takes down the whole dashboard — the Critical Alerts KPI card shows
  `—` instead of a false `0`, the Recent Alerts panel shows its own error
  notice instead of the "no alerts yet" empty state, and
  `CriticalAlertBanner`'s own error notice (previously unreachable) now
  genuinely mounts.
- **Review round 1**: clean, zero findings — hooks placement, the
  focus-effect's first-render behavior, every `alerts`-reading call site,
  cross-file reachability, i18n key placement, and test quality were all
  independently traced and confirmed correct. Converged after one round.
- QA gate: typecheck clean, lint clean (0 errors), full suite 1544/1544
  passing.
- Live-verified: a full backend outage still shows the page-level error
  with `role="alert"` and focus correctly landing on it; recovers to
  normal rendering once the backend is back, no new console errors. (The
  narrower alerts-only-failure path is covered by the passing unit tests;
  RTK Query's cache made it impractical to reproduce live without an
  SPA-navigation remount, which reused cached alert data instead of
  refetching.)

Still open going into round 3: industry-standards (4/10, fabricated trend
data + fabricated chart), UX (5/10, no drill-down + undifferentiated
loading), efficiency (5/10, double PageRank computation + zero
memoization), the remaining resilience gaps (loading skeleton,
malformed-payload defense), the out-of-scope risk-detail-page routing bug
spotted by the UX judge, and code quality's minor new duplication
(CriticalAlertBanner's two near-identical banner blocks).

## Round 3 (re-score after PR #600)

| Axis | Round 2 | Round 3 | Δ |
|---|---|---|---|
| Industry-standards | 4/10 | 4/10 | — |
| UX | 5/10 | 6/10 | ↑ |
| Efficiency | 5/10 | 5/10 | — |
| Accessibility | 5/10 | 7/10 | ↑↑ (recovered above round 1's 6/10) |
| Visual/design polish | 7/10 | 7/10 | — |
| Resilience & edge cases | 7/10 | 9/10 | ↑↑ |
| Code quality/maintainability | 7/10 | 7/10 | — |
| Mobile/responsive | 6/10 | 6/10 | — |

**Average: 6.375/10** (up from 5.75/10) — not converged (4/8 axes below
floor of 7: industry-standards, UX, efficiency, mobile). No regression
(every axis held or improved) and no stagnation (three straight rounds of
average improvement) — guardrails clear, loop continues.

### Round 3 highlights

- **Resilience 7→9**: the dead-code fix from PR #600 genuinely closed the
  gap. Live-verified full-outage path still works; the alerts-only path
  was confirmed correct by reading the actual test assertions (not just a
  green run) since RTK Query's shared backend made it impractical to
  isolate live. Remaining gap to 10/10: no loading skeleton, no
  malformed-payload defense — both explicitly out of scope for this fix.
- **Accessibility 5→7**: fully recovered from the round-2 regression and
  landed above round 1's original 6/10. Live-verified `role="alert"` +
  focus-on-mount actually fires (not just present in source) on both
  targeted surfaces. One new, minor miss found: the *third* error surface
  PR #600 itself added (the Recent Alerts panel's inline notice) has
  `role="alert"` but no focus-on-mount like its two siblings — flagged as
  low-severity since `role="alert"` is itself an implicit live region,
  appropriate for a small inline sub-panel rather than a full-page
  takeover.
- **UX 5→6**: the judge credited the partial-degradation design (one bad
  endpoint no longer takes down the whole page) as a real improvement,
  while noting it's not fully resolved: the Critical Alerts KPI card's
  bare "—" fallback doesn't self-explain "error" vs. "unknown" the way
  the two new text-based error notices do.

### Chosen fix for round 4

**Fabricated trend badges** (industry-standards' and UX's shared,
overlapping finding): `Overview.tsx` hardcodes `trend="up" trendValue="+2"`/`"+3"`
on 3 of 6 KPI cards with no backing period-over-period data anywhere in
the codebase. This is the single highest-leverage fix available:
- It's flagged independently by two judges across two different rounds
  each round.
- It's a correctness/trust issue, not just polish — UX's live check found
  the Critical Alerts card showing "0" alongside a red "+2 up" badge,
  actively self-contradictory on a screen already carrying its own
  distinct "—" error-fallback logic.
- Unlike the EBITDA chart (same axis, but genuinely blocked on a
  non-existent backend endpoint — real remediation is backend work out of
  scope for a frontend-only fix), the trend badges have no such
  dependency: removing fabricated data that overstates confidence is a
  pure frontend change.
- Fixes it for both industry-standards (removes the fabrication) and UX
  (removes the self-contradictory badge) in one change.

Deliberately not chosen this round: the EBITDA chart (blocked on backend
work), no-drill-down/PageRank-contradiction (larger scope, no single
judge-flagged fix as concrete/cheap as this one), and efficiency's
findings (real, but resilience/accessibility have priority per the "pick
from below-floor axes" rule, and industry-standards +UX's overlapping fix
is more clearly scoped this round).

### Round 4 outcome — merged as PR #601

Shipped via `ship-with-review-loop`, three commits, converged clean on
review round 3:

- **Core fix**: removed `trend`/`trendValue`/`trendGood` props from the
  Active Risks, KRI Alerts, and Critical Alerts `MetricCard`s in
  `Overview.tsx`, with a comment documenting why (no real data source)
  and what would need to exist to bring trend badges back correctly.
  Added a regression test asserting neither "+2" nor "+3" renders
  anywhere on the page.
- **Review round 1**: no bugs, but noted `MetricCard`'s entire
  trend-rendering feature was now dead code (no caller anywhere in the
  codebase passes those props anymore). Fixed same round: removed the
  dead props/JSX/icon imports from `MetricCard.tsx` itself.
- **Review round 2**: no bugs, but noted the outer flex wrapper div left
  behind was now vestigial (wrapping only one child, `justify-between`
  a no-op). Fixed same round: collapsed to a single wrapper.
- **Review round 3**: clean, zero findings — confirmed no CSS selector or
  test depends on the removed wrapper's DOM structure. Converged.
- QA gate: typecheck clean, lint clean (0 errors), full suite 1545/1545
  passing throughout all three commits.
- Live-verified: screenshot confirmed all three fabricated trend badges
  are gone from the rendered dashboard, no console errors. (The final
  two cleanup commits were pure dead-code removal with zero caller-visible
  behavior change, confirmed via the full passing test suite and code
  review rather than a second live reload — a session-induced Redis-backed
  API rate limit, tripped by this session's own heavy dashboard-reload
  testing, blocked further live reloads at that point; noted here rather
  than worked around, since the change carried no behavioral risk.)

Still open going into round 5: industry-standards' remaining findings
(fabricated EBITDA chart — blocked on backend work, chart-type mismatch,
no time-range/freshness indicator, non-clickable KPI cards), UX's
remaining findings (no drill-down, all-or-nothing loading, PageRank
contradiction, alerts read-only with no CTA), efficiency (double PageRank
computation, zero memoization, triple-iterated categoryData), the
out-of-scope risk-detail-page routing bug, and mobile's touch-target
sizes.

## Round 5 (re-score after PR #601)

| Axis | Round 3 | Round 5 | Δ |
|---|---|---|---|
| Industry-standards | 4/10 | 5/10 | ↑ |
| UX | 6/10 | 7/10 | ↑ |
| Efficiency | 5/10 | 5/10 | — |
| Accessibility | 7/10 | 7/10 | — |
| Visual/design polish | 7/10 | 7/10 | — |
| Resilience & edge cases | 9/10 | 9/10 | — |
| Code quality/maintainability | 7/10 | 7/10 | — |
| Mobile/responsive | 6/10 | 6/10 | — |

**Average: 6.625/10** (up from 6.375/10) — not converged (3/8 axes below
floor of 7: industry-standards, efficiency, mobile). No regression (every
axis held or improved), no stagnation (four straight panels of average
improvement: 5.4 → 5.75 → 6.375 → 6.625) — guardrails clear, loop
continues.

### Round 5 highlights

- Both industry-standards and UX ticked up exactly as predicted from the
  trend-badge fix closing one of each axis's open findings — no surprises,
  confirms the round-4 fix selection reasoning held.
- **Bonus finding**: this session's own heavy dashboard-reload testing
  tripped the local `aexa-server`'s real Redis-backed API rate limiter
  (429s). The resilience judge treated this as a live opportunity rather
  than noise: confirmed RTK Query's `isError` fires on a 429 exactly like
  a 500 or network failure, and `Overview.tsx`'s error state handles it
  correctly with no code changes needed — incidental extra confidence in
  the round-1 resilience fix's generality.
- Code quality judge noted PR #601 made the 6 KPI cards genuinely more
  uniform (identical prop shape now, none carrying trend props) — a real,
  if partial, step toward the still-open "data-driven `.map()`" finding,
  without that being the fix's stated goal.

### Chosen fix for round 6

**Double PageRank computation** (efficiency's top finding, unaddressed
across all 5 score-rounds so far): `Overview.tsx` calls `computePageRank`
directly to get `pageRankScores`, then calls `topPercentileByPageRank`
with the same inputs, which redundantly recomputes PageRank internally
instead of reusing `pageRankScores` via the `topPercentileFromScores`
helper that already exists in `src/utils/pageRank.ts` for exactly this
case. Chosen over industry-standards' and mobile's remaining findings
because:
- It's the single most mechanical, lowest-risk fix among the three
  below-floor axes — swap one function call for another with the same
  contract, no design decisions involved.
- It's been flagged identically, unaddressed, in every efficiency score
  since round 1 (5 rounds running) — the longest-standing untouched
  finding in the whole log.
- Industry-standards' remaining items are either backend-blocked (EBITDA
  chart) or larger UX/product decisions (time-range control, drill-down
  navigation) needing more design thought than a single round should
  absorb. Mobile's remaining items (touch-target sizing, ref-badge
  wrapping) are real but lower urgency than a redundant O(V+E) graph
  computation running on every render.

### Round 6 outcome — merged as PR #602

Shipped via `ship-with-review-loop`, converged clean on review round 1:

- **Fix**: swapped `topPercentileByPageRank(riskRefs, correlationEdges, 0.15)`
  for `topPercentileFromScores(riskRefs, pageRankScores, 0.15)`, reusing
  the `pageRankScores` already computed on the line above instead of
  recomputing PageRank's full power iteration a second time.
- **Review round 1**: clean. Verified `topPercentileByPageRank` is
  literally implemented as `topPercentileFromScores(nodes,
  computePageRank(nodes, edges), percentile)` internally, so the new call
  site is not merely equivalent but calls the identical code path the old
  one did — same sort, same tie-breaking, same slice logic, no possible
  divergence. Argument order, imports (old function no longer imported,
  no unused-import lint risk), and the existing cross-function test
  (`pageRank.test.ts`, non-trivial 8-node star graph, `toEqual` on both
  outputs) were all independently confirmed correct. Converged after one
  round.
- QA gate: typecheck clean, lint clean (0 errors), full suite 1545/1545
  passing, including `Overview.test.tsx`'s PageRank-ranking behavioral
  tests (Tipping Points ordering, hub-risk-outside-pagination) passing
  unchanged.
- Live-verification of this specific change's rendered output was blocked
  by this session's own heavy-testing having tripped `aexa-server`'s
  Redis-backed API rate limiter (429s, 15-minute window, independently
  confirmed by round 5's resilience judge to be handled correctly by the
  dashboard's own error state) — noted rather than worked around, since
  this is a pure internal refactor with a formally-verified-identical
  code path, not a rendering change.

Still open going into round 7: industry-standards (EBITDA chart blocked
on backend work, chart-type mismatch, no time-range/freshness indicator,
non-clickable KPI cards), UX (no drill-down, all-or-nothing loading,
PageRank contradiction, alerts read-only with no CTA), efficiency's
remaining findings (zero memoization, triple-iterated categoryData), the
out-of-scope risk-detail-page routing bug, and mobile's touch-target
sizes.

## Round 7 (re-score after PR #602)

| Axis | Round 5 | Round 7 | Δ |
|---|---|---|---|
| Industry-standards | 5/10 | 5/10 | — |
| UX | 7/10 | 7/10 | — |
| Efficiency | 5/10 | 6/10 | ↑ |
| Accessibility | 7/10 | 7/10 | — |
| Visual/design polish | 7/10 | 7/10 | — |
| Resilience & edge cases | 9/10 | 9/10 | — |
| Code quality/maintainability | 7/10 | 7/10 | — |
| Mobile/responsive | 6/10 | 6/10 | — |

**Average: 6.75/10** (up from 6.625/10) — not converged (3/8 axes below
floor of 7: industry-standards, efficiency, mobile). No regression, no
stagnation (five straight panels of average improvement: 5.4 → 5.75 →
6.375 → 6.625 → 6.75) — guardrails clear, loop continues.

The resilience judge additionally re-verified the PageRank refactor's
edge-case handling from scratch (empty-nodes, missing-score-entry cases)
rather than trusting PR #602's own review claim — confirmed identical to
the pre-refactor path, since both old and new call sites funnel into the
same `topPercentileFromScores` implementation.

### Chosen fix for round 8

**Zero memoization** (efficiency's remaining top finding): none of
`Overview.tsx`'s derived values — `categoryData`, `pageRankScores`/
`correlationEdges`/`tippingPointRisks` (the PageRank pipeline, up to 100
power-iteration passes), or the filter-based KPI counts — are wrapped in
`useMemo`, so all of them recompute from scratch on every render
regardless of cause, including unrelated state changes in sibling
components (e.g. `CriticalAlertBanner`'s own `dismissed` toggle) or the
focus-management effects added in earlier rounds. Chosen over
industry-standards (still backend-blocked/larger-scope) and mobile
(real, but the remaining findings are lower-urgency layout fixes, not a
graph algorithm running on every render) — same reasoning pattern as
round 6, and this closes efficiency's own longest-remaining item.
