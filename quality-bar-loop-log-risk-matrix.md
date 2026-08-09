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
