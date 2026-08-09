# Quality Bar Loop — Audit Missions (`/organization/audit`, AuditPage.tsx)

Target: average >= 9/10, every axis >= 7/10 floor. Max rounds: 10 (default,
not a hard stop per standing user instruction carried over from earlier
loops in this same session).
Active judges: industry-standards, UX, efficiency, accessibility, visual
polish, resilience & edge cases, code quality, mobile/responsive, security
(both conditional judges activated -- the page has real create/edit
mutations for audit engagements, same risk profile as every other org page
looped this session).

Standing merge authorization: yes (carried over from earlier loops in this
same session -- merge automatically once a fix passes review).

Started as the next item in the sidebar-navigation sweep, immediately
after the Three Lines Model loop paused at round 3 (industry-standards/UX/
visual-polish all needing product/design-scoped work this loop shouldn't
make unilaterally). No prior quality-bar-loop history exists for this
page. User instruction: "keep going down the list of tabs."

## Round 1

| Axis | Score |
|---|---|
| Industry-standards | 3/10 |
| UX | 6/10 |
| Efficiency | 7/10 |
| Accessibility | 6/10 |
| Visual polish | 5/10 |
| Resilience & edge cases | 5/10 |
| Code quality | 7/10 |
| Mobile/responsive | 2/10 (lowest) |
| Security | 8/10 |

**Average: 5.44/10.** Below target (9); 6 axes below floor (7):
industry-standards, UX, accessibility, visual polish, resilience, mobile.

Key findings by axis:

- **Industry-standards (3/10, lowest non-mobile):** compared against IIA
  engagement-lifecycle guidance and tools like AuditBoard/TeamMate+. Real
  gaps: status workflow has no "follow-up" stage after completion (IIA
  Standard 2500 requires verifying corrective actions); `findings_count`
  is a hand-typed integer, not a real linkage to Findings records;
  `lead_auditor` is free text, not a reference to an org user (no
  reviewer/preparer distinction); `is_edited` boolean is the entire audit
  trail (no change history); report upload is one opaque file, no
  draft/final/issued states. One genuine strength: `linked_risks` does
  tie engagements to real Risk Register records via `RiskMultiSelect`.
- **UX (6/10):** lead-auditor free text (no picker) silently fragments
  identity across engagements; findings_count has zero navigation to
  what those findings actually are; status changes require the full
  edit modal, no quick-transition affordance; search-only filtering, no
  status/date filter, painful past PAGE_SIZE=20; 3 of 4 summary stats
  are silently page-scoped only (acknowledged in a comment re: #337) --
  a real misread risk for a compliance manager scanning stats.
- **Efficiency (7/10):** mostly escapes the sibling-page bug class since
  the list itself is server-paginated to 20 rows -- the classic
  unmemoized-hundreds-of-rows problem doesn't apply here. One real,
  narrower bug: `riskOptions` (a `.map()` over up to 500 risk records)
  is unmemoized and recomputes on every keystroke while the create/edit
  modal is open.
- **Accessibility (6/10):** heading hierarchy correct, icon buttons have
  dynamic aria-labels, modal correctly uses the shared `useModalA11y`
  hook for focus-trap/Escape. Two real gaps: form labels have no
  `htmlFor`/`id` association anywhere in the modal (8 fields); and a
  **live-reproduced regression in the shared hook itself** --
  useModalA11y's focus-restore-to-trigger-on-close did not fire in two
  separate live runs (focus landed on `<body>` instead), which may be a
  broader bug affecting every page using this hook, not just this page.
- **Visual polish (5/10):** two competing color systems on the same
  page -- status badges route through `SEVERITY_STYLES` correctly, but
  the 4 summary stat cards hand-roll their own colors at a different
  opacity tier, plus a third distinct green token on an inline action
  chip. Modal is hand-rolled `fixed inset-0` chrome, diverging from the
  shared Radix `Dialog` used by every other create/edit flow in the app
  (no close-X affordance in the header). Native unthemed date inputs
  clash with the dark theme.
- **Resilience (5/10):** the primary list query and the risk-picker
  query both omit `isError` -- same bug class fixed on 2 sibling pages
  this session. A failed refetch silently renders the "no audits" empty
  state instead of an error, misrepresenting a fetch failure as "zero
  engagements." Mutations (create/update/delete/upload) are fine --
  proper try/catch + toast. Malformed/missing fields (null
  lead_auditor, missing linked_risks) are defensively guarded correctly.
- **Code quality (7/10):** at 814 lines, notably smaller than
  CompliancePage's 1449-line monolith flagged this session -- not an
  urgent split. Real gap: the identical error-extraction cast/toast
  pattern is duplicated 3x (handleSave/handleDelete/handleReportUpload)
  instead of a shared `extractErrorMessage()` helper, violating this
  session's own "extract 3+ repeats" convention. No `any` typing found.
- **Mobile (2/10, lowest):** worse than the touch-target issue on 7
  sibling pages -- this is a genuine hard usability break, live-measured
  at 375px. The row action buttons (Edit/Delete) overflow the card's
  right edge entirely (actionsRect.right = 386.85px against a 375px
  viewport, card right edge at 351px) -- the Delete button is visually
  clipped off-screen and effectively untappable, not just undersized.
  The 4-card stats row also overflows with no wrap. Edit/Delete buttons
  additionally measure 26x26px with only 6px gap (same undersized
  pattern as elsewhere). Modal uses `grid-cols-2` with no responsive
  stacking, though at 375px this renders workably (157px columns,
  lower severity than the overflow bugs).
- **Security (8/10):** role gating correctly uses the standard
  `canWriteOrgResource` CRUD convention (not confused with
  ThreeLinesOfDefensePage's narrower reassignment-specific LEAD_AUDITOR
  gate, which is a different feature). Permission check correctly
  UX-only by the hook's own documented contract. Minor: file upload's
  `accept` attribute is client-side-only (trivially bypassable, low
  risk pending server-side enforcement); `handleDownloadReport` opens a
  stored `report_url` via `window.open` with no protocol allow-list --
  a writer-role user could theoretically set a `javascript:`/`data:`
  URI via direct API access. No XSS surface, no dangerouslySetInnerHTML,
  no sensitive logging.

**Next fix (Round 2):** mobile is the clear lowest score (2/10) and
contains the most severe concrete bug found this round -- Edit/Delete
buttons are not just undersized but genuinely clipped off-screen and
untappable at 375px, plus the stats row overflow and the standard
touch-target undersizing. Same proven fix pattern as 7 sibling pages
this session, with the added layout fix (wrap the row-actions cluster
and stats row) this round's judge specifically identified as the
highest-severity finding.
