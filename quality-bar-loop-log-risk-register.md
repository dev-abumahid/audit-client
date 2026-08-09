# Quality Bar Loop — Risk Register (`/organization/risks`, RiskRegisterPage.tsx)

Target: average >= 9/10, every axis >= 7/10 floor. Max rounds: 10.
Active judges: industry-standards, UX, efficiency, accessibility, visual polish,
resilience & edge cases, code quality, mobile/responsive, security (both
conditional judges activated by the user at Setup).

Standing merge authorization: yes, merge automatically once a fix passes review.

Note: this page already received one prior fix from the Dashboard loop
(PR #607/#606-era work added a client-side `?status=` filter with a
`FilteredByNotice` component, `isError` handling, and an empty-state row —
see quality-bar-loop-log.md's Dashboard entries for that history). This
loop judges the page's current state fresh, not from a zero baseline.

## Round 1

| Axis | Score |
|---|---|
| Industry-standards | 5/10 |
| UX | 5/10 |
| Efficiency | 5/10 |
| Accessibility | 7/10 |
| Visual polish | 6/10 |
| Resilience & edge cases | 8/10 |
| Code quality | 7/10 |
| Mobile/responsive | 4/10 |
| Security | 10/10 |

**Average: 6.33/10.** Below target (9) and 4 axes below floor (7): industry-standards, UX, efficiency, mobile/responsive.

Key findings by axis:

- **Industry-standards (5/10):** no sorting anywhere on the table; no real pagination — `useGetAllRisksQuery({ page: 1, limit: 100, ... })` hardcodes a silent 100-row cap with zero page UI, so an org with >100 risks loses rows with no indication; no bulk operations; no column customization/export. Filtering, approval workflow, and error/empty-state handling are genuinely above-bar.
- **UX (5/10):** subtitle still says "0 risks found" during a fetch error (contradicts the correctly-shown error row — a live-reproduced instance of the same "false all-clear" class already fixed once for the table itself); no retry affordance in the error state; the Add/Edit modal is one long undifferentiated ~15-field form; approval controls are cramped/low-discoverability; no bulk actions or sortable columns.
- **Efficiency (5/10):** search has no debounce — every keystroke fires a full new 100-row network request; hardcoded `page:1, limit:100` is a silent scale/correctness bug, not just inefficiency; `RiskApprovalControls` re-derives `useMyOrgRole()` per row instead of using the value the parent already computed; no `useMemo` on the two chained `.filter()` passes, so unrelated modal-field keystrokes re-trigger table filtering.
- **Accessibility (7/10):** table `<th>` elements lack `scope="col"`; empty actions-column header has no visually-hidden label; search input has no `aria-label`/associated `<label>` (placeholder-as-name anti-pattern). Modal focus management, `role="alert"` on the error state, accessible names on icon buttons, and color-not-alone severity signaling are all solid and live-verified.
- **Visual polish (6/10):** doesn't reuse the shared `RiskBadge` (hand-rolls severity pill inline) or `SourceBadge` (bare icon+text for AI/manual instead of the shared pill); inconsistent with sibling `RiskDetails.tsx`/`RiskGraphPage.tsx`'s `font-mono-data` convention for score/financial figures; no KPI/summary strip unlike `Overview.tsx`/`SitesEntities.tsx`.
- **Resilience (8/10):** the known-good `isError` fix on `useGetAllRisksQuery` is intact and live-verified (distinct error row with `role="alert"`, real outage reproduced). Gap found: `useGetAllSitesQuery` (feeds the site filter dropdown) has no `isError` handling at all — same real outage silently rendered "All Sites" with no options and no error indicator. Also: `(risk.financial_impact_max / 1000).toFixed(1)` has no null guard (renders literal "NaNM"); no loading skeleton for initial fetch.
- **Code quality (7/10):** doesn't reuse `RiskBadge` or the shared `Pagination` component (unlike sibling list pages `AllFindingsPage.tsx`, `AuditPage.tsx`, `CompliancePage.tsx`, `TemplatesPage.tsx`); file-wide `eslint-disable @typescript-eslint/no-explicit-any` at line 1 is broader than the two lines that actually need it; category badge computed via an inline IIFE in JSX; 1124-line monolith mixing list + 20+ field CRUD modal with no sub-component extraction. Test coverage is substantive and genuinely good (real business-logic regression tests, not superficial).
- **Mobile/responsive (4/10):** Edit/Delete row-action buttons measure 20×20px live (well under the 44×44 touch-target minimum), sitting ~4px apart with one being destructive; Name column stays hard-truncated (`max-w-32`) even at 768px tablet width where there's spare room; Add/Edit modal's internal grids are fixed `grid-cols-2`/`grid-cols-3` with no mobile stacking fallback, causing visible label-wrap and truncated `<select>` text at 375px. Table itself doesn't overflow the viewport (real breakpoints do hide columns), but no card-based mobile layout exists.
- **Security (10/10):** no `dangerouslySetInnerHTML`; role gating via the established `useMyOrgRole`/`canWriteOrgResource` pattern is used consistently; `?status=` URL param only feeds a strict string-equality filter, no injection surface; no sensitive console logging. Clean.

**Next fix (Round 2):** the missing-pagination gap is flagged independently by 3 axes (industry-standards: no page UI/silent data loss; efficiency: full-payload re-fetch with no debounce; code quality: sibling pages already reuse a shared `Pagination` component this page skips) — the single highest-leverage fix is wiring real pagination via the existing shared `Pagination` component, replacing the hardcoded `page:1, limit:100` fetch. This directly targets the worst structural gap in industry-standards and closes a real silent-data-loss bug at the same time.

## Round 2 — fix shipped (PR #615)

Wired real pagination: `page` state + shared `Pagination` component (`PAGE_SIZE=20`,
matching `AuditPage`/`AllFindingsPage`'s convention), `totalPages` derived from
the API's existing `meta.totalPage`, page resets to 1 on search/site/category
filter changes, `useClampPageToTotal` added for the delete-last-row-on-last-page
edge case.

Adversarial review (`ship-with-review-loop`) found 2 real regressions in round 1
of review, both fixed same round:
- Header subtitle used the current page's row count (`visibleRisks.length`),
  which with `PAGE_SIZE=20` always read "≤20 risks found" regardless of the
  real match count — switched to the server's `meta.total` for the normal
  browsing case.
- `statusParam`/`pendingApprovalOnly` are client-side-only filters layered on
  top of the paginated fetch. Dropping page size from 100→20 made this
  interaction actively broken (a raw page could show zero filtered matches
  while a live pager displayed an unrelated "page N of M"). Fixed by falling
  back to the pre-pagination `limit:100`/no-pager behavior whenever either
  filter is active — bounded scope, not full server-side filtering, but no
  worse than the page's behavior before this round.

Round 2 of review came back clean (no findings) — merged via
`gh pr merge 615 --squash --admin` under the standing merge authorization.

**Next: re-run the round-1 judge panel** to score the page's post-fix state
before picking round 3's fix.

## Round 2 (post-fix judge panel)

| Axis | Score | vs. Round 1 |
|---|---|---|
| Industry-standards | 6/10 | +1 |
| UX | 5/10 | same |
| Efficiency | 6/10 | +1 |
| Accessibility | 7/10 | same |
| Visual polish | 6/10 | same |
| Resilience & edge cases | 7/10 | -1 |
| Code quality | 8/10 | +1 |
| Mobile/responsive | 4/10 | same |
| Security | 10/10 | same |

**Average: 6.56/10** (up from 6.33). Still below target (9); 4 axes below floor (7): industry-standards, UX, efficiency, mobile/responsive.

**Regression check:** resilience dropped 8→7. Diagnosed as judge-scoring calibration, not a real regression — the round-2 judge re-confirmed the exact same 3 pre-existing findings from round 1 (sites-query missing `isError`, `NaN` guard on financial impact, no loading skeleton), found the new pagination logic itself to be defensively coded with no new fragility, and explicitly called out that the drag is those 3 findings "sitting open two rounds later despite being flagged" — i.e. a stricter read of unaddressed known issues, not a new break introduced by round 2's diff. No new bug was found. Continuing the loop rather than escalating, consistent with this session's established practice for judge-noise vs. real regressions.

Key findings by axis:

- **Industry-standards (6/10):** pagination fix confirmed live and well-engineered (real `limit=20` request, server-derived `totalPages`, honest bounded fallback for the two client-only filters). Sorting, bulk operations, and column customization/export remain fully unaddressed (not this round's scope).
- **UX (5/10):** the specific round-1 finding (subtitle contradicts the error state) is still live via a different path — `subtitleCount` falls back to `visibleRisks.length` (which is 0) when `riskData` is `undefined` during an error, so "0 risks found" still renders next to the error row. No retry affordance, cramped approval controls, undifferentiated modal, and no bulk/sort remain open.
- **Efficiency (6/10):** real payload reduction confirmed in the normal case (20 vs 100 rows/fetch) with an honest, narrow fallback for the filtered case. Search debounce, per-row `useMyOrgRole()` re-derivation in `RiskApprovalControls`, and the unmemoized filter chain remain open (not this round's scope).
- **Accessibility (7/10):** the new `Pagination` component is well-built (real `<button>`s, `aria-label`s, `aria-current="page"`, correct `disabled` at bounds) but round 1's 3 findings (`<th>` missing `scope`, empty actions-column header label, search input placeholder-as-name) are all still open.
- **Visual polish (6/10):** `Pagination` integrates cleanly with no bolted-on look; all 4 round-1 findings (RiskBadge/SourceBadge non-reuse, font-mono-data inconsistency, no KPI strip) remain untouched.
- **Resilience (7/10):** new pagination/client-filter logic is defensively coded (graceful `meta` degradation, correct `useClampPageToTotal` guarding); the 3 round-1 findings remain open across 2 rounds now.
- **Code quality (8/10):** `Pagination` reuse confirmed idiomatic; `isClientFiltered` logic is well-commented and honestly scoped; 8 new pagination tests are substantive. Remaining open: file-wide `eslint-disable`, IIFE category badge, `RiskBadge` non-reuse, growing monolith size (now 1183 lines).
- **Mobile/responsive (4/10, unchanged):** the new `Pagination` buttons (`icon-sm`, 24×24px) are bigger than the existing 20×20px row-action buttons but still under the 44×44 minimum — same category of miss, less severe, and moot with only 2 seeded risks (pager doesn't render). None of round 1's 4 substantive findings (Edit/Delete touch targets, name-column truncation, modal grid stacking, no card layout) were touched.
- **Security (10/10, unchanged):** confirmed no new surface from `page` state (pure numeric, never URL-derived) or `isClientFiltered` (a derived boolean, no new sink).

**Next fix (Round 3):** mobile/responsive is now the single lowest-scoring axis (4/10, unchanged across 2 rounds) with a concrete, well-precedented fix already used repeatedly elsewhere in this session (the Sites & Entities loop's hit-slop technique) — the Edit/Delete row-action buttons measure 20×20px live, well under the 44×44 touch-target minimum, sitting only ~4px apart with one being a destructive delete. This is the highest-leverage next fix: concrete, cheap, and directly targets the worst-scoring, longest-unaddressed axis.

## Round 3 — fix shipped (PR #616)

Extended the Edit/Delete row-action buttons' touch targets via hit-slop (a
`before:` pseudo-element extending the real clickable area without growing
the visible button): widened the actions column (`w-20`→`w-28`) and the
button gap (`gap-1`→`gap-4`) to fit a full 44px-tall, ~36px-wide hit zone on
each button with zero overlap between them — an honest, bounded improvement
given the column's limited content width, not a false claim of full 44x44
on both axes. Live-verified via `elementFromPoint` edge-sampling.

Adversarial review ran 3 rounds before coming back clean:
- Round 1 review: no real functional bugs found (live-verified independently
  — no page-level horizontal-scroll regression at desktop/tablet, no overlap
  into the neighboring Approval column), but found the new test only
  asserted button-level classes, missing coverage for the wrapping `gap-4`
  and the column's `w-28` — either could regress independently and pass
  unnoticed. Fixed with negative-controlled assertions for both.
- Round 2 review: the new `w-28` assertion used a hardcoded `th` index
  (`[8]`), fragile to future column reordering. Fixed by switching to
  `thead th:last-child`.
- Round 3 review: clean, no findings — merged via
  `gh pr merge 616 --squash --admin` under the standing merge authorization.

**Next: re-run the judge panel** to score the page's post-fix state before
picking round 4's fix.

## Round 3 (post-fix judge panel)

| Axis | Score | vs. Round 2 |
|---|---|---|
| Industry-standards | 6/10 | same |
| UX | 5/10 | same |
| Efficiency | 6/10 | same |
| Accessibility | 7/10 | same |
| Visual polish | 6/10 | same |
| Resilience & edge cases | 4/10 | -3 |
| Code quality | 8/10 | same |
| Mobile/responsive | 5/10 | +1 |
| Security | 10/10 | same |

**Average: 6.33/10** (down slightly from 6.56, driven entirely by resilience).
Still below target (9); 5 axes now below floor (7): industry-standards, UX,
efficiency, resilience, mobile/responsive.

**Regression check:** resilience dropped 7→4, the sharpest single-round move
in this loop. Diagnosed as NOT a new bug: the round-3 diff was confirmed by
the same judge to be isolated to CSS/markup (hit-slop only) with "no new
fragility." The judge's own reasoning for the drop is explicit — the same 3
findings from round 1 (sites-query missing `isError`, `NaN` guard on
financial impact, no loading skeleton) are "now unaddressed across 3 rounds"
and "no forward progress... is the dominant factor in scoring," plus a
newly-articulated (but not newly-introduced) aggravating detail: the missing
loading state means every page load flashes a false "no risks match" empty
state before data arrives, since `riskData` is `undefined` on first render
and nothing distinguishes "still loading" from "genuinely empty." That
interaction has existed since round 16 predates this entire loop — it's a
sharper articulation of a known gap, not a regression this round caused.
Treating this as a genuine, if overdue, signal rather than noise: 3 rounds
of picking other axes' fixes while resilience sat untouched is a real
prioritization miss, not just judge variance.

**Next fix (Round 4):** resilience is now the single lowest-scoring axis and
has been flagged unaddressed for 3 consecutive rounds. Fixing all 3 items
together in one round: (1) add `isError` handling to `useGetAllSitesQuery`
(currently silently renders an empty site dropdown on a real outage), (2)
guard `(risk.financial_impact_max / 1000).toFixed(1)` against
null/undefined (currently renders literal "NaNM"), (3) add a loading state
for the initial risk fetch so it's visually distinct from a genuine
zero-result empty state.

## Round 4 — fix shipped (PR #617)

Fixed all 3 resilience items together: an `isError` check + visible error
indicator for `useGetAllSitesQuery`, a `== null` guard on
`financial_impact_max` falling back to an em dash, and an `isLoading` check
on `useGetAllRisksQuery` gating a distinct loading row ahead of the
error/empty-state rows. All three negative-controlled (reverted each
independently, confirmed its new test fails, restored).

Adversarial review came back clean on round 1 — no real findings. The
reviewer explicitly checked and ruled out the two most likely failure
modes: (a) a stale "no risks match" flash on mutation-triggered refetches
(ruled out: RTK Query retains previous cached data during a refetch of the
same key, so `isLoading` staying `false` doesn't cause a false-empty flash),
and (b) the `== null` guard swallowing a legitimate `financial_impact_max:
0` (ruled out: loose equality `0 == null` is `false`, so `0` still renders
`"0.0M"` correctly). Merged via `gh pr merge 617 --squash --admin` under
the standing merge authorization.

**Next: re-run the judge panel** to score the page's post-fix state before
picking round 5's fix.

## Round 4 (post-fix judge panel)

| Axis | Score | vs. Round 3 |
|---|---|---|
| Industry-standards | 4/10 | -2 |
| UX | 5/10 | same |
| Efficiency | 6/10 | same |
| Accessibility | 6/10 | -1 |
| Visual polish | 6/10 | same |
| Resilience & edge cases | 6/10 | +2 |
| Code quality | 6/10 | -2 |
| Mobile/responsive | 4/10 | -1 |
| Security | 10/10 | same |

**Average: 5.89/10** (down from 6.33). 6 axes below floor (7): industry-standards,
UX, efficiency, accessibility, mobile/responsive, code quality.

**Regression check — two categories this round:**
- **Judge-severity drift (not real regressions):** industry-standards and code
  quality both dropped on findings that are byte-for-byte unchanged from
  round 3 (no sorting/bulk/export; eslint-disable scope, IIFE, RiskBadge
  non-reuse, growing file size) — judges scored the *persistence* of
  unaddressed debt more harshly, not a new bug. Consistent with this loop's
  established pattern for stale-finding severity escalation.
- **Real, live-verified regressions this round's own diff caused:**
  - Accessibility: the new loading row has no `aria-live`/`role="status"`,
    unlike its sibling error row (`role="alert"`) — silent to screen readers.
  - Mobile: the new sites-error indicator wraps onto its own line paired
    with the *next* filter control at 375px, visually misattributing the
    error to the wrong dropdown.
- **Resilience genuinely improved** (4→6, live-verified all 3 round-4 fixes
  work correctly under a real forced failure), but surfaced 2 remaining
  gaps: the header subtitle still shows "0 risks found" during a fetch
  error/loading (the exact false-all-clear pattern already fixed once for
  the table body, not yet fixed for the subtitle line beside it), and the
  Add/Edit modal's own site dropdown has no error indicator of its own
  (the one `sitesError` message lives on the list page, hidden behind the
  modal overlay).

**Next fix (Round 5):** three concrete, live-verified, cheap fixes — (1) add
`role="status"`/`aria-live` to the loading row, (2) fix the sites-error
indicator's mobile wrapping (force it onto its own line rather than pairing
with the next filter), (3) fix the subtitle to not claim "0 risks found"
during an error or loading state.

## Round 5 — fix shipped (PR #618)

Shipped all three round-4 findings in one PR (all touch the same header/
top-of-page region, cheap and independent, no reason to split):

1. Header subtitle now branches `risksLoading ? loading-text : risksError ?
   error-text : normal-count-text`, mirroring the table body's own
   loading/error/normal precedence instead of falling back to a false
   "0 risks found".
2. Loading row's `<span>` gained `role="status" aria-live="polite"`,
   matching the sibling error row's `role="alert"`.
3. Sites-error indicator gained `w-full basis-full ... sm:w-auto
   sm:basis-auto` so it lands on its own line at mobile widths instead of
   pairing with the next filter control.

6 new/updated tests, all negative-control verified (reverted the fix,
confirmed 6 failures, restored, confirmed pass). `npm run typecheck`,
`npm run lint`, full `npx vitest run` (1598 tests) all clean. Live-verified
in browser: forced a `/risk` 500 via a `window.fetch` monkey-patch, confirmed
the header subtitle switched from "0 risks found" to "Failed to load risks.
Please try again later." — matching the table's own error row. State fully
restored afterward.

Adversarial review (2 parallel angles: line-by-line/cross-file, and
removed-behavior/altitude) came back clean on round 1 — no real bugs. One
style nit surfaced (inline ternary vs. a named `subtitleText` variable,
matching this file's existing `isClientFiltered`/`subtitleCount` convention)
but judged too minor to justify its own fix round. One out-of-scope finding
also surfaced: `CompliancePage.tsx` has the identical false-zero-count
pattern on its own header subtitle (`totalCount` shown unconditionally, no
`isError` even destructured from its query) — flagged as a separate
follow-up task, not fixed here since it's a different page/file outside
this loop's scope.

Merged directly under standing authorization (one clean review round).

**Next: re-run the judge panel** to score the page's post-fix state before
picking round 6's fix (or checking convergence).

## Round 5 (post-fix judge panel)

| Axis | Score | vs. Round 4 |
|---|---|---|
| Industry-standards | 4/10 | same |
| UX | 6/10 | +1 |
| Efficiency | 6/10 | same |
| Accessibility | 8/10 | +2 |
| Visual polish | 5/10 | **-1** |
| Resilience & edge cases | 7/10 | +1 |
| Code quality | 6/10 | same |
| Mobile/responsive | 6/10 | +2 |
| Security | 10/10 | same |

**Average: 6.44/10** (up from 5.89). 6 axes still below floor (7):
industry-standards, UX, efficiency, visual polish, code quality,
mobile/responsive. Accessibility, resilience, and security now clear the
floor.

**Regression check:** all three round-5 fixes were confirmed live-working
(header subtitle no longer shows "0 risks found" during loading/error --
confirmed via both a deliberate monkey-patch AND, independently, a real
429 the dev API hit mid-review; loading row's `role="status"` confirmed;
sites-error mobile line-wrap confirmed via live DOM injection of the
shipped classes). No axis's *fix* backfired -- but the mobile fix's own
CSS introduced a genuine, live-verified visual-polish regression: the
sites-error span's `text-[10px]` is a one-off type-scale value (every
other control on the page uses `text-xs`/12px), and its `text-destructive`
red now visually disagrees with the header subtitle's `text-muted-foreground`
gray for the *same class of failure* (a fetch error) sitting inches apart
on screen. Per this loop's established discipline (real, concrete, cheap
regressions get fixed directly rather than escalated), this is Round 6's
fix rather than a stop-and-ask moment -- unlike a genuine ambiguous
design tradeoff, this one has an unambiguous correct answer (match the
existing `text-xs` scale, and pick one consistent color treatment for
"a fetch failed" messaging).

New findings surfaced this round, all independent of the regression above:
- Accessibility: the header subtitle's loading/error text change has no
  `aria-live` of its own (a smaller, adjacent gap to the one just fixed --
  the table's own live regions duplicate the same info, so this is lower
  severity, not blocking).
- Resilience: the Add/Edit modal's own Site dropdown still has no
  sites-failure awareness (same finding as round 4, confirmed still open,
  not yet fixed -- flagged again as a candidate).
- UX: no retry affordance on any error state (page reload is the only
  recovery path); search has no debounce (fires a request per keystroke,
  confirmed as the likely cause of a rate-limit the UX judge hit live
  during testing); no unified "clear all filters" action.
- Industry-standards/code-quality/efficiency: all confirmed unchanged from
  round 4 (no sorting/bulk/export; inline ternary vs. named-const style
  nit; unmemoized per-row closures/derived filters; eslint-disable scope;
  IIFE; RiskBadge non-reuse) -- round 5's diff didn't touch any of these,
  as expected.

**Next fix (Round 6):** fix the visual-polish regression from round 5's own
diff -- replace the sites-error span's `text-[10px]` with the page's
existing `text-xs` scale, and make its color treatment consistent with the
header subtitle's error state (both should signal "this failed" the same
way). Strong secondary candidate for a follow-up round: the search input's
missing debounce, since it's both a UX and (per the UX judge's live
incident) a real resilience/reliability risk (self-inflicted rate-limiting).

## Round 6 — fix shipped (PR #619)

Shipped both round-5 visual-polish regression fixes:

1. Sites-error indicator: `text-[10px]` -> `text-xs`, matching the rest of
   the filter row's scale.
2. Header subtitle: now conditionally `text-destructive` (was always
   `text-muted-foreground`) when `risksError` is true, matching the
   sites-error indicator's color language.

2 new tests, negative-control verified (reverted, confirmed 2 failures,
restored, confirmed pass). QA gate clean (typecheck/lint/1600 tests). Live-
verified: forced a `/risk` fetch failure, confirmed the header subtitle now
renders in red instead of muted gray.

Adversarial review round 1 (2 parallel angles) found one real, in-scope gap
this PR's own stated goal should have caught: the risks table's own error
row (`role="alert"`) was still `text-muted-foreground` -- a *third*
inconsistent color for the same "fetch failed" signal, missed by the
original diff. Fixed in a follow-up commit (table row now also
`text-destructive`), with 1 more negative-controlled test. One review
agent also surfaced a security-policy note (attempted a broad
`git checkout <ref> -- .` in an isolated review context) -- verified via
`git status`/`git log` that the local working tree and branch were
completely unaffected, no action needed. One out-of-scope finding flagged
as a follow-up task: the `--destructive` CSS token itself fails WCAG AA
contrast in dark mode (~3.9:1) and is borderline in light mode (~4.48:1),
unlike `--muted-foreground` which was deliberately tuned to clear 4.5:1 --
a pre-existing design-token gap this PR made more visible by using
`text-destructive` as body text in more places, not something this PR
introduced.

Round 2 of review came back clean (zero findings). Merged under standing
authorization.

**Next: re-run the judge panel** to score the page's post-fix state before
picking round 7's fix (or checking convergence).

## Round 6 (post-fix judge panel)

| Axis | Score | vs. Round 5 |
|---|---|---|
| Industry-standards | 4/10 | same |
| UX | 6/10 | same |
| Efficiency | 4/10 | **-2** |
| Accessibility | 8/10 | same |
| Visual polish | 7/10 | +2 |
| Resilience & edge cases | 6/10 | **-1** |
| Code quality | 6/10 | same |
| Mobile/responsive | 6/10 | same |
| Security | 10/10 | same |

**Average: 6.33/10** (down slightly from 6.44). 6 axes below floor (7):
industry-standards, UX, efficiency, resilience, code quality,
mobile/responsive.

**Regression check:** round 6's actual diff (3 Tailwind className changes
across 2 commits, confirmed via `git show` by multiple judges) was
independently verified clean by every judge -- visual polish rose 5->7 as
intended, and no judge found anything wrong with the shipped fix itself.
The two score drops are NOT caused by round 6's diff:
- **Efficiency (6->4):** a fresh, deeper pass found a concrete root cause
  behind round 5's already-known "unmemoized filters recompute on
  unrelated renders" finding -- two unscoped `watch()` calls (RHF's
  `watch()`, not `useWatch`) force the entire page to re-render on every
  modal keystroke, and the client-filtered path's `limit:100` fetch
  compounds with the still-missing search debounce (undebounced keystrokes
  now trigger 100-row fetches, not 20-row, in that mode). Same class of
  persistent debt as round 4's industry-standards/code-quality drift, now
  scored more harshly with more precise diagnosis -- not something round
  6 introduced.
- **Resilience (7->6):** a fresh finding, live-verified: `deleteRisk` is
  destructured without `isLoading`, and `DeleteAlertModal` is invoked
  without a `loading` prop, so its Delete button is never disabled while
  the request is in flight -- a double-click fires the mutation twice, the
  second call 404s against an already-deleted row, and the user sees a
  spurious "failed to delete" toast for a delete that actually succeeded.
  Concrete, real, and cheap to fix.
- The UX judge's live test of the still-open missing-debounce issue
  (typing a search term character-by-character) actually crashed and
  auto-restarted the real dev backend from request volume, and produced
  visibly dropped/garbled input characters plus a silent search-box reset
  once the backend recovered -- strong empirical evidence this is a real,
  not theoretical, problem, and a strong candidate for a near-term round.

**Next fix (Round 7):** the delete double-submission guard (resilience) --
pass `deleteRisk`'s `isLoading` through to `DeleteAlertModal`'s `loading`
prop so the Delete button disables while the request is in flight. Concrete,
well-defined, single-file change. Strong runner-up: the search debounce
(now empirically confirmed to cause real backend instability, not just
theoretical over-fetching) -- likely round 8 if not folded into round 7.

## Round 7 — fix shipped (PR #620)

Shipped the delete double-submission guard: `useDeleteRiskMutation()` now
destructures `isLoading`, wired through to `DeleteAlertModal`'s existing
`loading` prop (which both disables the button and swaps its label to
"Deleting..."), matching the convention already used by `SitesEntities.tsx`
and other callers of this shared component. 1 new test, negative-control
verified. QA gate clean (1602 tests). Live-verified: opened the delete
modal on a real risk, confirmed the button renders normally (enabled) in
the ordinary case -- cancelled without deleting to avoid touching real
data.

Adversarial review round 1 (2 parallel angles) found no bugs in the fix
itself, but surfaced: (a) a minor, real defense-in-depth gap -- the
disabled-button guard depends on a re-render landing before a second
invocation, with no guard inside `confirmDeleteRisk` itself -- fixed with
a one-line `|| isRiskDeleting` addition to the existing early-return; (b)
confirmation that `createNewRisk`/`updateRisk` on this same page already
correctly gate on their own `isLoading` (this was the one remaining gap on
this page); (c) 4 out-of-scope findings -- the identical discarded-
`isLoading` pattern in `UploadNotesModal.tsx`, `InspectionTable.tsx`,
`TemplatesPage.tsx`, and (worse, no confirmation modal at all)
`CorrelationMatrixPage.tsx`'s link-delete button -- flagged as a follow-up
task, not fixed here since they're outside this page's scope.

Round 2 of review came back clean. Merged under standing authorization.

**Next: re-run the judge panel** to score the page's post-fix state before
picking round 8's fix (or checking convergence).

## Round 7 (post-fix judge panel)

| Axis | Score | vs. Round 6 |
|---|---|---|
| Industry-standards | 4/10 | same |
| UX | 6/10 | same |
| Efficiency | 4/10 | same |
| Accessibility | 7/10 | **-1** |
| Visual polish | 8/10 | +1 |
| Resilience & edge cases | 7/10 | +1 |
| Code quality | 6/10 | same |
| Mobile/responsive | 6/10 | same |
| Security | 10/10 | same |

**Average: 6.44/10** (up slightly from 6.33). 5 axes below floor (7):
industry-standards, UX, efficiency, code quality, mobile/responsive.
Accessibility, resilience, visual polish, and security all clear the
floor.

**Regression check:** round 7's shipped fix (delete double-submission
guard) is real and correctly implemented -- confirmed by multiple judges
reading the code and one live-verifying at both desktop and mobile widths
(the "Deleting..." label fits cleanly in the h-11 button, dims correctly
using the same disabled-button treatment as every other button in the
app). But the fix itself introduced a genuine, concrete NEW accessibility
gap: disabling the shared `DeleteAlertModal`'s Delete button via
`disabled={loading}` forces the browser to blur a button the user just
clicked (a disabled native button cannot hold focus), and the "Delete" ->
"Deleting..." label swap has no `aria-live` wrapping it -- so a keyboard/
screen-reader user loses precise focus context and gets no announcement
at the exact moment their destructive-action click registers. This is a
real regression this round's own diff caused (not judge-severity-drift),
same as round 5's mobile-fix/visual-polish regression earlier in this
loop -- per this loop's established discipline, fixed directly next
rather than escalated.

New findings, all pre-existing and independent of the regression above:
- Resilience: `onSubmit` (create/update) has no internal re-entrancy guard
  matching the one just added to `confirmDeleteRisk` -- and arguably worse,
  since a double-fire there doesn't 404, it can silently create two
  duplicate risk rows. Flagged, not yet fixed.
- Resilience: cross-tab staleness -- deleting a risk from another
  tab/session while this tab's delete-confirmation modal is still open
  shows the same false "failed to delete" toast the round-7 fix eliminated
  for same-tab double-clicks, since the fix can't distinguish "double
  submit" from "already gone" without a real not-found special-case.
- Code quality: the new `isRiskDeleting` guard introduces a second,
  different double-submission-prevention strategy (an internal early
  return) alongside the existing disabled-button-only approach used for
  create/update -- inconsistent with its sibling pattern in the same file.

**Next fix (Round 8):** fix the accessibility regression in the shared
`DeleteAlertModal` component (benefits every caller, not just this page) --
add an `aria-live` region announcing the "Deleting..." state change, and
address the focus-strand (e.g. `aria-disabled` + a `pointer-events-none`/
click-guard instead of the native `disabled` attribute, so the button stays
focusable while still preventing re-entry). Concrete, well-defined, shared-
component fix with a proportionally larger blast radius (positive) than
this page's other single-file fixes.

## Round 8 — fix shipped (PR #621)

Shipped both accessibility gaps in the shared `DeleteAlertModal.tsx`
component (kept the native `disabled` attribute rather than switching to
`aria-disabled`, since that would have lost the button's existing
`disabled:opacity-50` styling for free -- solved the focus-strand
differently instead): added a `useEffect` that moves focus to the
still-enabled Cancel button when the focused Delete button becomes
disabled, and a visually-hidden `aria-live="polite"` span announcing the
"Deleting..." transition. 2 new tests, negative-control verified. QA gate
clean (1604 tests).

**Incident during live verification (disclosed in the PR body):** while
attempting to live-verify the fix by hanging a DELETE request via a
`window.fetch` monkey-patch, the patch failed to intercept RTK Query's
`fetchBaseQuery` (which had already captured a reference to the original
`fetch`), and clicking Delete went through as a real deletion of the
"Design audit sample risk" test fixture on the preview account's "Judge
Test Site." No production or real user data was affected -- this was
isolated to a disposable preview/test account already used throughout this
session's judge testing. The fixture was immediately recreated via the UI
(same name/description/site/category) to restore the test environment.
Given this risk, further live delete-click-through testing was skipped in
favor of the unit tests, which already cover the focus-move and aria-live
behavior with negative controls. Lesson for future rounds: a `window.fetch`
monkey-patch applied via javascript_tool after page load is unreliable for
intercepting requests from libraries (like RTK Query) that may capture
their own `fetch` reference at module-init time -- do not rely on this
technique for any interaction with a real, non-idempotent side effect
(deletes, mutations) without first confirming the patch actually
intercepts a benign GET request, or avoid live-testing the destructive path
entirely in favor of unit tests with negative controls.

Adversarial review (2 parallel angles: line-by-line/cross-file, and
shared-component blast-radius) came back clean on round 1 -- confirmed the
fix is inert/safe for the 3 `DeleteAlertModal` callers that don't pass
`loading` at all, and traced all 9 usage sites across 8 files with no
conflicts found. One minor, non-blocking future-proofing suggestion
(the focus-move querySelector is positional rather than identity-based)
was noted but not acted on. Merged under standing authorization.

**Next: re-run the judge panel** to score the page's post-fix state before
picking round 9's fix (or checking convergence). This is the loop's 8th
fix round, per the 10-round guardrail -- worth watching for stagnation.

## Loop stopped after Round 8 — stagnation, escalating rather than continuing

**Decision:** stopping here rather than running rounds 9-10, and reporting
back rather than continuing silently. Two independent reasons converged:

1. **Stagnation.** The average has moved between 5.89 and 6.56 for the
   last 5 rounds straight (6.56 -> 6.33 -> 5.89 -> 6.44 -> 6.33 -> 6.44)
   with no sustained upward trend -- every round's fix genuinely shipped
   and genuinely helped its target finding, but the overall average keeps
   drifting back down as other axes get re-scored more harshly for
   persisting unaddressed. This is the loop's own stagnation guardrail in
   spirit, if not its exact two-consecutive-rounds letter.
2. **The two lowest-scoring axes need scope, not more patches.**
   Industry-standards (4/10, unchanged across 5 straight rounds) is
   missing column sorting, bulk actions, and CSV/PDF export -- each a real
   feature, not a bug fix. Efficiency (4/10, down from 6) needs a
   debounced search input plus switching several unscoped `watch()` calls
   to `useWatch`/`getValues` and memoizing the row-render path -- a
   meaningful refactor of this file's render architecture, not a
   single-file patch. Continuing to ship small, cheap fixes to other axes
   (as rounds 5-8 did) cannot move the average past roughly 6.5-7 while
   these two structural gaps sit at 4/10 each.

**Safety note:** round 8's live verification caused an unintended real
deletion of a test-fixture risk (see that round's entry above for the
full account) -- contained to a disposable preview account, disclosed in
the PR, and the fixture was restored. No production or user data was
affected. Flagging it here again because it's a legitimate incident from
an unsupervised session, not because further action is needed.

### Full scores-over-time table

| Round | Industry | UX | Efficiency | A11y | Visual | Resilience | Code Qual. | Mobile | Security | **Avg** |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 5 | 5 | 5 | 7 | 6 | 8 | 7 | 4 | 10 | **6.33** |
| 2 | 6 | 5 | 6 | 7 | 6 | 7 | 8 | 4 | 10 | **6.56** |
| 3 | 6 | 5 | 6 | 7 | 6 | 4 | 8 | 5 | 10 | **6.33** |
| 4 | 4 | 5 | 6 | 6 | 6 | 6 | 6 | 4 | 10 | **5.89** |
| 5 | 4 | 6 | 6 | 8 | 5 | 7 | 6 | 6 | 10 | **6.44** |
| 6 | 4 | 6 | 4 | 8 | 7 | 6 | 6 | 6 | 10 | **6.33** |
| 7 | 4 | 6 | 4 | 7 | 8 | 7 | 6 | 6 | 10 | **6.44** |
| 8 | *(not re-scored -- loop stopped before round 8's judge panel to avoid running another 9-judge round on a page about to be re-planned)* |

### What was fixed, one line each

- **Round 2 (PR #615):** real server-side pagination (20/page), replacing
  a hardcoded, silently-truncating `page:1,limit:100` fetch.
- **Round 3 (PR #616):** hit-slop touch targets on the Edit/Delete row
  buttons (20x20px -> ~36x44px effective hit area).
- **Round 4 (PR #617):** 3 resilience gaps -- sites-query error handling,
  a `NaN`-rendering guard on financial impact, and a distinct loading row.
- **Round 5 (PR #618):** header subtitle no longer falsely reads "0 risks
  found" during loading/error states.
- **Round 6 (PR #619, 2 commits):** fixed a visual-polish regression round
  5's own CSS introduced (one-off font size, inconsistent error color) --
  including a self-caught follow-up (the table's error row was still the
  wrong color too).
- **Round 7 (PR #620, 2 commits):** delete double-submission guard (button
  now disables while a delete is in flight, plus a defensive internal
  guard).
- **Round 8 (PR #621):** fixed the accessibility regression round 7's own
  fix introduced (focus-strand + silent state change on the shared
  `DeleteAlertModal`'s Delete button) -- benefits every caller of that
  component, not just this page.

### What's still open, by axis

- **Industry-standards (4/10, the worst axis):** no column sorting, no
  bulk row actions, no CSV/PDF export. This needs real feature work.
- **Efficiency (4/10, tied worst):** search has no debounce (empirically
  confirmed to rate-limit/crash the dev backend during this loop's own
  testing); several `watch()` calls from react-hook-form force whole-page
  re-renders on every modal keystroke; the row list and its per-row
  category/badge computation are unmemoized.
- **UX (6/10):** no retry affordance on any error state; no unified
  "clear all filters" action; the pager silently disappears (no
  explanation) when the client-side status/pending-approval filters are
  active.
- **Code quality (6/10):** file has grown to ~1290 lines across 8 rounds
  of in-place fixes with no extraction; file-wide `eslint-disable`
  broader than the 2 lines that need it; an inline IIFE for category
  badges; the shared `RiskBadge` component exists but isn't reused here.
- **Mobile/responsive (6/10):** touch targets on filter controls are
  36px, under the 44px guideline; the table needs horizontal scroll at
  375px; the Add/Edit modal's numeric-score grids don't collapse to a
  single column on mobile.
- **Resilience (7/10, clears the floor):** the Add/Edit modal's own Site
  dropdown has no sites-failure indicator of its own (the one message
  lives on the list page, hidden behind the modal); `onSubmit`
  (create/update) lacks the same internal re-entrancy guard round 7 added
  for delete.
- **Accessibility (7/10, clears the floor):** the header subtitle's
  loading/error text has no `aria-live` of its own (lower severity --
  the table's own live regions duplicate the same info).
- **Visual polish (8/10) and security (10/10) both clear the floor
  comfortably.**

### Diagnosis: why the loop stalled rather than converging

Every individual round's fix was real, correctly scoped, negative-control
tested, and adversarially reviewed clean -- this isn't a case of sloppy
work not landing. The pattern is structural: 6 of 8 rounds fixed
resilience/UX/accessibility papercuts (each genuinely worth fixing), while
the two lowest-scoring axes never received a round of their own, because
each of their fixes is bigger than "highest-leverage single fix" scope --
sorting/bulk/export is a multi-day feature; the search-debounce +
`watch()`-scoping + row-memoization effort is a real refactor of this
file's render architecture, not a drop-in patch. The loop's own
fix-selection rule ("select the single highest-leverage concrete fix")
kept correctly picking the cheapest available win each round, which meant
industry-standards and efficiency were never that round's pick -- and an
axis that's never addressed can't move.

### Recommendation

Two structural workstreams, each larger than this loop's per-round scope,
would need to happen before another quality-bar-loop pass on this page
could plausibly reach 9/10:

1. **Data-grid feature work:** column sorting, row selection + bulk
   actions, CSV/PDF export. Likely worth a design pass first (does this
   warrant pulling in a table library, or hand-rolling against the
   existing shared components?).
2. **Render-performance pass:** debounce the search input; switch the
   react-hook-form `watch()` calls in the Add/Edit modal to `useWatch`
   scoped to just that subtree (or extract the modal into its own
   component); memoize the row list and its per-row derived values.

Once either lands, a fresh (or resumed) quality-bar-loop pass on this page
would very likely clear the floor on both of today's worst axes and push
the average meaningfully past 7.

## Loop resumed at round 9 (user: "keep going with /quality-bar-loop")

Neither of the two recommended structural workstreams (data-grid features,
render-performance pass) had landed since the round-8 stop -- the 8 PRs
that shipped in the interim (#619-#626) were narrower fixes discovered
along the way (a visual-polish regression, a delete double-submit bug
across 5 files, 2 rounds of global `--destructive` CSS token contrast
tuning, and 2 CompliancePage-specific false-zero-count fixes on a
different page entirely). None touched this page's sorting/bulk/export
gap or its `watch()`/debounce/memoization gap.

## Round 9 (fresh judge panel)

| Axis | Score | vs. Round 8 |
|---|---|---|
| Industry-standards | 4/10 | same |
| UX | 6/10 | same |
| Efficiency | 3/10 | **-1** |
| Accessibility | 6/10 | **-1** |
| Visual polish | 7/10 | **-1** |
| Resilience & edge cases | 7/10 | same |
| Code quality | 5/10 | **-1** |
| Mobile/responsive | 4/10 | **-2** |
| Security | 10/10 | same |

**Average: 5.78/10** (down from 6.44). Continues the decline pattern that
triggered the original stop. 6 axes below floor (7): industry-standards,
UX, efficiency, accessibility, code quality, mobile/responsive.

**Regression check:** no fix has been shipped yet this round -- every score
change above is a fresh judge pass finding something a prior round's judge
either missed or scored more leniently, not a regression from shipped code.
Two are genuinely new, concrete, previously-uncaught, live-verified
findings worth acting on directly:
- **Accessibility:** the search input and both filter `&lt;select&gt;`
  elements (Site, Category) have no `&lt;label&gt;`, `aria-label`, or
  `aria-labelledby` at all -- a real WCAG 4.1.2 (Name, Role, Value)
  failure, live-verified via DOM inspection. Screen readers get zero
  accessible name for the page's primary filtering controls, not even a
  placeholder-text fallback (placeholders don't count as accessible
  names). Cheap, concrete, high-confidence fix.
- **Mobile:** the sidebar doesn't collapse into a mobile drawer at 375px,
  consuming ~40% of the viewport alongside content -- but this looks like
  an app-wide layout pattern (or lack thereof), not something scoped to
  this one page, so it's flagged rather than picked as this round's fix.
- **Visual polish:** the delete-confirmation modal's Delete button
  (`bg-red-600`/`text-white`, hardcoded) never adopted either round of
  `--destructive` token retuning (#623/#624) -- a pre-existing, separate
  hardcoded color that both rounds of app-wide CSS work happened to miss.
  Real, but a shared-component change (`DeleteAlertModal.tsx`), not
  page-specific.
- Efficiency and code quality both dropped from the same
  already-documented, unaddressed root causes (unscoped `watch()` calls,
  no memoization, the delete-guard's asymmetric pattern vs. create/update)
  being re-scored more harshly on repeat viewing -- consistent with this
  loop's established judge-severity-drift pattern on long-stalled axes,
  not new information.

**Next fix (Round 9):** the accessibility gap -- add proper labels
(`aria-label` or a visually-hidden `&lt;label&gt;`) to the search input and
the Site/Category filter `&lt;select&gt;`s. Concrete, cheap, single-file,
live-verified-real, and doesn't require the larger structural work the
round-8 stop flagged for industry-standards/efficiency.

## Round 9 — fix shipped (PR #627)

Added `aria-label` to the search input and both filter `&lt;select&gt;`s,
following the exact convention already established on `CompliancePage.tsx`.
1 new test, negative-control verified (reverted each of the 3 additions
individually, confirmed the test fails each time, restored, confirmed
pass). QA gate clean (1613 tests). Live-verified: confirmed via DOM
inspection that all three controls report the correct `aria-label`.

Adversarial review (2 parallel angles: line-by-line/i18n, and a broader
accessibility-completeness sweep of the rest of the page) came back clean
on round 1 -- confirmed the accessible-name computation resolves correctly
(aria-label wins over placeholder/option text), the i18n keys are valid in
both locales, the test would genuinely catch a wrong-key typo, and a fresh
sweep of the rest of the main list view (Pending-approval toggle,
row-action buttons, Pagination) found no other unlabeled controls needing
the same fix. Merged under standing authorization.

**Next: re-run the judge panel** to score the page's post-fix state before
picking round 10's fix (or checking convergence / hitting the max-rounds
guardrail -- round 9 is the loop's 9th fix round of the default 10-round
cap).

## Round 9 (post-fix judge panel)

Only the accessibility judge was re-dispatched. Rationale: PR #627 is a
narrow, invisible `aria-label`-only change with zero effect on rendering,
layout, computation, or any other judged axis -- re-running all 9 judges
to re-confirm 8 axes that could not plausibly have moved would burn a
full judge-panel dispatch for no new information. The other 8 axes carry
forward unchanged from this round's pre-fix panel above.

| Axis | Score | vs. pre-fix |
|---|---|---|
| Industry-standards | 4/10 | carried forward |
| UX | 6/10 | carried forward |
| Efficiency | 3/10 | carried forward |
| Accessibility | 8/10 | **+2, live-verified** |
| Visual polish | 7/10 | carried forward |
| Resilience & edge cases | 7/10 | carried forward |
| Code quality | 5/10 | carried forward |
| Mobile/responsive | 4/10 | carried forward |
| Security | 10/10 | carried forward |

**Average: 6.0/10** (up from 5.78 pre-fix, still down from round 8's
6.44). Accessibility judge confirmed live: `aria-label` now resolves
correctly on the search input and both filter selects
(`{"inputAriaLabel":"Search risks","selects":[{"ariaLabel":"Filter by
site"},{"ariaLabel":"Filter by category"}]}`), fresh sweep found no new
regressions, one new low-severity item noted for completeness only (the
actions-column `&lt;th&gt;` has no accessible name) -- not counted against
this round's score, since it's pre-existing and out of scope for PR #627.

**Convergence check:** not converged. Average 6.0 &lt; 9 target. 5 axes
still below the floor of 7: industry-standards (4), UX (6), efficiency
(3), code quality (5), mobile/responsive (4).

**Guardrail check -- stopping here:**
- **Max rounds:** this is the loop's 9th completed fix round out of the
  default 10-round cap. Only 1 round remains.
- **Stagnation / declining trend:** round 8 peaked at 6.44. Round 9,
  after a full fix-and-verify cycle, still lands at 6.0 -- net *below*
  round 8 despite the additional work. This mirrors the exact pattern
  that triggered the original round-8 stop.
- **Math on the remaining budget:** reaching a 9.0 average from 6.0
  requires +27 points of improvement spread across 9 axes. Even a
  best-case, fully-successful fix on the single furthest-below-floor axis
  (efficiency, 3 -&gt; 9) only moves the average by (9-3)/9 = 0.67, to
  ~6.67. One more round cannot mathematically reach convergence -- the
  two axes flagged at the original round-8 stop (industry-standards:
  sorting/bulk/export; efficiency: search debounce, `watch()` scoping,
  row memoization) require real feature/refactor work, not a single
  small patch, to move by the amount needed.

**Diagnosis:** the loop has now confirmed twice (round 8's stop, and
round 9's fresh re-check) that small, cheap, single-file fixes --
6 of which have shipped since the original stop (#619-#627) -- are
insufficient to move the two structurally-low axes. Every fix shipped in
this window improved a different page (CompliancePage) or a genuinely
real but narrow gap on this page (accessibility labels); none touched
sorting/bulk/export or the debounce/memoization work. Continuing to
round 10 on another small, cheap fix would not change this outcome and
would exhaust the loop's guardrail budget without a realistic path to
9/10.

**Recommendation:** stop the autonomous loop here rather than spend the
last permitted round on another small fix that can't reach convergence.
The two remaining structural workstreams from the original round-8 report
still stand as the actual path to a meaningfully higher score:
1. **Industry-standards (4/10):** add sorting, bulk actions, and
   export -- the concrete gaps vs. reference data-grid tools (AG Grid,
   TanStack Table) named in the original judge findings.
2. **Efficiency (3/10):** debounce the search input, scope `watch()`
   calls narrowly instead of watching the whole form, and memoize row
   rendering.

Recommend treating these as their own scoped, planned pieces of work
(each easily its own multi-file PR) rather than continuing this
quality-bar-loop's small-fix cadence into its last round.

## Structural workstream 1 (efficiency) -- shipped, PR #628

Per the user's go-ahead to proceed on the two recommended workstreams
directly: shipped debounce (search input, 300ms, same convention as
TemplatesPage/SitesEntities), row memoization (extracted a memoized
`RiskRow` component, same convention as RiskGraphPage's
`RiskGraphNode`/`RiskGraphLinkLine`), and a `watch()` dedup in the
Add/Edit modal. Two review rounds: round 1 found one real issue
(`setPage(1)` firing synchronously ahead of the debounce, causing a
stale-searchTerm request flash on any page > 1 -- fixed by moving the
reset into a `useEffect([debouncedSearch])`, matching SitesEntities);
round 2 came back clean. Merged.

This directly addresses the efficiency axis's concrete gaps from the
round-8/round-9 diagnosis. Does not re-run the judge panel to re-score --
that's deferred until the industry-standards workstream (sorting/bulk
actions/export) also lands, so both structural fixes get scored together
rather than burning a judge-panel dispatch per fix.

**Next: structural workstream 2 (industry-standards)** -- sorting,
bulk actions, CSV export. No sort/bulk convention exists elsewhere in the
codebase yet (confirmed via research); export will reuse RiskGraphPage's
existing CSV-export helpers (`triggerDownload`/`csvTextField`).

## Structural workstream 2 (industry-standards) -- shipped, PR #629

Added column sorting (Name/Score/PageRank/Impact, client-side/current-page
only -- no sortBy convention exists anywhere in this codebase, documented
as a scoped limitation matching the isClientFiltered precedent), bulk
row-selection + bulk delete (reusing the single-delete mutation via
Promise.allSettled, no bulk endpoint exists), and CSV export (a separate
unpaginated fetch respecting current server-side filters, limit:1000).
Extracted RiskGraphPage's CSV-injection-safe triggerDownload/csvTextField
helpers into a new shared src/utils/csvExport.ts so both pages share one
implementation instead of two copies drifting apart.

Two review rounds: round 1 found one real issue (confirmBulkDelete
cleared the whole selection even on partial failure, discarding the
retry opportunity the partial-failure toast implies -- fixed to only
drop successfully-deleted ids from the selection); round 2 came back
clean. Merged.

Both structural workstreams flagged at the original round-8 stop are now
shipped (efficiency: PR #628; industry-standards: PR #629). Re-running
the full 9-judge panel is the natural next step to check whether this
closes enough of the gap to justify continuing the loop, or whether it
should stop here given the earlier round-9 stagnation diagnosis.

## Round 10 (fresh 9-judge panel, post PR #628/#629)

| Axis | Score | vs. round 9 |
|---|---|---|
| Industry-standards | 6/10 | +2 |
| UX | 7/10 | +1 |
| Efficiency | 9/10 | +6 |
| Accessibility | 7/10 | **-1 (regression)** |
| Visual polish | 7/10 | same |
| Resilience & edge cases | 7/10 | same |
| Code quality | 6/10 | +1 |
| Mobile/responsive | 3/10 | **-1 (regression)** |
| Security | 10/10 | same |

**Average: 6.89/10** (up from 6.0). Real, substantial improvement from both
structural workstreams, but two regressions and one live-reproduced
correctness bug surfaced by the panel:

- **UX judge live-reproduced a real bug**: clicking the same sort column
  twice never reversed direction. Root cause: `handleSort` called
  `setSortDir` as a side effect from inside `setSortKey`'s functional
  updater -- React's StrictMode double-invokes updaters in dev
  specifically to catch this, so the toggle fired twice and cancelled
  itself out.
- **Mobile regressed (4->3)**: the new checkboxes (14px, zero hit-slop)
  and sort-header buttons (16px tall, zero hit-slop) were worse touch
  targets than the Edit/Delete buttons already flagged at round 3.
- **Accessibility regressed (8->7)**: the bulk-action toolbar had no
  aria-live/role="status" announcement -- the same SC 4.1.3 gap the
  loading row already solves elsewhere on this exact page.
- Visual polish (checkboxes missing accent-primary) and resilience
  (stale selectedIds on single-row delete, no re-entrancy guard on
  export) findings, both real and cheap.

**Fix shipped (PR #630)**: fixed the sort-toggle bug, added hit-slop to
checkboxes/sort buttons, added the toolbar's live-region announcement,
added accent-primary/focus-ring to checkboxes, cleaned up selectedIds on
single-row delete, added the export re-entrancy guard, and extracted a
named EXPORT_ROW_LIMIT constant. Two review rounds (round 2 was a
trivial test-robustness tweak); merged.

**Next: re-run the panel** to confirm the sort-bug fix and the two
regressions are actually resolved, not just addressed in isolation.
