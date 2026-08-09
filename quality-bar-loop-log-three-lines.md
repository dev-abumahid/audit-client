# Quality Bar Loop — Three Lines Model (`/organization/three-lines-of-defense`, ThreeLinesOfDefensePage.tsx)

Target: average >= 9/10, every axis >= 7/10 floor. Max rounds: 10 (default,
not a hard stop per standing user instruction carried over from earlier
loops in this same session).
Active judges: industry-standards, UX, efficiency, accessibility, visual
polish, resilience & edge cases, code quality, mobile/responsive, security
(both conditional judges activated -- the page has real mutations across
5 different entity types (Risk/Finding/KRI/Compliance/AuditEngagement)
with per-entity-type role gating, same risk profile as every other org
page looped this session).

Standing merge authorization: yes (carried over from earlier loops in this
same session -- merge automatically once a fix passes review).

Started as the next item in the sidebar-navigation sweep, immediately
after the Regulatory Compliance loop paused (industry-standards/code-
quality both needing product/design-scoped work this loop shouldn't make
unilaterally). No prior quality-bar-loop history exists for this page.
User instruction: "keep going down the list of tabs."

## Round 1

| Axis | Score |
|---|---|
| Industry-standards | 5/10 |
| UX | 6/10 |
| Efficiency | 5/10 |
| Accessibility | 7/10 |
| Visual polish | 6/10 |
| Resilience & edge cases | 7/10 |
| Code quality | 7/10 |
| Mobile/responsive | 4/10 (lowest) |
| Security | 8/10 |

**Average: 6.11/10.** Below target (9); 5 axes below floor (7):
industry-standards, UX, efficiency, visual polish, mobile.

Key findings by axis:

- **Industry-standards (5/10):** correctly extends the IIA 2020 model
  with an explicit 4th "Governing Body" column; role-gating genuinely
  maps onto the model's independence principle (ADMIN for management
  line, LEAD_AUDITOR specifically for the audit line, verified live).
  Gaps: no classification rationale captured/shown anywhere (why is
  this item in 2nd line, not 1st?); no coverage/gap visualization at
  all -- the framework's central diagnostic question ("is 3rd line
  reviewing enough of what 1st/2nd own") only answerable by manually
  counting raw per-column totals; no structural distinction between
  "inherently 3rd-line by nature" (e.g. an audit engagement) vs. "tagged
  1st-line by choice"; Compliance/Audit drill-down only links to list
  pages, not per-record routes (an honest, documented gap, not hidden).
- **UX (6/10):** reassignment is fast with clear feedback (spinner,
  toast, live counts update via RTK Query invalidation, no reload,
  confirmed live). Gaps: all "move to" buttons are visually identical
  ArrowRight icons, differentiated only by hover tooltip -- with up to 3
  destination buttons per row now that Governing Body exists, "which
  one do I click" is a real live-confirmed friction point; scrolling
  loses position after a reassignment refetch; the honest "Unclassified
  Actions" bucket is easy to miss below a very long 1st Line column.
- **Efficiency (5/10):** the same unmemoized-derived-data pattern
  found on 4 sibling pages this session, at larger scale -- 20 separate
  `.filter()` passes per render (5 entity types x 4 lines), none
  memoized; clicking ANY single reassign button re-renders and
  re-filters the entire page, not just the affected row. No
  `React.memo` on `ItemRow`/`Section` despite 20-30+ instantiations.
  Query layer itself IS efficient (one combined query, not 5 separate
  fetches) -- the derived-view layer is the gap.
- **Accessibility (7/10):** icon-only reassign buttons correctly carry
  both `title` and `aria-label` with real "Move to Nth Line" text
  (verified live via the accessibility tree). Heading hierarchy
  correct and tested. Classification conveyed by more than color (dot +
  text status). Minor gaps: no aria-label on the severity dot itself
  (relies on adjacent text); no aria-live region for toast/pending
  announcements.
- **Visual polish (6/10):** correctly reuses the shared severity system
  via one unified `ItemRow` component across all 5 entity types --
  reads as one coherent page, not five bolted-together mini-pages
  (unlike sibling pages flagged this session). Real issues: severe live
  layout imbalance (23 items in 1st Line vs 2-3 in other columns,
  equal-width columns with no independent scroll, large dead
  whitespace); aggressive title truncation even at 1460px width with
  only a hover tooltip fallback; the identical-arrow-icon issue also
  hurts this axis.
- **Resilience (7/10):** genuinely well-architected around one combined
  query (not the isError-omission bug found on 4 sibling pages this
  session, avoided here by construction) and one unified `reassign()`
  funnel for all 5 mutation types with consistent try/catch/toast
  coverage -- error handling doesn't vary by entity type. Empty states
  exist per entity type. Gap: null/missing `line_of_defense` is only
  defensively handled for `actions` (a documented backend contract) --
  no runtime guard for the other 4 entity types, which would silently
  vanish from every column if the backend ever sent bad data.
- **Code quality (7/10):** permission logic properly centralized in one
  `canReassignEntity()` switch, not duplicated 5x -- exactly right per
  the round-1 prompt's specific concern. Real duplication elsewhere: 5
  near-identical Section/ItemRow blocks repeated per-line (not
  config/data-driven despite an identical shape), plus a second switch
  statement in `reassign()` that must stay in sync with the first if a
  6th entity type is ever added.
- **Mobile (4/10, lowest):** the same proven touch-target bug class
  fixed on 6 sibling pages this session -- every "Move to Line"
  reassignment button measures 22x22px live (half the 44px guideline),
  sitting only 4px apart in rows of up to 3 buttons (real mis-tap risk
  between adjacent destinations). The error-state Retry button is also
  undersized. No horizontal clipping -- the grid collapses to a single
  column correctly, titles truncate rather than overflow.
- **Security (8/10):** per-entity role gating matches test coverage
  exactly across all 4 roles, confirmed live (an Audit item showed no
  reassign arrows for a non-LEAD_AUDITOR role). Correctly treated as
  UX-only with the real boundary server-side (explicit code comment).
  No dangerouslySetInnerHTML, no sensitive logging. Minor
  inconsistency: only the KRI deep-link uses `encodeURIComponent`; Risk/
  Action links don't (low-risk, server-generated UUIDs today).

**Next fix (Round 2):** mobile is the clear lowest score (4/10) with
the same proven, low-risk pattern fixed 6 times already this session --
bump every reassignment button (and the error-state Retry button) to a
44px touch target.

## Round 2 (mobile -- touch targets, PR #661)

Bumped every "Move to Line" reassignment button (22x22px, up to 3 per
row, only 4px apart) and the error-state Retry button to 44px
(h-11/h-11-w-11 + shrink-0 so the flex-wrap row can't compress them
below the intended size).

Negative control confirmed both new test assertions fail without the
fix. One review round, both reviewers returned zero blocking findings
-- angle A specifically checked that `shrink-0` doesn't fight the
parent's `flex-wrap` behavior (it doesn't -- shrink-0 only guarantees
each button's own size, wrapping still handles overflow); angle B
live-verified all 3 buttons in a row at exactly 44x44px with correct
4px gaps and no overlap, then functionally tested a real reassignment
click end-to-end (toast fired, item moved columns, counts updated).

**Status:** mobile should clear the floor now. Remaining below-floor
axes: industry-standards (5/10), UX (6/10), efficiency (5/10), visual
polish (6/10) -- four axes still open, more than any other page's
post-mobile-fix state this session. All four need real design/refactor
work (industry-standards: coverage/gap visualization, classification
rationale capture; UX: distinguishable move-to buttons, scroll-position
preservation; efficiency: memoizing 20 filter passes across 5 entity
types x 4 lines, React.memo on ItemRow/Section; visual polish: column
height imbalance, title truncation). Given 4 axes remain below floor
(more than typical for a post-round-2 checkpoint this session), the
efficiency fix (memoization) is the most mechanical and lowest-risk of
the four -- same proven pattern as 4 sibling pages, worth one more
round before treating this as a pause point.
