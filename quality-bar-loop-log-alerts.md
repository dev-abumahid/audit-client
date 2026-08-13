# Quality Bar Loop — Alerts (`/organization/alerts`, AlertsPage.tsx)

Target: average >= 9/10, every axis >= 7/10 floor. Max rounds: 10 (default,
not a hard stop per standing user instruction carried over from earlier
loops in this same session).
Active judges: industry-standards, UX, efficiency, accessibility, visual
polish, resilience & edge cases, code quality, mobile/responsive, security
(both conditional judges activated -- mobile because every page looped
this session has needed it; security kept active per this session's
standing convention even though no role-gated mutation was found on a
first read, since the page still handles user/org data).

Standing merge authorization: yes (carried over from earlier loops in this
same session -- merge automatically once a fix passes review).

Started as the next item in the sidebar-navigation sweep, immediately
after the Threat Intelligence loop paused at (industry-standards and UX
both needing product/design-scoped work this loop shouldn't make
unilaterally). No prior quality-bar-loop history exists for this page.
User instruction: "keep going down the list of tabs."

## Round 1

| Axis | Score |
|---|---|
| Industry-standards | 4/10 |
| UX | 6/10 |
| Efficiency | 5/10 |
| Accessibility | 8/10 |
| Visual polish | 8/10 |
| Resilience & edge cases | 7/10 |
| Code quality | 6/10 |
| Mobile/responsive | 3/10 (lowest) |
| Security | 8/10 |

**Average: 6.11/10.** Below target (9); 5 axes below floor (7):
industry-standards, UX, efficiency, code quality, mobile.

Key findings by axis:

- **Industry-standards (4/10):** no bulk actions (mark-all-read); no
  snooze/dismiss/archive concept, just binary is_read; no sorting or
  read/unread filter (only severity quick-filter); deep-link to source
  only exists for KRI-triggered alerts, `alert.source` renders as plain
  text for everything else; no pagination UI despite the query fetching
  `limit=100` server-side -- an org with >100 alerts would silently lose
  older ones from view. Read/unread and severity ARE both clearly
  conveyed via shared style map -- a genuine strength.
- **UX (6/10):** severity filter chips work smoothly with immediate
  feedback; mark-as-read feels responsive (optimistic-feeling). Gaps:
  header "N active alerts" stat is confusing (org-wide total regardless
  of read state, not "unread" as the label implies, per the code's own
  comment); no visible "N unread" indicator anywhere on the page itself;
  a real reliability issue hit live -- a backend 429 rendered a hard
  error screen with no retry button and no backoff.
- **Efficiency (5/10):** the same unmemoized-derived-data bug class
  found on 2 sibling pages this session -- 5 separate `.filter()` passes
  over `allAlerts` on every render (the filtered list + 4 independent
  severity counts), no `useMemo`. No `React.memo` on the inline
  per-alert card JSX.
- **Accessibility (8/10):** heading hierarchy deliberately correct
  (h1 -> sr-only h2 -> per-card h3, cited to a real issue number).
  Interactive elements are real, keyboard-operable controls with
  visible focus rings. Unread state conveyed via an explicit "New" text
  badge, not just opacity. Minor gap: filter chips' accessible name is
  implicit (nested text content) rather than an explicit aria-label.
- **Visual polish (8/10):** correctly reuses the shared
  `severityStyles.ts` vocabulary, not hand-rolled colors. Severity quick-
  filter chips use each severity's own color when active -- a
  deliberate, nice touch. Minor: only `critical` severity gets a colored
  card border; a "High" alert looks border-wise identical to a routine
  one.
- **Resilience (7/10):** DOES check `isLoading`/`error` from its RTK
  Query hook -- does NOT have the isError-omission bug found on 4
  sibling pages this session (a genuine positive, confirmed live via a
  real backend 429). Malformed data handled defensively (severity
  fallback to neutral, sparse fields conditionally rendered). Gaps: the
  error state has no retry action; `isMarkingRead` is a single
  mutation-hook flag shared across every alert row, so clicking "Mark
  as read" on one alert disables every other unread alert's button with
  no per-row indication why.
- **Code quality (6/10):** the isMarkingRead sharing issue above is
  also flagged here. File-wide `any`-disable plus scattered `any` casts
  despite a real `Alert` type presumably existing. Well-documented
  decisions throughout (genuine positive). Minor duplication: the
  severity-count ternary chain duplicates logic already in the filter
  calls above it.
- **Mobile (3/10, lowest):** a genuinely severe, live-confirmed bug --
  the severity filter row has no wrap/scroll container, so the "Low"
  chip's right edge sits at x=439.6px in a 375px viewport with zero
  horizontal scroll available -- it is completely unreachable and
  untappable by any means on mobile, not just visually cramped. Touch
  targets are also all undersized: severity chips ~32px, "View
  KRI"/"Mark as read" links only 25px tall with just 8px gap between
  them (high mis-tap risk). Card body itself reflows fine.
- **Security (8/10):** mark-as-read has no client-side role gate, but
  this is confirmed intentional and safe -- server-side explicitly
  documents it as a "low-stakes per-viewer acknowledgement," still
  org-scoped. KRI deep-link properly encodes `kri_id`. No
  dangerouslySetInnerHTML. No sensitive logging.

**Next fix (Round 2):** mobile is the clear lowest score (3/10) with a
genuine functional bug, not just a polish issue -- the "Low" filter chip
is completely unreachable on mobile. Fixing the filter row's
wrap/scroll behavior plus the undersized touch targets (same proven
h-11 pattern shipped on 4 sibling pages this session) in one round,
since both are the same "mobile layout" finding.

## Round 2 (mobile -- unreachable filter chip + touch targets, PR #658)

Added `flex-wrap` to the severity filter row (previously `flex gap-2`
with no wrap, causing the "Low" chip to render entirely past the 375px
viewport with zero scroll access). Bumped the severity chips, "View
KRI" link, and "Mark as read" button to 44px (h-11).

Negative control confirmed the new test fails without the fix. One
review round, both reviewers returned zero blocking findings -- angle A
verified the flex-wrap/gap interaction and vertical-centering were
correct, and that the test's role-based query unambiguously targets
only the filter chip (RiskBadge itself renders a `&lt;span&gt;`, not a
button, so no collision with the in-card severity badge); angle B did a
genuine end-to-end live functional test -- not just visibility --
clicking the now-reachable "Low" chip and confirming the filter
actually applies (list narrows to the empty-filtered state, toggles
back correctly), plus confirmed flex-wrap only activates when needed
(single row at desktop width).

**Status:** mobile should clear the floor now, and this was a genuine
functional-bug fix (not just polish) confirmed working end-to-end live
-- likely the most impactful single fix of this pattern shipped this
session. Remaining below-floor axes: industry-standards (4/10, the
lowest), UX (6/10), efficiency (5/10), code quality (6/10). Efficiency
next: the same unmemoized-derived-data pattern already fixed on 2
sibling pages this session (5 separate `.filter()` passes over
`allAlerts` recomputing on every render).

## Round 3 (efficiency -- memoization, PR #659)

Memoized `allAlerts` (previously a fresh `?? []` array every render),
the severity-filtered `alerts` list, and combined the 4 separate
`.filter().length` passes into one `useMemo` loop -- same pattern
already fixed on 2 sibling pages this session.

Negative control confirmed the new test fails when the count memo's
deps are wrong (frozen at a stale value). One review round, both
reviewers returned zero blocking findings -- angle A verified all 3
dependency arrays are complete and correct, and that the combined count
loop is logically equivalent to the original 4 independent calls;
angle B traced the full dependency chain and confirmed `isMarkingRead`
(the mutation hook's own local state) isn't a transitive dependency of
any of the 3 memos, so a mark-read mutation resolving genuinely skips
recomputing everything -- the core efficiency claim holds. Live
verification confirmed the counts render correctly, though no unread
alert existed in the environment at review time to exercise the
click-through path live (covered by the unit test instead).

**Status:** efficiency should clear the floor now. Remaining
below-floor axes: industry-standards (4/10, still the lowest), UX
(6/10), code quality (6/10). All three need real design/refactor
scoping (bulk actions, snooze/archive, sorting/read-unread filtering,
retry-on-error, per-item mark-read loading state, proper `Alert` typing
instead of file-wide `any`) rather than mechanical fixes -- the same
wall CorrelationMatrixPage, KRI Dashboard, and Threat Intelligence all
hit on their own industry-standards/code-quality axes. This is a
natural pause point for the Alerts loop: 3 rounds shipped (a genuine
functional mobile bug fixed and confirmed live, plus memoization), the
three remaining gaps are feature-shaped work needing product input this
loop shouldn't make unilaterally. Per the standing "scope ambiguous
things, keep going down the list of tabs" instruction, moving to the
next sidebar tab: Regulatory Compliance.

## Round 4 (industry-standards, UX, code quality -- bulk mark-all-read, per-row loading, retry, unread indicator, PR TBD)

Resumed per the standing "resume the work on the floor gap ones"
instruction. Batched the highest-leverage, concretely-scoped findings
across all three below-floor axes into one round since they're all
Tier 2, same file, no overlap risk:

1. **Industry-standards -- bulk mark-all-read.** No bulk endpoint
   exists server-side (aexa-server's alert.route.ts only has a per-id
   PATCH /:id/read) -- fires the same per-id mutation in parallel
   across every currently-unread, currently-*filtered* alert via
   Promise.allSettled (one failure doesn't block the rest of the
   batch; a partial-failure toast reports how many failed).
2. **UX -- unread count + retry.** Header now shows "N unread"
   alongside the pre-existing org-wide "N active alerts" stat. The
   error state gets a Retry button wired to the query's own refetch.
3. **Code quality / resilience -- per-row loading state.** The
   `isMarkingRead` shared mutation-hook flag used to disable every
   unread alert's button the instant any ONE was clicked, with no
   indication why. Replaced with a `markingReadIds: Set<string>`
   tracking exactly which row(s) are in flight.

7 new regression tests, all with a genuine negative control (6/6
newly-added assertions confirmed to fail against the pre-fix source
when reverted).

**QA**: lint clean, typecheck clean repo-wide. Full suite:
1999/1999 passing.

**Live verification**: Retry confirmed fully end-to-end against the
real backend (stopped aexa-server, hit the error state, restarted,
clicked Retry, confirmed the real alert list reloaded). Mark-all-read
and the unread-count indicator could **not** be live-verified against
real data -- this preview org's only alert is already `is_read: true`
(confirmed via the actual network response), and there's no
mark-unread endpoint to manufacture an unread state. Relied on the
unit tests (with their own verified negative control) for these two
features instead, documented rather than silently skipped.

**Status:** the remaining industry-standards gaps (snooze/dismiss/
archive as a real lifecycle beyond binary is_read, sorting, deep-links
for non-KRI sources, pagination UI) and the file-wide `any`-disable
code-quality gap are still larger, product-scoped work -- this round
picked off the clearest, most concretely-actionable items from each
axis rather than the full remaining list.
