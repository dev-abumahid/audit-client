# Quality Bar Loop — Landing Page (route "/")

Target: 8.5/10 average, 6.5 floor per axis. Judges: 8 core + Mobile/Responsive
(confirmed relevant), Security excluded (no auth/sensitive input on a public
marketing page). Standing merge authorization confirmed for aexa-frontend.

This log is distinct from `quality-bar-loop-log.md`, which tracks an
unrelated prior loop (Risk Register feature).

---

## Round 1 — 2026-08-22

| Axis | Score | Stuck streak |
|---|---|---|
| Industry-standards conformance | 8 | 0 |
| UX / interaction friction | 7 | 0 |
| Efficiency | 7 | 0 |
| Accessibility (a11y) | 7.5 | 0 |
| Visual/design polish | 7 | 0 |
| Resilience & edge cases | 9 | 0 |
| Code quality/maintainability | 7 | 0 |
| Cross-view integration | 9 | 0 |
| Mobile/responsive | 7 | 0 |
| **Average** | **7.61** | |

**Convergence check:** 7.61 < 8.5 target. Not converged. All axes ≥ 6.5 floor
(lowest is 7) — no guardrail trips.

### Judge findings (trimmed)

**Industry-standards (8/10):** Hero/CTA structure matches SaaS convention
well; interactive product-demo widgets go further than Vanta/Drata/LogicGate
(closer to Linear/Stripe playground-style demos); "illustrative data"
disclosure pattern is a genuine, unusual strength. Gaps: no compliance-
framework badges (SOC2/ISO27001) in hero/credibility band, testimonials lack
a logo wall — both reasonable given no real customers/certifications yet
(would require fabricating unverified claims to "fix"). **Scope: large-scope**
(can't be fixed without real assets).

**UX (7/10):** CDM connector diagram (the section's core "connected" visual
argument) is completely hidden below `sm:` breakpoint — mobile visitors see
4 stacked cards with no visual tie-back. Risk graph nodes ~19-22px on mobile,
well under 44px touch target. No visible link between graph and matrix when
scrolled apart (cross-highlight fires off-screen). KRI slider has no reset
control once dragged away from its intentional starting "ALERT" scenario.
RoleScopedRegisterWidget's Approve/Reject icon buttons ~22×22px, easy to
mis-tap. Keyboard nav, aria-live announcements, and threshold-crossing logic
all verified correct. **Scope: contained** (touch targets, reset button);
graph/matrix cross-scroll link is a design judgment call, deferred.

**Efficiency (7/10):** `ProductDemoSection`'s shared `selectedRiskRefs` state
causes unrelated widgets (e.g. `RoleScopedRegisterWidget`, which doesn't even
read it) to re-render on every selection click — none of the 4 widgets are
memoized. `LandingRiskMatrixWidget.buildGrid()` re-runs on every render
(not memoized) despite deterministic output. `RiskGraphWidget`'s
`ResizeObserver` has no debounce — a window drag-resize re-runs the full
multi-pass layout-settling loop many times per second. CDM sparkline
recomputes min/max redundantly inside its `.map()` (cosmetic at n=6).
Scroll-reveal (`useRevealOnScroll`) is implemented well (one IntersectionObserver
per section, disconnects after first intersection). **Scope: contained**
(React.memo, useMemo, debounce) — deferred to a dedicated round given the
structural nature of memoizing 4 sibling widgets correctly.

**Accessibility (7.5/10):** `LandingRiskMatrixWidget`'s 25-cell grid uses
default tabIndex on every cell (25 tab stops) instead of the roving-tabindex
+ arrow-key pattern used consistently everywhere else on this page (role
picker, CDM risk selector). `cellLabel` i18n key
(`"{{count}} risks in this cell"`) has no plural forms — every cell
announces grammatically broken text ("1 risks in this cell", "0 risks in
this cell" on 24/25 cells) to every screen reader user. Heading structure
gap: `LandingRiskMatrixWidget` uses `<p>` instead of `<h3>` based on a code
comment claiming a nonexistent parent `<h3>` covers it — screen-reader
heading navigation can reach `RiskGraphWidget` but not the matrix widget in
the same rail. KRI slider is a real native `<input type="range">`, so WCAG
2.5.7 (drag-only) doesn't apply — solid. Roving-tabindex radiogroups, SVG
node focus rings, live regions, and prior-round color-contrast fixes all
verified correct. **Scope: contained** (all 3 findings are cheap, isolated
fixes).

**Visual/design polish (7/10):** CDM panel border computes to very low
contrast against its own background (rgb(38,43,54) vs rgb(15,18,26)) —
undermines the stated goal of that redesign round. Connector/card accents
stay brand-teal regardless of the hub's severity color, an unharmonized
color hand-off. Record-card text (`text-[9px]`–`text-[11px]`) reads cramped
next to the more spacious widgets above it in the same rail. Typography/
color system elsewhere (Fraunces/Manrope pairing, severity badges, dark/light
theme parity) verified well-executed with no contrast failures. **Scope:
contained.**

**Resilience (9/10):** Empty-state code paths (KRI/finding/mitigation "not
linked yet") verified correct via a forced-null test, not just present as
dead code. Connector SVG only draws lines to genuinely-present slots.
20-click rapid-fire stress test on both the CDM selector and all 12 graph
nodes: zero errors. Keyboard nav after a mid-interaction mouse click works
correctly. Resize mid-interaction exercises `ResizeObserver`-driven re-layout
cleanly; divide-by-zero guards present and deliberate. All 43 relevant unit
tests pass. Minor gap: no automated test renders the null-JSX path directly
(only the data-layer null-check is tested). **Scope: contained** (cheap to
add) — low priority given the score.

**Code quality (7/10):** `RiskGraphWidget.tsx` (1090 lines, ~23% comments)
has 3 geometry constraint-solvers living inline in the widget file rather
than beside `resolveNodeOverlaps` in `@/utils/riskGraphNodeOverlap.ts` — no
principled reason 2 of 3 overlap-resolution passes live in the component and
1 doesn't. Many comments narrate chronological "CEO feedback"/"Review
finding" development history rather than stating durable invariants — real
content that belongs in commit/PR history, not source. `GraphNode` is a
local, unexported interface duplicated conceptually across 3 files instead
of one shared type. Geometry functions (`resolveEdgeCrossings`,
`segmentsCross`, etc.) aren't exported, so they can only be tested via full-
component rendering. Positive: shared business logic (severity styling, KRI
status, category labels) is genuinely reused everywhere, not reimplemented.
**Scope: contained** (comment trimming) to **large-scope** (extracting
geometry functions to utils + shared types is a real refactor) — mixed;
deferred to a dedicated round.

**Cross-view integration (9/10):** `ConnectedDataModelSection` imports and
calls the real `getRiskSeverityLevel`/`severityBadgeClasses`/
`computeKriStatus`/`kriStatusMeta` — same functions the real dashboard
(`RiskRegisterPage`, `RiskDetails`, `CorrelationMatrixPage`) uses, not a
re-derived lookalike. `RiskGraphWidget` uses the canonical `RISK_CATEGORIES`
table. `AuditFinding.severity`'s `hasOwnProperty`-based check (avoiding the
`in`-operator prototype-chain gap) shows real engineering care. Diffed PR
#1051 → PR #1052: zero regression in radiogroup/aria-live/roving-tabindex
markers — the visual redesign round didn't quietly break the interaction
round's a11y work. **No findings to fix.**

**Mobile/responsive (7/10):** `RoleScopedRegisterWidget`'s role-picker
buttons measure 28px tall (WCAG 2.5.5 needs 44px); pending-approval
Approve/Reject buttons ~22×22px on the widget that's the whole point of that
demo. `RiskGraphWidget` nodes ~37-38px diameter at 375px width, borderline
against 44px with 12 nodes packed close together. No horizontal overflow
anywhere (verified via `scrollWidth` at 375px/768px). The `hidden sm:block`
treatment on CDM's connector and ProductDemoSection's rail line is correctly
scoped to decorative-only elements — the actual data/cards stay interactive
on mobile, not a real content gap. CDM risk selector and hero CTAs are
mobile-solid. EN/FR toggle and theme-toggle buttons are undersized but
low-traffic/secondary. **Scope: contained** (padding/sizing changes only).

### Round 1 fix selection

No `data-correctness`/`security` findings this round. All axes tied at
`stuck_streak=0` (round 1, no prior round) — tie-break by lowest raw score,
then roster order. Lowest score (7) is shared by UX, Efficiency,
Visual-polish, Code-quality, Mobile; roster order picks **UX** first.

Selected a Tier-1/2 batch of cross-judge-confirmed, non-file-overlapping
findings (per the skill's batching guidance — 4 unrelated files, no two
edits collide):

1. **RoleScopedRegisterWidget.tsx** — bump role-picker buttons and
   Approve/Reject icon buttons to real 44×44px touch targets. Confirmed
   independently by both the UX judge and the Mobile judge — highest-
   confidence finding this round.
2. **RiskGraphWidget.tsx** — increase node hit-target size on small
   viewports (UX + Mobile judges, same underlying gap).
3. **en.json / fr.json** — fix `cellLabel` i18next pluralization
   (`cellLabel_one`/`cellLabel_other`) so it stops announcing "1 risks in
   this cell" to every screen-reader user on the risk-matrix widget
   (Accessibility judge — the single highest-value, cheapest fix found this
   round: a real, previously-unnoticed grammar bug hitting nearly every tab
   stop on the grid).
4. **LandingRiskMatrixWidget.tsx** — give the widget a real `<h3>` heading
   (matching `RiskGraphWidget`'s already-correct pattern) instead of a `<p>`
   whose own comment claims a nonexistent parent heading covers it
   (Accessibility judge).

Deferred to later rounds: CDM mobile connector redesign and KRI slider reset
control (UX, design judgment calls); efficiency memoization sweep across
`ProductDemoSection`'s 4 children (structural, deserves its own focused
round); code-quality comment trimming + geometry-function extraction
(large-scope refactor); CDM panel border/connector-color harmonization
(visual polish, save for a dedicated visual round); matrix roving-tabindex
pattern (accessibility, save for next round — didn't want to touch
`LandingRiskMatrixWidget.tsx` twice in one PR alongside the heading fix
without re-testing scope creep).
