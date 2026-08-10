# Quality Bar Loop — Templates (`/organization/audit/templates`, TemplatesPage.tsx)

Target: average >= 9/10, every axis >= 7/10 floor. Max rounds: 10 (default,
not a hard stop per standing user instruction carried over from earlier
loops in this same session).
Active judges: industry-standards, UX, efficiency, accessibility, visual
polish, resilience & edge cases, code quality, mobile/responsive, security
(both conditional judges activated -- the page manages inspection
templates with create/edit/delete, same risk profile as every other org
page looped this session).

Standing merge authorization: yes (carried over from earlier loops in this
same session -- merge automatically once a fix passes review).

Started as the next item in the sidebar-navigation sweep, immediately
after the Audit Missions loop reached a comprehensive stopping point (7
rounds, every round-1 axis addressed). No prior quality-bar-loop history
exists for this page. User instruction: "keep going down the list of
tabs" -- and explicitly, do not pause between rounds/pages to ask
permission to continue; only stop for a genuine blocker.

## Round 1

| Axis | Score |
|---|---|
| Industry-standards | 3/10 (tied lowest) |
| UX | 6/10 |
| Efficiency | 9/10 |
| Accessibility | 7/10 |
| Visual polish | 8/10 |
| Resilience & edge cases | 4/10 |
| Code quality | 8/10 |
| Mobile/responsive | 3/10 (tied lowest) |
| Security | 7/10 |

**Average: 6.11/10.** Below target (9); 4 axes below floor (7):
industry-standards, UX, resilience, mobile.

Key findings by axis:

- **Industry-standards (3/10, tied lowest):** compared against SafetyCulture/iAuditor, Typeform, Google Forms template management. Real gaps: no versioning model at all (editing a template doesn't snapshot/version it, no changelog, though inspections do denormalize `template` onto themselves as a partial mitigant); no duplication/clone action anywhere in the API or UI (every reference tool in this category treats cloning as first-class); no categories/tagging/folders (flat list, search-only); no publish/draft state or usage tracking (a half-built or dead template is indistinguishable from a real one). One real strength: system-template protection correctly locks the AI-generated template from Edit/Delete, though via a fragile name-substring check (tracked as #377).
- **UX (6/10):** search works well (debounced, live-verified). Edit flow is solid (full-page editor with autosave). Real gaps: no duplicate/clone action; the template NAME is a link to the report view, not the editor, while a separate pencil icon goes to edit -- a real first-click mismatch; system-template protection is discoverable only via a hover tooltip on a disabled button; delete has no undo. **Also flagged: a live-reproduced crash** clicking "Create Template" (`ReferenceError: id is not defined` inside RiskMultiSelect, caught by an error boundary with no visible error to the user) -- the judge suspected dev-session/HMR bleed since RiskMultiSelect belongs to AuditPage, not Templates, but flagged it as worth independent verification before dismissing.
- **Efficiency (9/10):** genuinely avoids the unmemoized-derived-data bug class hit on 7+ sibling pages this session, because pagination/search are server-side (`limit=10`) rather than fetching everything and filtering client-side. Minor inert nits (unmemoized `?? []` fallback, unstable callbacks) don't currently cost anything at this scale.
- **Accessibility (7/10):** clean heading hierarchy, real per-item aria-labels, both modals correctly built on Radix (DeleteAlertModal/CreateTemplateWithAIDialog) rather than hand-rolled, DeleteAlertModal has real documented a11y fixes from earlier rounds (focus restoration, aria-live). Real gap found in a modal outside this page's own file: `CreateTemplateWithAIDialog.tsx` has 2 label-association bugs (an orphaned `htmlFor="file"` pointing at a nonexistent id, and an unassociated risk-select label) -- same bug class fixed on AuditPage this session, not yet fixed here.
- **Visual polish (8/10):** no hand-rolled status colors (no severity/status badges on this page at all), both modals correctly Radix-based, live-verified clean rendering in dark mode. Minor: disabled system-template buttons rely on opacity alone with no row-level visual grouping; truncation logic is hand-rolled with a slice+ellipsis instead of the `line-clamp`/`truncate` utility the adjacent name column already uses.
- **Resilience (4/10):** `isError` omitted from the primary list query -- same bug class fixed on 4+ sibling pages this session, a failed fetch silently renders the "no templates found" empty state. Zero test coverage for the error path. Unguarded `new Date()`+`format()` on `createdAt`/`updatedAt` could throw on malformed data with no guard. Delete confirmation itself is solid (double-submit guard, success check before closing).
- **Code quality (8/10):** the `isSystemTemplate` fragility is real but well-contained (documented, single shared utility, cross-referenced to the backend's equivalent hack). One file-level `any`-lint-disable for a single `catch (err: any)` that could be scoped down. Types are genuinely real end-to-end (`TemplateSummary` deliberately narrower than `ITemplate`, explained why). Unusually good comment discipline citing specific issue numbers.
- **Mobile (3/10, tied lowest):** the identical systemic touch-target bug found and fixed on 9+ sibling pages this session -- row Edit/Delete buttons measured 30x24px (45% of the 44px guideline, from the shared `Button` component's `size="sm"` -> `h-6`), Create/Generate-with-AI buttons 28px tall, search input 28px tall, pagination controls 24x24px (all from shared `Button`/`Input` component size variants, not page-specific overrides). Minor 10px horizontally-scrollable (not clipped) table overflow.
- **Security (7/10):** role gating correctly uses the standard `canWriteOrgResource`/`useMyOrgRole` pattern, explicitly documented as UX-only with real server-side enforcement. `isSystemTemplate`'s substring match is exploitable in a low-severity way (a user could accidentally self-lock their own template by naming it to include the protected substring, or the reverse if the real synthetic template is ever renamed) -- already tracked as #377. No XSS surface, no dangerouslySetInnerHTML, no sensitive logging. Minor: template logo rendered as a raw `<img src>` with no URL scheme validation on the frontend.

**Next fix (Round 2):** mobile and industry-standards are tied for
lowest (3/10), but mobile is the same proven, lowest-risk pattern
fixed on 9+ sibling pages this session (swap `Button`/`Input` size
variants for 44px-compliant ones), while industry-standards' gaps
(versioning, cloning, categories, draft state) are all real feature
builds. Following this session's own established convention of
picking the most mechanical/lowest-risk fix first, mobile goes first.
Before that: independently verify the UX judge's flagged Create-Template
crash, since a broken core create flow would be a correctness bug
worth fixing immediately regardless of axis.
