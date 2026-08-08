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
