# Quality Bar Loop — KRI Dashboard (`/organization/kri`, KriDashboardPage.tsx)

Target: average >= 9/10, every axis >= 7/10 floor. Max rounds: 10 (default,
not a hard stop per standing user instruction carried over from earlier
loops in this same session).
Active judges: industry-standards, UX, efficiency, accessibility, visual
polish, resilience & edge cases, code quality, mobile/responsive, security
(both conditional judges activated -- the page has real create/edit forms
with numeric threshold inputs, same risk profile as the other org-risk
pages already looped in this session).

Standing merge authorization: yes (carried over from earlier loops in this
same session -- merge automatically once a fix passes review).

Started as the next item in the sidebar-navigation sweep, immediately after
the Risk Graph loop converged at avg 9.0/10 (issue #577). No prior
quality-bar-loop history exists for this page. User instruction: "keep
going down the list of tabs."

## Round 1

| Axis | Score |
|---|---|
| Industry-standards | 6/10 |
| UX | 7/10 |
| Efficiency | 5/10 |
| Accessibility | 7/10 |
| Visual polish | 8/10 |
| Resilience & edge cases | 7/10 |
| Code quality | 6/10 |
| Mobile/responsive | 5/10 |
| Security | 8/10 |

**Average: 6.56/10.** Below target (9); 4 axes below floor (7):
industry-standards, efficiency, code quality, mobile.

Key findings by axis:

- **Industry-standards (6/10):** three-band status (OK/WARNING/ALERT) and a
  real trend chart (Recharts, wired to actual historical readings via
  `useGetKriReadingsQuery`) both match real GRC convention. Breaching a
  threshold live-creates a linked Alert -- a legitimate
  threshold-triggered-notification pattern. Gaps: no threshold-direction
  configuration (ambiguous for "lower is worse" metrics); no export/
  reporting; `updateKri`/`deleteKri` mutations exist server-side but are
  never called from this page -- once created, a KRI's name/thresholds/
  linked risk/cadence are permanently fixed, and there's no delete UI.
- **UX (7/10):** creation flow is clear and well-validated (same-value
  threshold/target guard, live toast). Breach states are obvious at a
  glance (border + pill + summary chips, all color-consistent). Gaps: the
  "Update value" modal shows a bare unlabeled number input with no KRI
  name/unit/threshold context; the trend chart's line color never changes
  on breach (only the dashed reference line indicates threshold); empty
  state is minimal (no icon, no CTA despite a "New KRI" button existing).
- **Efficiency (5/10):** no `useMemo`/`useCallback` anywhere in the file --
  `unreadAlertsByKriId`, alert-count summaries, `trendChartData` all
  recompute every render including on every keystroke in the New KRI form.
  `risks.find(...)` inside the KRI `.map()` is an O(n*m) lookup instead of
  a pre-built Map. `SEVERITY_RANK`/`highestSeverity` are re-declared every
  render instead of hoisted. No `React.memo`-able card component exists.
- **Accessibility (7/10):** status is never color-only (icon + text on
  every badge). `useModalA11y` is a genuinely solid shared focus-trap/
  Escape/focus-restore implementation, tested across all three modals.
  Gaps: the trend chart has no accessible text alternative for
  screen-reader users; alert-severity badges convey severity via `title`
  + color only, not `aria-label`; KRI name truncates via CSS with no
  `title` fallback (unlike the form's own risk-name truncation, already
  fixed for this exact reason).
- **Visual polish (8/10):** correctly reuses the shared `severityStyles.ts`
  vocabulary (not a hand-rolled color map) -- consistent with
  RiskMatrixPage/CorrelationMatrixPage. Verified live in both themes: no
  contrast defects found. Recharts trend modal themes via `hsl(var(--...))`
  tokens, matching the established pattern.
- **Resilience (7/10):** the PRIMARY query (`useGetAllKriQuery`) DOES check
  `isError` and shows a real error banner -- this page does NOT have the
  isError-omission bug found on 3 sibling pages this session. Mutation
  failures are surfaced via toast, not swallowed. Gap: the SECONDARY
  queries (`useGetAllRisksQuery`, `useGetAllAlertsQuery`) have zero error
  handling -- a failure there silently shows "Unknown risk" / missing
  alert badges with no indication anything failed (the same bug class,
  just on the secondary hooks). Also: `Number(kri.current_value)` etc.
  render directly with no NaN/null guard, and threshold/target validation
  is shallow (only checks they're not equal, not direction-sanity).
- **Code quality (6/10):** file-level `eslint-disable no-explicit-any` plus
  `any` on nearly every callback -- type safety is effectively off. Only
  the primary query checks loading/error; the other three RTK Query hooks
  don't. Magic numbers (30-char truncation limit appears twice, 3000ms
  highlight-fade timeout has no named constant). The ALERT/WARNING/OK ->
  severity-key mapping is duplicated in two places. Otherwise genuinely
  strong: precise comments justifying non-obvious decisions, thorough test
  coverage. A single 892-line file inlining three full modals is a real
  maintainability cost -- extracting `KriCard`/`UpdateValueModal`/
  `NewKriModal`/`TrendModal` would also unlock the missing React.memo
  opportunity.
- **Mobile (5/10):** layout/overflow half passes cleanly (single-column
  grid at 375px, no sticky-column/legend-clipping bug this session found
  on 2 sibling pages). But touch targets are undersized: trend-view and
  update-value icon buttons measure 22x22px (half the 44px guideline) and
  are 2 of the 3 interactive controls on every card; the primary "New
  KRI" button measures 343x32px (full-width but only 32px tall); modal
  close buttons are ~28px.
- **Security (8/10):** client-side role gating (`canWriteOrgResource`,
  ADMIN/LEAD_AUDITOR only) matches server-side enforcement
  (`assertCanWriteOrgResource` in aexa-server, verified in that repo's own
  test file) -- genuine defense in depth, not just a UI-level gate. Zod
  validation server-side, mirrored client-side. No dangerouslySetInnerHTML,
  no sensitive logging, no unencoded URL risk. Minor gap: neither
  client nor server numeric validation calls `.finite()`, so a `NaN`
  (typeof "number") could technically pass Zod's `z.number()` check --
  low-risk, not an injection vector.

**Next fix (Round 2):** mobile is tied for the lowest score (5/10) and,
same as both sibling risk pages already looped this session, the
concrete fix is proven and low-risk -- bump the undersized icon buttons
(trend-view, update-value, modal close) and the "New KRI" button to a
44px touch target using the same `h-11` pattern already shipped twice
this session.

## Round 2 (mobile -- touch targets, PR #652)

Bumped the trend-view/update-value icon buttons, the "New KRI" button,
and all 3 modal close buttons to 44px, using the same `h-11`/
`h-11 w-11` pattern already shipped on RiskMatrixPage and
CorrelationMatrixPage.

Negative control confirmed both new tests fail without the fix. One
review round, both reviewers returned zero blocking findings -- angle A
raised one minor cosmetic note (the enlarged icon buttons sit in an
`items-baseline` row with the current-value text, which could look
slightly off-center) but confirmed no functional overlap/breakage;
angle B live-measured all four fixed targets at 44px (44x44 for the
icon buttons, 343x44 for New KRI) and confirmed the New KRI modal still
renders cleanly with no clipping at 375px.

**Status:** mobile should clear the floor now. Remaining below-floor
axes: industry-standards (6/10), efficiency (5/10), code quality (6/10).
Next: efficiency's missing memoization -- unmemoized derived data
(`unreadAlertsByKriId`, alert-count summaries, `trendChartData`)
recomputing on every render including every keystroke in the New KRI
form, plus an O(n*m) risk lookup inside the KRI `.map()`.

## Round 3 (efficiency -- memoization, PR #653)

Wrapped every unmemoized derived value (`unreadAlertsByKriId`, the
alert/warning/ok summary counts combined into one pass, `trendChartData`,
`statusFilteredKris`) in `useMemo`; replaced the O(n*m) `risks.find(...)`
inside the KRI `.map()` with a pre-built `risksById` Map; hoisted the
static `SEVERITY_RANK`/`highestSeverity` to module scope. Also had to
memoize `kris`/`risks`/`alerts` themselves -- their `?? []` fallback
created a fresh array reference every render, which would have defeated
every useMemo keyed on them (caught by `react-hooks/exhaustive-deps`
during implementation, not by a human).

Negative control confirmed the new test fails when a dependency array is
wrong (frozen/stale value) -- the harder-to-catch counterpart risk of a
memoization refactor, not just "does it still show correct data once."
One review round, both reviewers returned zero blocking findings --
angle A specifically verified the `highestSeverity` type-tightening
didn't change runtime behavior (every real call site still passes `any`,
so TypeScript's stricter signature is compile-time only) and that the
combined count loop is logically equivalent to the three original
`.filter().length` passes; angle B traced the full dependency chain and
confirmed React genuinely skips recomputing all five derived values on
an unrelated re-render (typing in the New KRI form), then live-verified
it with no flicker/wrong-numbers while typing.

**Status:** efficiency should clear the floor now. Remaining below-floor
axes: industry-standards (6/10), code quality (6/10). Both need
larger-than-mechanical work (industry-standards: threshold-direction
config, export, exposing the already-backend-supported edit/delete;
code quality: splitting the 892-line file into subcomponents, removing
the file-level `any`-disable). A fresh full-panel re-score is due next
to check overall convergence before picking between them.

## Fresh full-panel re-score (after round 3)

| Axis | Score | Change since round 1 |
|---|---|---|
| Industry-standards | 6/10 | unchanged -- rounds 2/3 didn't touch this axis, all 5 round-1 gaps confirmed still open |
| UX | 7/10 | unchanged |
| Efficiency | 9/10 | up from 5 -- round 3's memoization confirmed genuinely in place and durable, `useMemo` count matches expected scope, no correctness issues |
| Accessibility | 7/10 | unchanged |
| Visual polish | 8/10 | unchanged |
| Resilience | 7/10 | unchanged |
| Code quality | 6/10 | unchanged score, but a real (if minor) REGRESSION found: round 3's own additions (`risksById`, `unreadAlertsByKriId`, `statusFilteredKris`) added 3 new untyped `any` callbacks even though real KRI/Risk/Alert types already exist elsewhere in the codebase -- grew the `any` surface it should have been shrinking |
| Mobile | 9/10 | up from 5 -- round 2's fix confirmed genuinely in place and durable through round 3's edits to the same file, live re-measured at 44px |
| Security | 8/10 | unchanged |

**Average: 7.44/10.** Two axes below the 7 floor: industry-standards
(6/10) and code quality (6/10). Both need real design/refactor work to
move meaningfully (industry-standards: threshold-direction config,
export, exposing already-backend-supported edit/delete; code quality:
splitting the file, removing the `any`-disable). Picking the one
concrete, cheap item from this re-score rather than the larger
refactor: fixing the `any`-typing regression round 3 introduced.

## Round 4 (code quality -- remove any-typing regression, PR #654)

Replaced 3 `any`-typed callbacks round 3 introduced (`risksById`,
`unreadAlertsByKriId`, `statusFilteredKris`) with the real `KRI`/`Risk`/
`Alert` types, which already exist in `src/types/organization.d.ts` and
were already the correctly-inferred type of `kris`/`risks`/`alerts`
themselves -- the `any` annotations were redundant overrides, not
filling a real gap. Scoped narrowly to these 3 spots, not the file's
broader `eslint-disable no-explicit-any` (a separate, larger refactor).

Pure type-only change with no behavior difference, so no new test was
added -- the existing 49 tests plus a clean `tsc` prove no regression.
One review round (a single angle, proportionate to the small,
low-risk scope), zero blocking findings -- confirmed all 4 field
accesses are structurally valid against the real type definitions, and
that `kris`/`risks`/`alerts` were already correctly typed before this
fix (the redundancy claim holds).

**Status:** code quality's regression from round 3 is now reverted, but
the axis itself is unlikely to have moved much -- the larger findings
(892-line file inlining 3 modals, no React.memo-able card component,
duplicated severity-key mapping, magic numbers, secondary-query
loading/error not checked) are all still open and need real refactor
work, not a quick fix. Industry-standards (6/10) is in the same
position (threshold-direction config, export, exposing
already-backend-supported edit/delete). Both remaining below-floor
axes need product/design scoping decisions this loop shouldn't make
unilaterally (e.g. what should the edit-KRI UI actually look like, is
export in scope) -- similar to the wall the Risk Register loop hit at
its own round 8, and the wall CorrelationMatrixPage's industry-standards
axis hit. Treating this as a natural pause point for the KRI Dashboard
loop at avg ~7.44/10 (industry-standards fix would need a fresh
full-panel re-score to confirm the exact current average, not yet run
since round 4 was type-only). Per the standing "scope ambiguous things,
keep going down the list of tabs" instruction, moving to the next
sidebar tab: Threat Intelligence.

## Round 5 (industry-standards -- expose already-backend-supported edit/delete, PR TBD)

Resumed per the standing "resume the work on the floor gap ones"
instruction. Selected the most concrete item from industry-standards'
open findings: `updateKri`/`deleteKri` mutations already existed
server-side (`kri.api.ts` exported `useUpdateKriMutation`/
`useDeleteKriMutation`) with zero frontend consumer -- a KRI's own
fields (name/unit/thresholds/frequency) could never be corrected
after creation, and a mistakenly created KRI could never be removed,
without going around the UI entirely. Confirmed via a fresh read of
`kri.api.ts` and `KriDashboardPage.tsx` (no Edit/Delete UI existed at
all, only "update value" which submits a new *reading*, a different
concept).

Added an Edit button/modal (mirrors the New KRI modal's fields minus
`risk_id`/`current_value`, which `update_kri`'s own backend schema
doesn't accept) and a Delete button wired to the shared
`DeleteAlertModal` confirm component already used elsewhere in the
codebase. Both gated behind the existing `canWrite` check, same as
the other write actions on this page.

The larger remaining industry-standards items (threshold-direction
config, export) and the code-quality item (892-line file, no
React.memo-able card component) are unaddressed -- this round picked
the one item that was genuinely just "wire up an existing backend
capability," not new feature/design work.

7 new regression tests, verified against a negative control
(genuinely fail on the pre-fix source).

**QA**: lint clean, typecheck clean repo-wide. Full suite:
2011/2011 passing.

**Live verification**: could not be completed this round -- same
shared-backend rate-limit exhaustion documented in the Threat
Intelligence round above (aexa-server's Redis-backed `apiLimiter`,
300 req/15min, from this session's own heavy concurrent agent usage).
Relied on the unit tests (with a genuine negative control) instead.

## Fresh full panel re-score (this session, resumed after Intelligence converged)

| Axis | Round-3 panel | Fresh | Delta |
|---|---|---|---|
| Industry-standards | 6 | **7** | +1, clears floor -- round 5's edit/delete gap confirmed closed |
| UX | 7 | 7 | -- |
| Efficiency | 9 | 9 | -- |
| Accessibility | 7 | 7 | -- |
| Visual polish | 8 | 8 | -- |
| Resilience | 7 | 7 | -- |
| Code quality | 6 | 6 | unchanged -- round 5 added a 4th near-duplicate modal (Edit KRI, nearly identical field JSX to New KRI), offsetting its clean typing |
| Mobile | 9 | 9 | -- |
| Security | 8 | 8 | -- |

**Average: 7.56/10.** Up from 7.44. **Code quality (6) is now the
sole below-floor axis.** File grew 892->1297 lines by inlining a 4th
full modal instead of sharing a component; file-level any-disable
still present; ALERT/WARNING/OK severity-key mapping still duplicated
in two places; magic numbers (3000, 30) still unnamed.

**Next fix:** code quality is the only below-floor axis, wins
automatically. Its cheapest concrete item per this re-score: extract
the New-KRI/Edit-KRI shared field JSX (name/unit/threshold/target/
frequency) into one reusable form component -- a mechanical refactor
collapsing both the duplication and file-size findings together, not
a product/design decision like threshold-direction config or export
would be.

## Round 6 fix (code quality -- consolidate status mapping, name magic numbers)

Considered extracting the New/Edit KRI modals' shared field JSX first
(the judge's own suggestion), but the two modals' actual layouts
diverge enough (New KRI has an extra risk-select + current_value field
inline in different grid groupings) that a clean shared component
would need conditional layout logic nearly as complex as the
duplication it would remove -- higher risk than benefit given 15+
existing tests with positional/specific selectors on this exact
surface. Picked a smaller, unambiguous win instead.

Shipped: a single `KRI_STATUS_META` lookup (+ `kriStatusMeta()`
helper) replacing FOUR independent re-derivations of the same
ALERT/WARNING/OK -> {severity level, border color, label} mapping
(the card border, the alert-count badge's severity color, the status
badge's color, the status badge's text, and the URL-filter notice's
text). Also named 2 previously-magic numbers: the highlight-fade
timeout (3000ms) and the risk-name truncation length (30 chars).

Pure refactor, zero behavior change -- preserved the original
statusParam fallback (an unrecognized value renders as-is, not
silently relabeled "OK") via an explicit `in KRI_STATUS_META` check
rather than relying on kriStatusMeta's own OK-default fallback, which
is correct for a real KRI row's status but would have been wrong for
an arbitrary/malformed URL param.

No new tests added (pure refactor with no new behavior) -- all 58
pre-existing tests pass completely unchanged, which is the actual
proof of no regression for this kind of change; a fresh `tsc -b` also
confirms no type drift.

**QA**: lint clean (0 errors), typecheck clean. Full suite: 2127/2127
passing.

**Live verification**: could not be completed this round -- the
shared dev backend is currently rate-limited (429 on every request),
the same `apiLimiter` exhaustion documented repeatedly across this
session's other pages' logs, from this session's own heavy concurrent
agent usage. Relied on the unchanged 58-test suite (a stronger proof
for a pure refactor than a single live click-through would be) plus a
clean typecheck instead.
