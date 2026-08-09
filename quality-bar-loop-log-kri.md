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
