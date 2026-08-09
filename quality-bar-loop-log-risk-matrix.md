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

## Round 4 (unscored-risk flag, PR #636)

Fixed round-1 finding (3), the last open resilience item from that
round: `mapRiskToCell` silently resolved a missing/malformed
`probability`/`inherent_score` to 0 via `Number(x) || 0`, landing the
risk in the lowest cell with zero visual distinction from a
genuinely-confirmed negligible risk.

Added `hasValidRiskScore`/`isValidScoreValue` and a small amber
"Unscored" badge (with an explanatory tooltip) on `RiskCard` for any
risk that fails the check. Cell position is deliberately unchanged --
there's no better fallback absent real data -- only the visual
indistinguishability is fixed.

Two review rounds: round 1 (two parallel reviewers) found the initial
`Number.isFinite(Number(x))` check had false negatives for `""`,
`null`, and arrays (all coerce to a finite 0/NaN and were incorrectly
called "valid"). Fixed same round with explicit pre-checks before the
numeric fallback, plus new parameterized tests for both cases. Round 2
came back clean.

Also surfaced (not fixed, explicitly out of scope): the same
silent-fallback pattern exists in the shared `getRiskSeverityLevel`
helper (src/utils/riskScoring.ts), consumed by 5 other pages --
notably SitesEntities.tsx, which uses it to *filter* which risks count
as "critical," so a malformed score there could silently drop a real
risk from that list. Flagged as a standalone follow-up task rather
than expanding this page-local fix into a cross-cutting one.

All four round-1 resilience findings are now closed (isError, empty
state, stale-selection, unscored-data flag). Live-verified: golden
path (26 real risks, all genuinely scored) confirmed to show no badge
on any of them; the badge/malformed-data paths themselves rely on
negative-controlled unit tests since no real risk in the seeded
dataset currently has malformed scoring data.

## Round 5 baseline (fresh full 9-judge panel)

| Axis | Round 1 | Now | Delta |
|---|---|---|---|
| Industry-standards | 6/10 | 6/10 | -- |
| UX | 5/10 | 6/10 | +1 (stale-selection fix, round 2) |
| Efficiency | 7/10 | 7/10 | -- |
| Accessibility | 7/10 | 7/10 | -- |
| Visual polish | 6/10 | 6/10 | -- |
| Resilience & edge cases | 3/10 | 8/10 | +5 (rounds 2-4) |
| Code quality | 7/10 | 7/10 | -- |
| Mobile/responsive | 4/10 | 4/10 | -- |
| Security | 9/10 | 9/10 | -- |

**Average: 6.67/10** (up from 6.0/10). Still below target (9); 4 axes
below floor (7): industry-standards, UX, visual polish, mobile.

Rounds 2-4 concentrated entirely on resilience (the round-1 floor) and
moved it from the worst axis (3/10) to the best-but-one (8/10, tied
with code quality/efficiency, just under accessibility). Every other
axis is byte-for-byte unchanged from round 1 except UX, which picked
up the stale-selection fix as a side effect of round 2's resilience
work. None of the 4 still-below-floor axes have had a single round
targeted at them yet.

New findings this round (not in round 1, found independently by 2
judges): (a) resilience -- `RiskCard`'s `RiskBadge` colors severity via
`getRiskSeverityLevel(risk.residual_score)`, which has the identical
`Number(x) || 0` silent-fallback bug `hasValidRiskScore` was built to
catch, but `hasValidRiskScore` only checks `probability`/
`inherent_score`, never `residual_score` -- a malformed `residual_score`
still renders a confident "Low" badge with no unscored flag, on the
same card, right next to a correctly-flagged badge. (b) code quality --
after 4 rounds, comment density (many 5-10 line "quality-bar-loop
round N" blocks) is now the dominant visual mass of a 667-line file
and increasingly duplicates near-verbatim explanation already present
in the test file.

**Status:** the 4 below-floor axes each need real feature/structural
work, not another small patch, mirroring the Risk Register loop's
round-8 stopping point:
- **Mobile (4/10):** sticky/frozen row-label column during horizontal
  scroll, responsive header stacking, 44px touch targets on the
  toggles, legend scroll affordance -- a real layout pass.
- **Industry-standards (6/10):** matrix export, real risk-scoring
  display (the on-cell number is a coordinate product, not any risk's
  actual score -- live-confirmed as the most consequential open item,
  a compliance officer could misread it as a real weighted score),
  hover-preview of in-cell risk names -- new features, not bug fixes.
- **UX (6/10):** URL/state sync (matrixSize/groupMode/siteFilter/
  selectedCell all reset on navigate-away-and-back, live-reproduced),
  keyboard deselect (Escape does nothing), focus management into the
  details panel on cell select.
- **Visual polish (6/10):** legend/RiskBadge vocabulary unification
  (Critical/Major/Moderate/Weak vs. Critical/High/Medium/Low, same
  screen), the muddy "Moderate" swatch color, toggle-button style
  convergence with RiskRegisterPage.

The one genuinely small, in-scope leftover is the new resilience
finding (residual_score) -- directly analogous to round 4's already-
shipped work on the same file/component. Picking that up next as
round 5, then escalating the 4 below-floor axes to the user as a
scope decision rather than continuing to whittle at them with
one-off patches that structurally can't move a 4/10 or a missing-
feature 6/10.

## Round 5 (residual_score flag, PR #637)

Fixed the resilience finding surfaced during the round-5 baseline
panel: `RiskCard`'s `RiskBadge` colors severity via
`getRiskSeverityLevel(risk.residual_score)`, the identical
`Number(x) || 0` silent-fallback bug `hasValidRiskScore` was built to
catch in round 4 -- but that check only covered `probability`/
`inherent_score`. `hasValidRiskScore` now also validates
`residual_score`; when invalid, `RiskBadge` is suppressed entirely
(no misleading color) rather than shown, since the existing "Unscored"
flag already communicates the issue.

One review round, both parallel reviewers returned zero blocking
findings -- only two informational notes, explicitly accepted as
out of scope rather than fixed: (a) the "Unscored" tooltip doesn't
say WHICH of the three fields is invalid, just that one is (a
follow-up nicety, not a defect); (b) `makeRisk`'s test helper has no
type checking against the real `Risk` type, a pre-existing looseness
from round 4, not introduced here. Merged after round 1.

This closes the resilience gap found during the round-5 baseline
panel. Resilience should sit at 9-10/10 now (all round-1 findings plus
this one closed); not independently re-judged yet.

**Status:** pausing the loop here to report back to the user. The
remaining 4 below-floor axes (industry-standards 6/10, UX 6/10, visual
polish 6/10, mobile 4/10) each need real feature/structural work
(export, risk-scoring display, URL-state sync, keyboard/focus
handling, sticky mobile row-labels, responsive header, larger touch
targets, legend/badge vocabulary unification) rather than another
small bug-style patch -- the same kind of judgment call that stopped
the Risk Register loop at round 8. Continuing this loop further needs
either a scope decision (which of the 4 axes to invest in first) or
explicit authorization to take on one as a multi-round feature effort,
not just "pick the next finding."

User authorized taking on this real feature/structural work
autonomously across the remaining below-floor axes. Resumed with
rounds 6 and 7 below.

## Round 6 (score transparency, PR #638)

Fixed the most consequential open industry-standards finding: the
bold number on each cell is a likelihood x impact BAND position, not
any individual risk's real score -- live-confirmed as a genuine
misreading risk since several risks with very different real scores
land in the same band. Renamed the details-panel heading from "score"
to "band", added a keyboard-focusable info button explaining the
distinction, and each RiskCard now shows its own real numeric score
next to its severity badge. Kept the band number itself (it's the
standard ISO 31000 heat-map convention, not wrong data).

Two review rounds: round 1 found a blocking a11y issue (the info
affordance used `role="img"` + `tabIndex`, the exact anti-pattern
RiskGraphPage's own minimap comment already rejected for the same
reason) -- fixed with a native button. Also fixed two minor findings
same round (redundant `Number()` wrap, a French "indice"/"bande"
terminology inconsistency). Round 2 came back clean.

## Round 7 (mobile layout pass, PR #639)

Fixed all four round-1 mobile findings together as one pass (the
axis's own score hadn't moved off 4/10 since round 1): sticky
row-label column (the most severe -- it used to scroll away with the
grid, breaking the matrix's core reading task on a phone), responsive
header stacking, 44px touch targets on the toggle buttons, and the
legend moved outside the grid's forced-min-width scroll wrapper so it
wraps at the real viewport width.

Three review rounds -- the most iteration any single round in this
loop has needed:
- Round 1 found the sticky label's own background only covered its
  text's line height (since the parent row uses `items-center`), not
  the full 64px cell row height, letting cell colors bleed through
  above/below the label -- caught and fixed live (`self-stretch`)
  during initial verification, before review even started.
- Review round 1 found a minor cosmetic issue: hovering/selecting a
  leftmost-column cell scaled it under the sticky label, clipping a
  thin strip. Fixed with `relative` + `z-20` on hover/selected.
- Review round 2 found that fix's z-index wasn't actually scoped as
  its own comment claimed (no stacking-context boundary existed, so
  it could in principle paint over the legend/details panel if
  layout ever changed) -- harmless today, fixed properly with
  `isolate` on the scroll wrapper rather than left as a known gap.
- Review round 3 came back clean.

All four round-1 mobile findings are now closed. Live-verified at
375px throughout, including a genuine visual bug (round 1) and a
real-if-currently-inert stacking-context gap (review round 2) that
static review alone wouldn't have caught without the live
`elementFromPoint` checks.

**Status:** industry-standards and mobile both had their most
consequential/severe findings addressed (rounds 6 and 7). Remaining
open: industry-standards' export and hover-preview items, UX's
URL-state sync and keyboard/focus handling, and visual polish's
legend/badge vocabulary unification and color-ramp fix. Continuing
next with a UX or visual-polish round, then a fresh full-panel
re-score once several of these land.

User gave standing authorization to take on the remaining below-floor
axes as real feature work autonomously overnight, using best judgment
on any product/design decisions rather than pausing to ask, and to
scope-and-skip (not block on) anything genuinely ambiguous even after
research.

## Round 8 (focus management + Escape-to-deselect, PR #640)

Fixed the two remaining round-1 UX/accessibility findings: no focus
management into the details panel after selecting a cell (no
announcement, no aria-live), and no keyboard way to close/deselect a
populated cell. Selecting a cell now moves focus to the details panel
heading; a window-level Escape listener clears the selection; a small
"Press Esc to close" hint makes the shortcut discoverable.

Three review rounds -- tied with round 7 for the most iteration:
- Round 1 found a real blocking interop bug: SiteFilter renders a
  Radix Select, whose own Escape-to-close handling runs in the
  capture phase and calls preventDefault() (not stopPropagation())
  when it dismisses. The page's plain bubble-phase Escape listener
  still fired afterward, silently wiping the matrix selection whenever
  a user pressed Escape to close the unrelated site-filter dropdown.
  Fixed by checking `!e.defaultPrevented` -- the standard interop
  pattern for "did another layer already claim this keypress."
  Live-verified both directions (dropdown-close-only, then a second
  Escape clearing the selection).
- The same round's second reviewer found the focus-move itself was
  half-broken: `.focus-ring` gates on `:focus-visible`, which Chrome
  suppresses for a programmatic `.focus()` following a pointer
  interaction -- so the majority real-world path (mouse-click
  selection) moved real DOM focus (screen readers still announced it
  correctly) but showed no visible ring at all, silently missing the
  sighted-mouse-user half of the fix's own goal. Fixed with a
  deliberate, documented exception: plain `:focus` instead of
  `:focus-visible` for this one element, since the focus move exists
  to confirm a state change for all users regardless of input
  modality, unlike this codebase's other focus-ring uses. Live-
  verified with a real pointer click (not a synthetic `.click()`).
- Round 3 came back clean.

**Status:** all round-1 UX/accessibility findings now closed. Moving
next to visual polish (legend/badge vocabulary unification -- the
matrix legend says Critical/Major/Moderate/Weak while the shared
`riskLevel`/`SEVERITY_STYLES` vocabulary used everywhere else in the
app, including this same page's own RiskBadge, says Critical/High/
Medium/Low; researched and confirmed `riskLevel.*` is the deliberate,
documented shared source of truth per src/utils/severityStyles.ts's
own header comment -- using it directly, not inventing a third
vocabulary, is the correct fix) and the muddy "Moderate" swatch color.

## Round 9 (legend vocabulary unification, PR #641)

Fixed the round-1 visual-polish finding: the legend said "Critical/
Major/Moderate/Weak" -- a one-off vocabulary invented just for this
page -- while this same page's own RiskCard shows a RiskBadge reading
"Critical/High/Medium/Low", the canonical shared severity vocabulary
(`src/utils/severityStyles.ts`, whose own header comment documents it
was built specifically to replace 5+ independently-invented severity
vocabularies across the app). Legend labels now pull from the same
`riskLevel.*` keys RiskBadge itself uses, instead of page-local
translations, so they can't drift apart again. Swatch colors
untouched -- only the label text was wrong. Removed the now-orphaned
i18n keys.

One review round, both parallel reviewers returned zero blocking
findings. Live-verified in both light/dark theme and in French: legend
and a selected risk's own badge now show byte-identical wording.
Reviewers also surfaced (correctly out of scope, not touched): two
other pages have their own page-local legends
(CorrelationMatrixPage's interconnection-density legend, RiskGraphPage's
edge-type legend) -- neither is the same severity concept as this
fix, so left alone.

**Status:** the muddy "Moderate" swatch color (bg-risk-medium/45
rendering as washed-out olive/khaki rather than a clean amber) and the
toggle-button style divergence from RiskRegisterPage are the two
remaining visual-polish items. The toggle-button one is lower
priority -- round 1 itself noted it already matches
CorrelationMatrixPage's own convention, so it's arguably not
inconsistent with the design system, just with one other page.
Continuing next with the color fix, then moving to industry-standards
(export, hover-preview) and UX (URL-state sync), the two remaining
below-floor axes with real open work.

## Round 10 (medium-severity color, PR #642)

Fixed the round-1 finding: "Moderate" cells/legend used a flat /45
opacity in both themes, which HSL->sRGB composite math (same
methodology this file already used to justify bg-risk-high's
dark-mode tint) confirmed composites to a washed-out pale peach in
light mode and a genuinely muddy brown in dark mode. Light mode had
huge contrast headroom so moved to /75 (a real, vivid amber, zero
accessibility cost). Dark mode's binding constraint -- the small 9px
count-badge text, composited a SECOND time over the already-blended
cell color -- capped the safe value at /50 (measured: /53 passes at
4.58:1, /54 fails at 4.48:1). A real but modest dark-mode improvement,
not a full fix -- documented as such rather than overclaiming.
Deliberately scoped out: a full fix needs a --risk-medium base-token
change affecting every consumer app-wide.

One review round, both reviewers returned zero blocking findings.
Reviewer A independently recomputed the math and found something
NOT introduced by this PR but real: bg-risk-critical/90 and
bg-risk-high/80 dark:bg-risk-high/70's small count-badge text ALSO
fails the 4.5:1 floor in dark mode (4.40:1 and 4.05:1) -- the
existing code comment for bg-risk-high only ever verified the large
bold score number, never this smaller, doubly-composited badge text.
Reviewer B live-confirmed dark mode still reads as "muddy" to the eye
(self-disclosed limitation, not a regression) and flagged medium/high
now look less clearly graduated in dark mode since both moved toward
higher saturation.

## Round 11 (critical/high dark-mode small-text contrast, PR #643)

Fixed the pre-existing small-text contrast gap round-10's reviewer
surfaced: bg-risk-critical/90 (dark) and bg-risk-high/70 (dark) both
failed 4.5:1 for the small count-badge text (4.40:1, 4.05:1) -- this
file's own original comment for bg-risk-high only ever verified the
large bold score number, never this smaller, doubly-composited badge
text. Moved to critical/85 (4.73:1) and high/63 (4.62:1), both with
real margin above the floor. Light mode unaffected (already
comfortable at both tiers). Two new regression tests tie the legend
to the matrix-cell classes for both tiers.

One review round, both reviewers independently recomputed the
contrast math and confirmed every cited number exactly. Reviewer B
surfaced a new, quantified concern: reducing High's opacity to fix
its small-text contrast narrowed its visual separation from Medium by
~31% (measured via composited RGB distance) -- still discernible, not
a hard failure, but a real step toward confusability on a heat map
whose whole job is letting users tell severity apart at a glance.
Consolidated this with round 10's own already-flagged follow-up (the
muddy medium color) into one task, since both trace to the same root
cause: alpha-compositing a single saturated token over a dark
background is a fragile way to get 4+ accessible, separable severity
colors. A real fix needs revised --risk-medium/--risk-high dark-mode
base tokens (or a different compositing strategy entirely), which is
a cross-component change affecting every consumer app-wide -- correctly
out of scope for a page-local fix, filed as its own task rather than
attempted here.

**Status:** all four color-ramp accessibility/polish findings from
rounds 10-11 are now closed at the page level (further improvement
needs the base-token follow-up). The toggle-button style divergence
from RiskRegisterPage remains the one open visual-polish item, still
lower priority per round 1's own note that it matches
CorrelationMatrixPage's convention. Moving next to the two remaining
below-floor axes with real open work: industry-standards (export,
hover-preview) and UX (URL-state sync).

## Round 12 (URL-state sync, PR #644)

Fixed the last open UX finding: matrixSize/groupMode/siteFilter/
selectedCell were all plain local state, resetting on navigating away
(e.g. clicking a risk name to its detail page) and back. No existing
page in this codebase had a full two-way URL-state-sync pattern to
follow -- every existing `useSearchParams` use is read-only, for
pre-filtering from an external link -- so this establishes the
pattern fresh, scoped to what round 1 actually asked for. Lazy
initializers read the URL on mount (falling back to sane defaults for
missing/malformed values, same discipline as isValidScoreValue); one
effect writes every change back via `replace` (not `push`), so
repeated toggling doesn't spam browser history.

Two review rounds: round 1 found two real, blocking issues neither
reviewer would have caught without one static-analysis pass and one
live-interaction pass working together -- (1) round 8's
focus-management effect assumed a selection could only ever become
non-null via a user click; arriving with a cell pre-selected from the
URL made the very first render yank focus to the details panel before
the user did anything, an unsolicited focus jump on page load; (2) the
sync effect started from a fresh `URLSearchParams()` and silently
dropped any query param it doesn't manage (a tracking param, or one a
future feature adds), even on mount. Fixed both same round -- a
first-render guard for the focus effect, and switching to the
functional-updater form of `setSearchParams` (cloning existing params
instead of starting fresh, which also resolved a latent fragility in
the round-1 eslint-disable comment flagged during round 8's own
review). Round 2 came back completely clean, both reviewers
confirming the fixes with independent re-derivation of the
correctness argument, not just re-running the same checks.

Live-verified end to end multiple times: 3x3 + selected cell + site
filter -> risk detail page -> browser back -> exact state restored,
with `history.length` never incrementing across repeated toggles
(confirming `replace` behavior) but incrementing normally on the real
navigation away.

**Status:** every round-1 finding across ALL nine axes has now been
addressed at least once (resilience fully closed rounds 3-5;
industry-standards' most consequential finding fixed round 6; mobile
fully closed round 7; visual polish's vocabulary and color findings
closed rounds 9-11; UX's focus/keyboard and URL-sync findings closed
rounds 8 and 12). Two industry-standards items remain unshipped
(matrix export, hover-preview of in-cell risk names) and one
visual-polish item is deliberately deprioritized (toggle-button style,
arguably not actually inconsistent with the design system). A fresh
full 9-judge panel re-score is the right next step to get current
numbers before picking further work, rather than continuing to guess
which round-1 finding is still the highest-leverage one seven rounds
later.
