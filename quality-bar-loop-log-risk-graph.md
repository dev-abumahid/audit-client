# Quality Bar Loop — Risk Graph (`/organization/risk-graph`, RiskGraphPage.tsx)

Issue #577. This file starts at round 17 (re-running the judge panel) --
rounds 1-16 were tracked via TaskCreate/TaskUpdate and a plan file
(`~/.claude/plans/let-s-make-a-plan-swirling-shannon.md`) across this same
session, not a dedicated markdown log. Summary of that prior work, confirmed
via `git log`, before round 17 began:

- Round 13 (PR #590): topology-driven (d3-force) layout replacing pure
  category-ring clustering -- `src/utils/riskGraphLayout.ts` rewritten to run
  a synchronous d3-force simulation seeded from the old category-ring math,
  with link-kind-weighted forces (CAUSES closest/strongest, AMPLIFIES middle,
  CORRELATES loosest/weakest), a weak category-cluster force, and a hard
  overlap-resolution post-pass.
- Round 14 (PR #591): visible keyboard-shortcut hint near the zoom controls
  (a `Keyboard` icon + `Popover`), since the graph was already fully
  keyboard-operable but only announced via `aria-label` -- invisible to a
  mouse-first user.
- Round 15 (PR #592): extracted `MinimapDot` as its own `React.memo`'d
  component with all-primitive props, so panning/zooming no longer forces
  React to reconcile every minimap dot.
- Round 16 (PR #593): hover-to-highlight -- hovering a domino-chain ref or
  correlations-list row sets `hoveredRef` state, highlighting the matching
  graph node with a distinct ring, tying the side-panel lists back to the
  canvas.

Baseline (pre-round-13) 3-judge panel (industry-standards, UX, efficiency)
scored **7.3/10 average**: industry-standards 6/10 (pure category-clustering,
not topology-driven), UX 8/10 (invisible keyboard shortcuts, no tie-back from
lists to canvas), efficiency 8/10 (unmemoized minimap dots).

## Round 17 -- re-run the judge panel

Per the plan's own round-17 instructions: re-dispatched the same 3-judge
panel (industry-standards, UX, efficiency) now that rounds 13-16 are merged,
each judge given the original baseline complaint and instructed to verify it
against current code + a live re-test, not just take the fix on faith.

| Axis | Round baseline | Round 17 |
|---|---|---|
| Industry-standards | 6/10 | 9/10 |
| UX | 8/10 | 9/10 |
| Efficiency | 8/10 | 9/10 |

**Average: 9.0/10 -- target reached**, with the standing floor (7/10) cleared
by all three axes with real margin.

**Industry-standards (9/10):** live-verified the core complaint is reversed
-- screenshots show CYB-001/SEC-001/REP-001/CMP-001 (four different
categories, all CAUSES/AMPLIFIES-linked) sitting in one tight cluster, same
for FIR-001/MAC-001/ELE-001/ENV-001/ATE-001. A dedicated regression test in
`riskGraphLayout.test.ts` puts two different-category, CAUSES-linked risks
and asserts linked distance < half of unlinked distance (~99px vs ~358px).
Live re-layout on category-filter toggle confirmed working (`filteredLinks`
is a real `useMemo` dependency). Remaining minor gaps (no layout-algorithm
choice, no edge bundling for denser graphs) don't reproduce the original
defect -- polish beyond it, not open findings from this loop.

**UX (9/10):** keyboard hint confirmed live (Popover panel, dismissible,
also carries a native `title`). Hover-to-highlight confirmed live for both
domino-chain refs and correlations-list rows. One real, live-verified gap
found DURING this re-score (not a pre-existing baseline item): the hover
ring rendered inside the node's own `opacity={0.15}` dimmed group, nearly
invisible when hovering a correlations-list entry for a risk unrelated to
the current selection -- since the Correlations list shows every link in the
graph, not just ones touching the selected risk. Fixed same-round (see
below) rather than left open, per this session's fix-cheap-findings-in-round
convention.

**Efficiency (9/10):** `MinimapDot` confirmed to be a genuine
`React.memo`'d, all-primitive-props component with no view/pan/zoom
dependency -- live-tested panning with no jank or console warnings at ~27
risks. The round-13 d3-force layout adds real computational weight (multiple
force types + a 100-tick loop + overlap resolution) but stays fully
synchronous and gated behind the correct `useMemo` dependencies
(`[filteredRisks, filteredLinks]`, no view/pan/zoom state) -- a one-time cost
per filter change, not per frame, so no new efficiency regression.

## Round 17 fix -- hover ring dimming (PR #651)

Moved the hover-ring `<circle>` from a child of `RiskGraphNode`'s dimmed
`<g>` to a sibling (via a `Fragment`), so it renders at full opacity
regardless of the node's own dimmed state. Negative control confirmed the
new regression test fails without the fix (reintroduced
`opacity={isDimmed ? 0.15 : 1}` on the ring, confirmed the test catches it).
One review round, both reviewers returned zero blocking findings -- angle B
worked around an earlier live-verification coordinate-mismatch gap (scaled
`getBoundingClientRect()` by the screenshot/reported-viewport ratio) and
visually confirmed the fix: a dimmed node's body faded to near-invisible
while its hover ring rendered bright and fully opaque.

## Status

**Converged.** Average 9.0/10 reached on first re-score after rounds 13-16,
every axis at 9/10 with real margin above the 7/10 floor, plus one
newly-found regression fixed same-round rather than left open. This closes
the loop for RiskGraphPage per issue #577's original target. Per the
standing "keep going down the list of tabs" instruction, moving to the next
sidebar item.
