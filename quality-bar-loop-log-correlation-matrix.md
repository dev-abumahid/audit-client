# Quality Bar Loop — Correlation Matrix (`/organization/correlation-matrix`, CorrelationMatrixPage.tsx)

Target: average >= 9/10, every axis >= 7/10 floor. Max rounds: 10 (default,
not a hard stop per standing user instruction from the Risk Matrix loop).
Active judges: industry-standards, UX, efficiency, accessibility, visual
polish, resilience & edge cases, code quality, mobile/responsive, security
(both conditional judges activated -- same setup as the Risk Matrix and
Risk Register loops: this page is a significant interactive matrix UI,
same risk profile).

Standing merge authorization: yes (carried over from the Risk Matrix loop
in this same session -- merge automatically once a fix passes review).

Started as the next item in the sidebar-navigation sweep, immediately
after the Risk Matrix loop paused at avg 7.89/10 (every axis >= floor).
User instruction: "keep going down the list of tabs."

## Round 1

| Axis | Score |
|---|---|
| Industry-standards | 6/10 |
| UX | 7/10 |
| Efficiency | 7/10 |
| Accessibility | 7/10 |
| Visual polish | 5/10 |
| Resilience & edge cases | 6/10 |
| Code quality | 8/10 |
| Mobile/responsive | 3/10 |
| Security | 9/10 |

**Average: 6.44/10.** Below target (9); 4 axes below floor (7):
industry-standards, visual polish, resilience, mobile.

Key findings by axis:

- **Industry-standards (6/10):** real drill-down (genuine `<button>`
  cells, `RiskDetailCard` side panel) beats a static heatmap. Root-
  cause x consequence framing is a genuine, ISO-31000-adjacent
  differentiator from RiskMatrixPage, not just a reskin. Gaps: no
  export/print (same as RiskMatrixPage round 1); the cell color is a
  pure function of grid position (`(row+1+col+1)/(size*2)`), not a
  real interconnection metric -- a cell reading "Systemic" only means
  "far along both axes," not "these risks are actually highly
  interconnected." Real interconnection scoring (PageRank) exists but
  only behind the opt-in AI Buckets tab, which failed on live test
  against this environment's backend. No hover-preview of in-cell
  risk names.
- **UX (7/10):** the stale-selection fix (`aexa-frontend#257`) is
  already shipped and verified live in both directions (matrix-size
  change, site-filter change) -- unlike RiskMatrixPage, this bug class
  was already closed here. New finding: **zero URL-state sync** --
  site filter, view mode, matrix size, and cell selection all reset on
  browser back after clicking into a linked risk, live-reproduced.
  Same finding RiskMatrixPage had before its own round 12 fix. Dense,
  ungrouped control row (10+ clickable targets, no group labels) is a
  learnability rough edge.
- **Efficiency (7/10):** all derived data correctly memoized with
  tight dependency arrays -- the strongest part of the page. Gaps:
  `riskMetrics` does an O(risks x links) double-filter per risk with
  no indexing by ref; `axisLabels` rebuilds unmemoized every render
  (up to 10 `t()` calls); no `React.memo` on repeated card/list
  components (low real cost at stated scale).
- **Accessibility (7/10):** cells are real buttons with contextual
  aria-labels and aria-pressed; heading hierarchy was already fixed
  (issue #473, sr-only h2s added). One real contrast gap: the
  "Systemic" (critical) cell's small sub-label text computes to
  ~4.38:1 in LIGHT theme, just under the 4.5:1 AA floor for small text
  (dark theme clears it at 4.79:1) -- inverse of RiskMatrixPage's
  dark-mode-only contrast gaps. No focus management on cell select (no
  focus move, no announcement) and no keyboard deselect path -- same
  two gaps RiskMatrixPage's round 1 found, fixed there in round 8.
- **Visual polish (5/10):** the SAME legend-vocabulary bug
  RiskMatrixPage had and fixed (round 9) -- this page's legend says
  "Systemic/High interconnection/Moderate/Isolated" while
  `RiskDetailCard`'s own `RiskBadge` on the same page says
  "Critical/High/Medium/Low" via the canonical `riskLevel.*` keys.
  That fix was never ported here. Additionally, 4 separate spots use
  raw hardcoded `bg-amber-500/10`/`bg-blue-500/10` chips bypassing
  `severityBadgeClasses` entirely, with a confirmed dark-mode
  legibility problem (muddy dark-blue-on-navy). Matrix cell colors
  themselves do correctly reuse the shared `--risk-*` ramp.
- **Resilience (6/10):** stale-selection and dedicated-empty-states
  are ALREADY fixed here (unlike RiskMatrixPage's round-1 baseline) --
  a real difference between the two pages despite similar structure.
  But `isError` was never destructured from either
  `useGetCorrelationMatrixDataQuery` or `useGetAllSitesQuery` -- the
  exact gap RiskMatrixPage fixed in its own round 3, never ported
  here. A milder numeric silent-fallback (`|| 0` on
  `financial_impact_max`, a non-optional typed field) plus zero
  normalization on AI-bucket numeric fields (`pageRankScore`,
  `estimatedRiskReduction`) feeding straight into `t()` interpolation
  with no guard against NaN/undefined.
- **Code quality (8/10):** genuinely strong -- most non-obvious
  decisions have real "why" comments citing concrete issue numbers,
  and the test file is exceptionally well anchored to real prior bugs
  (#549, #569, #257, #376, #394, #473, #620, #194, #357/#393). Minor
  gaps: unnamed magic thresholds in `getCellColor`, a site-name lookup
  pattern duplicated across 3 call sites, one un-encoded `risk.id`
  path segment (low risk, backend UUID not free user input).
- **Mobile (3/10):** the lowest score this round, and nearly identical
  bugs to RiskMatrixPage's own round-1 baseline (shared layout
  lineage): the row-label column scrolls away with the grid on
  horizontal scroll (measured live, label goes to x:-151 off-screen);
  the legend clips with two full swatches rendering entirely outside
  the 375px viewport with no scroll affordance; toggle buttons measure
  28px tall (under the 44px guideline) with zero gap between adjacent
  buttons (mis-tap risk). One difference from the sibling: the header
  actually stacks responsively here already, no crushed wrap.
- **Security (9/10):** no `dangerouslySetInnerHTML`, all query-string
  values properly `encodeURIComponent`-wrapped except one low-risk
  path-segment UUID, mutation UI correctly role-gated
  (ADMIN/LEAD_AUDITOR only, verified in tests across all 4 roles), no
  sensitive logging.

**Next fix (Round 2):** mobile is both the single worst axis (3/10)
and the most mechanically proven fix available -- RiskMatrixPage's
round 7 already solved the identical bug class (sticky row-label
column, legend-outside-scroll-wrapper, 44px touch targets) on a
structurally similar page in this same session. Porting that same
fix shape here is the highest-leverage, lowest-risk next step.
