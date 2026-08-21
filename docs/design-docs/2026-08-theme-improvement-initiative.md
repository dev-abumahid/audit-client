# Theme improvement initiative (2026-08)

## What this is

A multi-agent design/engineering pass to improve the app's existing visual
identity (dark navy / jade green, Fraunces + Manrope) — not replace it.
Four alternative visual directions (working names: Precision Instrument,
Field Ledger, Command Surface, Quiet Authority) were explored and shelved;
the current identity was preferred, so this work instead: (1) closes real
consistency/accessibility gaps found in that exploration, (2) adds motion
and interactivity using modern CSS, and (3) makes the public landing page
show the real product instead of a hand-drawn mockup.

Every phase below ships as its own small, independently revertable PR. If
a phase turns out to be the wrong call, `git revert <merge commit>` should
cleanly undo it without touching unrelated phases — that's a hard
requirement for how these PRs are scoped, not just a nice-to-have.

## Findings this work is based on (see PR descriptions for full detail)

- Design-token layer (Tailwind v4 CSS-first tokens, WCAG-AA-computed
  contrast, dedicated risk-severity palette, theme provider) is solid —
  kept as-is throughout.
- Component layer has real drift: ~24 hand-rolled modals vs. 14 using the
  shared `Dialog`; severity/status badges independently reimplemented
  despite an existing `severityStyles.ts` utility, adoption inconsistent
  within the same files in several cases.
- 23 toggle-button patterns have no `role="switch"`/`aria-checked` — a
  real accessibility bug, not just style debt.
- No flagship dashboard component (Risk Matrix, Overview, KRI dashboard,
  Compliance) has a props-injectable "preview" mode — all fetch live data
  directly. Proven fix pattern (see Phase B) verified end-to-end on
  `RiskMatrixPage`.
- `framer-motion` is installed but used in exactly one place — recommended
  to drop in favor of native CSS (`<dialog>`, `animation-timeline: view()`,
  `:has()`, container queries), each with a progressive-enhancement
  fallback documented in the relevant PR.

## Phases

| # | Phase | Status | PR |
|---|---|---|---|
| A1 | `role="switch"`/`aria-checked` fix on existing toggles + add `eslint-plugin-jsx-a11y` | planned | — |
| A2 | Badge primitive + severity-color migration | planned | — |
| B1 | Land the `RiskMatrixPage` → `RiskMatrixView` + preview pattern for real | planned | — |
| B2 | Extend the preview pattern to `Overview.tsx` | not started | — |
| C | Motion: drop framer-motion, native `<dialog>`, scroll reveals, `:has()` filtering, container queries, live-update flash pattern | not started | — |
| D | Modal consolidation (~24 files, smallest/safest first, `FindingDetails.tsx`/`AuditPage.tsx` last) — sequenced with Phase C since both touch modal files | not started | — |
| E | Landing page rebuild using real preview components + interactive demos + Phase C motion | not started | — |
| F | Remaining primitives (Checkbox/Avatar/Skeleton/Tooltip), opportunistic | not started | — |

This table is the source of truth for status — update the Status/PR
columns as each phase ships, rather than tracking progress anywhere else.

## How to revert this whole initiative

Because each phase is its own PR, reverting everything is reverting each
phase's merge commit in reverse phase order (F, then E, ... then A). There
is no shared migration or schema change anything else depends on — the
design-token layer was never touched, so a full revert leaves the app
exactly where it was before this initiative started.
