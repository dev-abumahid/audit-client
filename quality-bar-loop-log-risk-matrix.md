# Quality Bar Loop — Risk Matrix (`/organization/risk-matrix`, RiskMatrixPage.tsx)

Target: average >= 9/10, every axis >= 7/10 floor. Max rounds: 10 (default).
Active judges: industry-standards, UX, efficiency, accessibility, visual polish,
resilience & edge cases, code quality, mobile/responsive, security (both
conditional judges activated -- same setup as the Risk Register loop).

Standing merge authorization: yes (carried over from this session's Risk
Register loop -- merge automatically once a fix passes review).

Note: this page already shows prior iteration -- code comments reference
issues #194, #359, #412, #472, #497, #519, #548, and the test file has
24 substantive, regression-anchored tests. This loop judges the page's
current state fresh, not from a zero baseline.

## Round 1

| Axis | Score |
|---|---|
| Industry-standards | 6/10 |
| UX | 5/10 |
| Efficiency | 7/10 |
| Accessibility | 7/10 |
| Visual polish | 6/10 |
| Resilience & edge cases | 3/10 |
| Code quality | 7/10 |
| Mobile/responsive | 4/10 |
| Security | 9/10 |

**Average: 6.0/10.** Below target (9); 5 axes below floor (7): industry-standards,
UX, visual polish, resilience, mobile.

Key findings by axis:

- **Industry-standards (6/10):** color ramp/axis orientation match ISO 31000
  convention, a legend exists, cells show a count badge (not just color) and
  drill-down works well. Gaps: no export/print of the matrix itself (contrast:
  Risk Register has CSV export), zero risk-scoring transparency (the on-cell
  number is a row*col coordinate product, not the risk's actual score, which
  users could easily misread), no hover-preview of in-cell risk names. **Also
  found: selection state isn't reset when matrix size changes -- reproduced
  live, the panel showed stale data for an unintended cell.**
- **UX (5/10):** controls are discoverable and cell-click feedback is
  immediate and clear. **Confirmed live (independently, a 2nd time): switching
  matrix size while a cell is selected corrupts the selection -- the ring
  jumps to an unrelated cell and the panel shows a self-contradictory state
  (a stale heading like "0 risks -- score 6" alongside the generic "click a
  cell" placeholder body).** Same contradictory state reproduces via the site
  filter narrowing a selected cell to zero matches. No URL/state sync -- all
  of matrixSize/groupMode/siteFilter/selectedCell resets on navigating away
  and back (e.g. clicking through to a risk detail page and hitting browser
  back).
- **Efficiency (7/10):** the important algorithmic piece (bucketing risks
  into cells once via a single forEach, not O(n*m)) is done correctly and
  memoized. Matrix-size toggle is correctly client-side only, no refetch.
  Minor gaps: the `labels` object re-runs `t()` on every render regardless of
  relevance; `selectedRisks`'s eslint-disabled fresh-array fallback breaks
  referential stability into a downstream memo; no React.memo on grid
  cells/RiskCard (low real-world cost at this page's realistic scale).
- **Accessibility (7/10):** cells are real `<button>`s with full semantic
  aria-labels (likelihood x impact x count) -- the classic "colored div
  grid" failure mode is already solved. Color contrast passes WCAG AA in
  both themes (verified via rendered RGB + blend math). Gaps: no focus
  management into the details panel after selecting a cell (no announcement,
  no aria-live), no keyboard way to close/deselect the panel (Escape does
  nothing, and no click-to-toggle-off exists for a populated cell).
- **Visual polish (6/10):** grid styling, hover/selected states, and the
  details panel's card design are genuinely polished, with documented
  contrast-verification work already done for the dark-mode `bg-risk-high`
  tint. Gaps: the legend labels ("Critical/Major/Moderate/Weak") don't match
  the vocabulary used two inches away by RiskBadge/severityBadgeClasses on
  the same page's own RiskCards ("Critical/High/Medium/Low") -- same 4-bucket
  concept, two vocabularies on one screen. The "Moderate" bucket's alpha-blended
  color renders as muddy olive/khaki rather than a clean amber. The toggle
  button visual language also diverges from RiskRegisterPage's single-toggle
  pattern (filled-pill vs. severityBadgeClasses-bordered), though it matches
  CorrelationMatrixPage's segmented-control convention exactly.
- **Resilience (3/10):** the lowest score this round, driven by concrete,
  reproduced bugs: (1) `isError` is never destructured from either
  useGetAllRisksQuery or useGetAllSitesQuery -- a genuine fetch failure
  renders a fully-formed, normal-looking empty matrix, byte-for-byte
  indistinguishable from "this org has zero risks," with zero error
  indication anywhere; (2) no dedicated empty state -- the subtitle count
  text would misleadingly read "0 risks positioned" with no explanation;
  (3) malformed/missing probability or inherent_score silently resolves to 0
  via `Number(x) || 0`, landing a risk with genuinely unknown scoring in the
  lowest-likelihood/lowest-impact cell with no visual flag it's a fallback;
  (4) the same stale-selection mismatch bug UX and industry-standards
  independently found, confirmed here via code + live reproduction as a
  correctness bug, not just a UX rough edge.
- **Code quality (7/10):** genuinely well-maintained code with real
  discipline -- `mapRiskToCell` is a clean, pure, well-tested function with a
  documented prior-bug fix; strong cross-file convention reuse (RiskBadge,
  SiteFilter, riskCategoryLabel patterns explicitly cross-referenced from
  CorrelationMatrixPage/HeroProductVisual); substantive regression-anchored
  test coverage tied to real issue numbers. Gaps: `any`-typed grid records
  (`Record<string, any[]>`) under a file-level eslint-disable that isn't
  needed for anything else in this file; unnamed magic color-threshold
  constants (0.64/0.36/0016); the category-label fallback IIFE is
  duplicated verbatim in two places (group header + RiskCard).
- **Mobile (4/10):** cell touch targets are actually fine (56.8x64px at
  375px, well above the 44px minimum) -- the real problem is structural:
  the likelihood row-label column scrolls away together with the grid cells
  inside the same horizontal-scroll wrapper (not frozen/sticky), so a user
  can't see a cell's row label and a rightmost-column cell at the same time
  on a phone -- this actively breaks the matrix's core reading task, not
  just "squeezed." The legend also clips at 375px with zero visible scroll
  affordance. The header's `flex items-start justify-between` with no
  responsive stacking crushes the page title into an ugly 4-line wrap at
  375px, and the matrix-size/group-mode toggle buttons measure only 28px
  tall (under the 44px touch-target guideline).
- **Security (9/10):** clean. Read-only page, no `dangerouslySetInnerHTML`,
  no mutation surface needing role-gating, no console logging of sensitive
  data, both dynamic URL params (`risk.site_id`, site name) correctly
  wrapped in `encodeURIComponent`, React's own JSX escaping handles all
  interpolated risk text. No findings.

**Next fix (Round 2):** the stale-selection mismatch bug is the single
highest-leverage fix -- independently found and live-reproduced by three
separate judges (industry-standards, UX, resilience) across two different
triggers (matrix-size change, site-filter change). It's a genuine
correctness bug (the panel displays contradictory/wrong information, not
just a rough edge), it's the most-corroborated finding of the round, and
fixing it (clear or remap `selectedCell` whenever the set of risks in that
cell changes) is a contained, well-scoped change.

## Round 2 (stale-selection fix, PR #634)

Fixed the round-1 headline bug: selectedCell stored raw {row, col}
indices with no record of matrix size, so switching size (or narrowing
the site filter) could show a DIFFERENT risk's data or a
self-contradictory "0 risks -- score N" panel. Fixed by storing size
alongside the selection and deriving an effectiveSelectedCell that
invalidates on mismatch (pure render-time derivation, no effect).

Two review rounds: round 1 found two related follow-on issues --
(1) effectiveSelectedCell only masked the stale selection for display,
never actually clearing selectedCell, so switching size away and back
resurrected the old selection; (2) a cell's own ring/highlight stayed
showing after a filter emptied it, inconsistent with the panel already
showing "nothing selected". Both fixed same round with negative-control
tests. Round 2 came back clean.

Re-scoring not yet done -- resilience, industry-standards, UX, and
mobile were the round-1 axes most implicated by this bug family and are
the natural next re-judge targets, but this session has already run a
very long, high-volume sequence of rounds across two pages. Logging the
fix now; next step is a fresh judge panel to confirm the resilience
score genuinely moved off its 3/10 floor before picking the next fix.

## Round 2 re-check (resilience axis)

| Axis | Score | vs. round 1 |
|---|---|---|
| Resilience & edge cases | 4/10 | +1 |
| (all other axes) | not yet re-judged | -- |

Judge confirmed finding (4) -- the stale-selection bug -- is fully fixed
and verified live in both directions (5x5->3x3->5x5, no resurrection).
The other three round-1 findings remain untouched:
1. No isError handling on either query (arguably the most consequential
   for a compliance tool -- a fetch failure is indistinguishable from
   "zero risks").
2. No dedicated empty state / misleading subtitle text.
3. Malformed probability/inherent_score silently resolves to 0 with no
   visual flag.

**Status:** this loop is paused here, not stopped -- round 2 fixed the
single most-corroborated, highest-severity bug from round 1 (found
independently by 3 judges), but the isError gap (finding 1) is the
clear next highest-leverage fix and hasn't been picked up yet. Resuming
this loop should start there.

## Round 3 (isError + empty-state, PR #635)

Fixed round-1 finding (1) and (2): neither `useGetAllRisksQuery` nor
`useGetAllSitesQuery` destructured `isError`, so a genuine fetch failure
fell through to `risks: []`/`sites: []` and rendered a fully-formed,
normal-looking empty matrix -- byte-for-byte indistinguishable from "this
org genuinely has zero risks." Also added a dedicated empty state for
genuinely-zero-risks.

- Risks query failure now replaces the whole matrix with a dedicated
  error state (every control is meaningless without data).
- Sites query failure gets a small inline warning banner instead --
  only affects per-card site-name lookups, doesn't block the matrix.
- Empty-state notice is additive (renders alongside the still-rendered
  grid/labels/legend), not a replacement -- several existing tests rely
  on the grid rendering even with zero risks for unrelated reasons
  (axis labels, legend colors, a cell's aria-pressed state). Mirrors
  RiskRegisterPage's established additive-notice convention.

Two review rounds: round 1 (two parallel reviewers) found one minor
issue -- the "N risks positioned" subtitle contradicted the new
empty-state notice when risks were empty ("0 risks positioned -- Click
on a cell..." right above "No risks scored yet"). Fixed same round
(suppress the subtitle when empty) per this session's fix-don't-defer-
small-findings convention. Round 2 came back clean.

Live-verified: the error state was hit organically (backend wasn't up
yet when the page first loaded, producing a real ERR_CONNECTION_REFUSED
that rendered the new error UI correctly); the golden path (26 seeded
risks, cell selection, detail panel) was confirmed regression-free once
the backend started. The empty-state and sites-error UI were not
independently live-triggered (no real zero-risk site existed in the
seeded dataset during this session) -- covered instead by negative-
controlled unit tests.

Finding (3) from round 1 (malformed probability/inherent_score silently
resolving to 0 with no visual flag) remains open, along with the
broader UX/industry-standards items (export, risk-scoring transparency,
mobile row-label scroll, legend vocabulary mismatch). Next step:
re-dispatch the resilience judge (and industry-standards/UX, since they
also referenced the isError/empty-state gaps) to confirm this round's
fix actually moved the score before picking the next fix.

## Round 3 re-check (resilience axis)

| Axis | Score | vs. round 2 |
|---|---|---|
| Resilience & edge cases | 8/10 | +4 |
| (all other axes) | not yet re-judged | -- |

Judge independently killed the backend and reloaded the page live --
confirmed the dedicated error state renders (not a blank matrix), then
restarted the backend and confirmed the golden path (26 risks, cell
selection) is fully intact with no regression. Findings (1) and (2) are
confirmed fixed; the round-2 stale-selection fix is confirmed untouched
and still working. Docked to 8/10 (not higher) because finding (3) --
malformed probability/inherent_score silently resolving to 0 with zero
visual distinction from a genuinely-low-scored risk -- is a real
data-integrity blind spot on a compliance tool's own risk matrix, known
since round 1, and still open.

**Status:** this loop is paused here, not stopped. Finding (3) is the
clear next highest-leverage fix within resilience. The broader
UX/industry-standards items from round 1 (export, risk-scoring
transparency, mobile row-label scroll, legend vocabulary mismatch)
remain open too, but haven't been re-scored since round 1 -- a fresh
full panel is the right move once finding (3) ships, both to confirm
resilience's remaining ceiling and to get current numbers on the
axes that haven't moved since round 1.
