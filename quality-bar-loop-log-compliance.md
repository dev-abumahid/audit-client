# Quality Bar Loop — Regulatory Compliance (`/organization/compliance`, CompliancePage.tsx)

Target: average >= 9/10, every axis >= 7/10 floor. Max rounds: 10 (default,
not a hard stop per standing user instruction carried over from earlier
loops in this same session).
Active judges: industry-standards, UX, efficiency, accessibility, visual
polish, resilience & edge cases, code quality, mobile/responsive, security
(both conditional judges activated -- the page has real create/edit forms
and multiple mutations including attest/delete, same risk profile as
every other org-risk page looped this session).

Standing merge authorization: yes (carried over from earlier loops in this
same session -- merge automatically once a fix passes review).

Started as the next item in the sidebar-navigation sweep, immediately
after the Alerts loop paused (industry-standards/UX/code-quality all
needing product/design-scoped work this loop shouldn't make
unilaterally). No prior quality-bar-loop history exists for this page.
This is the largest page looped so far this session (1449 lines). User
instruction: "keep going down the list of tabs."

Note: one round-1 judge accidentally logged out the shared browser
session mid-review (clicked an unlabeled sidebar element). Re-signed in
with the documented preview credentials before continuing -- no data
lost, session restored cleanly.

## Round 1

| Axis | Score |
|---|---|
| Industry-standards | 6/10 |
| UX | 7/10 |
| Efficiency | 7/10 |
| Accessibility | 8/10 |
| Visual polish | 8/10 |
| Resilience & edge cases | 8/10 |
| Code quality | 6/10 |
| Mobile/responsive | 4/10 (lowest) |
| Security | 8/10 |

**Average: 6.89/10.** Below target (9); 3 axes below floor (7):
industry-standards, code quality, mobile.

Key findings by axis:

- **Industry-standards (6/10):** genuinely solid attestation workflow --
  a real append-only audit trail (`ComplianceAttestation`, never
  updated/deleted), server-derived recurrence-aware overdue tracking,
  backend-enforced evidence requirement for compliant status (not just
  UI decoration), a real site x domain scorecard matrix with CDC 7.7
  thresholds. Gaps: no edit-history/versioning of the obligation itself
  (only attestation events are logged); `attested_by` renders as a raw
  account ID, not a resolved name; `line_of_defense` exists on the type
  but is never read/displayed/editable anywhere in this UI;
  `regulation_reference` is free text, no structured framework/control
  taxonomy; no approval/review routing before marking compliant.
- **UX (7/10):** clean single-column create/edit form; proactive
  evidence-requirement warning before a failed save; clear re-attest
  confirmation; well-differentiated loading/error/empty states
  (confirmed live via a real backend 429). Gaps: a rate-limited create
  surfaced a mislabeled "Validation Error" toast and flipped the WHOLE
  page into error states, not just the one save; attestation history
  shows opaque account IDs; narrow-viewport table hides exactly the
  fields (due date, overdue) a compliance user most needs to triage.
- **Efficiency (7/10):** `compliantCount`/`nonCompliantCount` fallback
  paths and `cellFor`'s linear `.find()` over the scorecard matrix
  (invoked in a nested map, O(sites x domains x matrix.length)) both
  lack memoization/indexing. `siteName` does an unindexed O(n) scan per
  call. `obligations.find(...)` for the editing obligation is computed
  twice in the same render. `obligations`/`matrixDomains`/
  `matrixSiteKeys` ARE properly memoized -- a partial fix already in
  place.
- **Accessibility (8/10):** all 3 hand-rolled modals consistently use
  the shared `useModalA11y` hook (verified live: Escape closes and
  correctly restores focus). Icon-only buttons have `aria-label`.
  Status conveyed by icon + text, not color alone. Real, non-trivial
  cross-modal focus-race fix already in place (`pendingFocusRef`).
- **Visual polish (8/10):** fully adopts the shared `severityStyles.ts`
  vocabulary, not hand-rolled colors -- exactly the pattern missing on
  2 sibling pages this session. Consistent modal chrome across all 3
  overlays. Minor inconsistency: 3 modals are hand-rolled `fixed
  inset-0` divs while delete uses the shared Radix-based
  `DeleteAlertModal` -- two different modal strategies in one file.
- **Resilience (8/10):** the strongest resilience score this session --
  BOTH primary RTK Query hooks (`useGetAllComplianceQuery`,
  `useGetComplianceScorecardQuery`) already check `isError`, each with
  a comment explaining a specific prior bug this fixed (the
  isError-omission bug class already found on 4 sibling pages this
  session was pre-emptively avoided here). Distinct loading/error/empty
  states as three mutually exclusive branches. Delete requires
  confirmation via the shared modal. Minor gaps: `useGetAllSitesQuery`
  has no isError check (low-risk, only backs a display-name fallback);
  the attestation-history query also lacks isError (a failed fetch
  would render identically to genuine empty history); file upload uses
  a second, separate error-handling pattern (raw fetch, not RTK Query).
- **Code quality (6/10):** at 1449 lines this is a monolith -- 3 full
  modal implementations, the scorecard matrix, and the main table all
  inlined in one component, natural extraction candidates. The
  attestation-history isError gap is also flagged here (untested).
  Duplicated request/toast pattern repeated 3x across
  save/delete/attest handlers. Positive: no file-wide `any`-disable, no
  scattered `any` casts -- real inline types used throughout, magic
  strings properly extracted into named constants.
- **Mobile (4/10, lowest):** the proven touch-target pattern (fixed on
  5 sibling pages this session) was never applied here -- EVERY
  interactive control measured under 44px live: "New Obligation" 32px,
  row actions menu 32x32px, "Create Action" 35px, modal close 28x28px,
  Cancel/Save/Confirm buttons 38px, all filter/form inputs 36px
  (`h-9`). Additionally, a real layout bug: the create/edit form's
  Status/Due-Date/Owner 3-column grid has no responsive stacking, so
  each cell is only 92px wide at 375px -- the Status select truncates
  ("In Progres") and the date input's calendar icon overlaps the
  placeholder text.
- **Security (8/10):** role gating consistent with the established
  pattern (`canWriteOrgResource`, ADMIN/LEAD_AUDITOR). Minor test gap:
  no explicit LEAD_AUDITOR write-access test (every other role-tested
  page this session covers this). No dangerouslySetInnerHTML, no
  sensitive logging, URLs properly encoded. Evidence-requirement
  validation correctly treated as UX hint with real backend enforcement
  (defense in depth, not client-trust-only).

**Next fix (Round 2):** mobile is the clear lowest score (4/10), and
the fix is the most proven pattern in this entire session (touch
targets, fixed on 5 sibling pages already) plus one concrete layout bug
in the same finding category (the 3-column form grid needs responsive
stacking) -- bundling both since they're the same "mobile layout"
finding, following the established one-fix-per-round convention for
tightly-coupled sub-issues.
