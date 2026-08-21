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
- 23 toggle-button patterns were reported to have no `role="switch"`/
  `aria-checked`. **Phase A1 re-verified this and found it stale** — an
  exhaustive re-check of `src/` found zero hand-rolled switch controls;
  the ones that exist already use correct ARIA (`aria-pressed`, native
  checkboxes with labels) from earlier, unrelated a11y remediation PRs.
  No component code changed for this reason; `eslint-plugin-jsx-a11y` was
  added instead so this bug class is now caught automatically going
  forward, whether or not it was ever real to begin with.
- No flagship dashboard component (Risk Matrix, Overview, KRI dashboard,
  Compliance) has a props-injectable "preview" mode — all fetch live data
  directly. Proven fix pattern (see Phase B) verified end-to-end on
  `RiskMatrixPage`.
- `framer-motion` is installed but used in exactly one place — recommended
  to drop in favor of native CSS (`<dialog>`, `animation-timeline: view()`,
  `:has()`, container queries), each with a progressive-enhancement
  fallback documented in the relevant PR.
- **Preview-pattern convention, established in Phase B1/B2**: split a page
  into a thin data-fetching wrapper + a presentational `*View.tsx` taking
  props, plus a `*Preview.tsx` demo entry point with mock data via the
  shared `assertPreviewOnly()` guard (`src/utils/assertPreviewOnly.ts`).
  For a page with more than a couple of data sources (Overview.tsx had 8),
  group props by domain — `{ risks: {data, isLoading, isError}, kris: {...},
  ... }` — not flat props per field; a `useMemo` depending on a group must
  depend on the group's `.data` field specifically, not the group object
  itself, since both the real wrapper and the preview construct a fresh
  literal every render. Neither B1 nor B2 wired their preview into a public
  route — that's deliberately deferred to Phase E, so there's no unused
  public surface sitting in production between phases.
- **Two Phase C ideas dropped from scope after investigation (Phase C3):**
  - *Native `<dialog>`*: the shared `Dialog` component (`src/components/ui/dialog.tsx`)
    is already built on Radix UI's `Dialog` primitive — fully accessible
    (focus trap, Escape, backdrop-click, return-focus-on-close) and used by
    14+ consumers. Rewriting it to the native `<dialog>` element would be a
    large, risky change to shared infrastructure for no real accessibility
    gain, since Radix already delivers equivalent behavior. The actual
    modal-consistency problem — ~24 *hand-rolled* modals not using the
    shared `Dialog` at all — is Phase D's job instead.
  - *Scroll-driven animation (`animation-timeline: view()`)*: researched as
    a replacement for the existing `useRevealOnScroll` IntersectionObserver
    hook (already reduced-motion-aware, used on the landing page's hero/
    features/testimonials sections). As of August 2026 this still isn't
    safe to ship without a JS fallback — Firefox requires a flag and Safari
    only just landed support in a 26 beta. Migrating would regress those
    users for a "remove some JS" benefit that isn't worth it yet. Revisit
    once support is broader; the existing hook stays as-is.
  - What *did* ship from Phase C3: `has-[:checked]`-based row-select
    highlighting on `RiskRegisterPage`/`InspectionTable` — CSS `:has()` is
    Baseline-safe everywhere as of 2026, no fallback needed.

## Phases

| # | Phase | Status | PR |
|---|---|---|---|
| A1 | `role="switch"`/`aria-checked` audit (found stale — no fix needed) + add `eslint-plugin-jsx-a11y` | **shipped** | [#991](https://github.com/Qiyrix/aexa-frontend/pull/991) |
| A2 | Badge primitive + severity-color migration | **shipped** (partial — 4 of ~25 files migrated, rest listed as follow-up in the PR) | [#992](https://github.com/Qiyrix/aexa-frontend/pull/992) |
| B1 | Land the `RiskMatrixPage` → `RiskMatrixView` + preview pattern for real | **shipped** (not yet wired to a public route — that's Phase E) | [#994](https://github.com/Qiyrix/aexa-frontend/pull/994) |
| B2 | Extend the preview pattern to `Overview.tsx` | **shipped** (not yet wired to a public route — that's Phase E) | [#996](https://github.com/Qiyrix/aexa-frontend/pull/996) |
| C1 | Drop `framer-motion` (its one usage site ported to a CSS `animate-fade-in` class) | **shipped** | [#998](https://github.com/Qiyrix/aexa-frontend/pull/998) |
| C2 | Live-update flash pattern: `useValueChangeFlash` hook + two-phase CSS transition + `aria-live` announcement, applied to the KRI dashboard | **shipped** | [#999](https://github.com/Qiyrix/aexa-frontend/pull/999) |
| C3 | `:has()`-based row-select highlighting on `RiskRegisterPage`/`InspectionTable` (native `<dialog>` and scroll-driven-animation ideas dropped from scope — see below) | **shipped** | [#1001](https://github.com/Qiyrix/aexa-frontend/pull/1001) |
| D | Modal consolidation (~24 files, smallest/safest first, `FindingDetails.tsx`/`AuditPage.tsx` last) — sequenced with Phase C since both touch modal files | **in progress** (4 of ~24 done — see below) | [#1003](https://github.com/Qiyrix/aexa-frontend/pull/1003), [#1004](https://github.com/Qiyrix/aexa-frontend/pull/1004), [#1005](https://github.com/Qiyrix/aexa-frontend/pull/1005) |
| E | Landing page rebuild using real preview components + interactive demos + Phase C motion | **shipped** (v1-v3 demo-section polish, then a full v2/v3-plan overhaul — see below) | [#1007](https://github.com/Qiyrix/aexa-frontend/pull/1007) (superseded), [#1009](https://github.com/Qiyrix/aexa-frontend/pull/1009) (superseded), [#1011](https://github.com/Qiyrix/aexa-frontend/pull/1011), [#1013](https://github.com/Qiyrix/aexa-frontend/pull/1013)–[#1023](https://github.com/Qiyrix/aexa-frontend/pull/1023) (11-PR overhaul, see below) |
| F | Remaining primitives (Checkbox/Avatar/Skeleton/Tooltip), opportunistic | not started | — |

This table is the source of truth for status — update the Status/PR
columns as each phase ships, rather than tracking progress anywhere else.

## Phase D status detail

**Pattern established** (4 modals shipped: `AttestConfirmModal`,
`ComplianceRiskLinkModal`, `RiskApprovalControls`'s Reject modal,
`FindingClosureControls`'s Reject modal): swap a hand-rolled
`fixed inset-0` overlay + the bespoke `useModalA11y` hook
(`src/hooks/useModalA11y.ts`) for the shared Radix-backed `Dialog`
(`src/components/ui/dialog.tsx`) — `Dialog`/`DialogContent`/
`DialogHeader`/`DialogTitle`/`DialogFooter`, `open`/`onOpenChange`
wired to whatever state already controlled the modal (a real boolean if
one existed, or a literal `true` for conditionally-mounted modals),
internal content otherwise untouched. Two real, reusable fixes came out
of the first migration: (1) this `radix-ui` version (1.4.3) never emits
`aria-modal` on `DialogContent` itself — fixed once in the shared
component, not per-caller; (2) a couple of `CompliancePage.test.tsx`
tests modeled clicking a different row's action while a modal was open
— Radix's stricter (correct) modality makes the rest of the page
`aria-hidden` while a dialog is open, so that's no longer reachable via
role queries (and, given the full-viewport overlay both old and new
implementations render, was likely never reachable by a real click
either — only jsdom's lack of pixel-occlusion checking let it "work"
before). Watch for the same pattern in any other modal-switching test.

**Remaining candidates, by risk** (`grep -rl useModalA11y src --include="*.tsx"`
minus the four done):

- **Small/standalone, likely safe next** — none currently identified;
  the four done were exactly the standalone small modal files. Re-run
  the grep and check line counts before assuming a new one qualifies.
- **Deliberately deferred, explicit warning already in the code**:
  `KriDashboardPage.tsx`'s three modals (`UpdateValueModal.tsx`,
  `EditKriModal.tsx`, `NewKriModal.tsx`) — `useModalA11y.ts`'s own
  comment (written before this initiative) explains these were
  deliberately kept on `useModalA11y` instead of the shared `Dialog`
  because migrating would mean re-styling all three to fit
  `DialogContent`'s own layout, a larger change than that a11y fix
  called for. Respect that unless doing the restyling work properly,
  with real layout comparison, not just a wrapper swap.
- **Everything else is embedded in a large page-level file, not a
  standalone modal component** — `IntelligencePage.tsx` (1478 lines),
  `InspectionReport.tsx` (1230), `AuditPage.tsx` (1109),
  `FindingDetails.tsx` (1227), `SitesEntities.tsx` (2062),
  `EditTemplatePage.tsx` (758), `CreateTemplatePage.tsx` (483),
  `RiskGraphPage.tsx` (2562), `RiskFormModal.tsx` (1931),
  `ComplianceFormModal.tsx` (469), `AttestHistoryModal.tsx` (303, plus
  its own roving-tabindex tab management — more complex than a plain
  confirm modal), `QnASettingsPanel.tsx` (415), `TrendModal.tsx`
  (KRI folder, likely shares the KRI restyling risk above). Migrating
  the modal wrapper *within* one of these is meaningfully higher-risk
  than the four done tonight — larger diff, harder to isolate the
  modal-only change, more surface area for an unrelated regression in
  the same file. Treat each as its own careful pass, not a batch.
- `DeleteAlertModal.tsx` only mentions `useModalA11y` in a comment
  (explaining a related fix) — it already uses `AlertDialog`, no work
  needed.

## Phase E status detail

**Shipped, v2 (current)**: `ProductDemoSection.tsx` on the public
landing page (`src/pages/home/Home.tsx`, between `HeroFeatures` and
`FeaturesSection`) renders three purpose-built, animated widgets under
`src/pages/home/components/productDemo/` — `RiskMatrixWidget`,
`KriTrendWidget`, `RiskGraphWidget`. Each computes its displayed values
from the same real mock fixtures and scoring functions the live app
uses (`getRiskSeverityLevel`, `MOCK_RISKS`/`MOCK_KRIS`/`MOCK_RISK_LINKS`),
presented in the same stylized, theme-token-driven-DOM idiom
`HeroProductVisual.tsx` already established for the hero — not a
literal page embed. Genuine motion throughout (staggered cell/node
entrance, SVG `stroke-dashoffset` draw-in for the trend line and graph
edges, a new `useCountUp` hook for the KRI value), all gated behind
`prefers-reduced-motion` via `motion-safe:`/`motion-reduce:`.

**v1 → v2, why it changed**: the first version (PR #1007) literally
embedded the authenticated `OverviewView` dashboard component fed mock
data. It was real (no fabricated numbers) and technically sound, but
direct user feedback was that it read as a cropped admin screenshot,
not a designed marketing moment — the ask was "designs, motion" not
"the actual dashboard verbatim." PR #1009 replaced it entirely with the
three widgets above. `OverviewView`'s `titleHeadingLevel` prop (added
for v1's heading-hierarchy fix) was reverted as dead code once nothing
rendered `OverviewView` on the landing page anymore. v1's disclosed
mock-link-redirect limitation is now moot — the widgets don't render
any `<Link>` elements at all.

**Deliberately untouched**: `HeroSection`'s existing product visual
(`HeroProductVisual.tsx`) — still a well-crafted, theme-token-driven,
accessibility-reviewed compact illustration, and the direct stylistic
ancestor of the three new widgets. Kept as-is; the new section is a
separate, larger showcase further down the page, not a hero-visual
swap.

**Review findings fixed during v2's own review loop** (both rounds
clean before merge): a `RiskGraphWidget` non-null assertion on a mock-
data lookup that would crash the entire public homepage if a future
fixture edit ever removed the hub risk (now returns `null` gracefully);
`RiskMatrixWidget`'s grid had no accessible name (cells were plain divs
with only a `title` attribute, not reliably read by screen readers) —
fixed with `role="img"` + a real `aria-label` summarizing the actual
computed severity counts, individual cells `aria-hidden`. Both fixes
have dedicated regression tests (`RiskMatrixWidget.test.tsx`,
`RiskGraphWidget.test.tsx` — neither existed before this review round).

**v2 → v3, why it changed**: v2's widgets were structurally correct
(real computed data, real motion) but read as flat and generic —
direct feedback was that the visual execution didn't match the ask
("designs, motion... premium feel") and was a much cruder abstraction
of the real product than it needed to be. PR #1011 (two review rounds,
both clean before merge) closed that gap two ways: (1) **fidelity to
the real pages, verified line-by-line, not approximated** — pulled the
actual axis labels/legend/array order from `RiskMatrixView.tsx`'s
`LABEL_KEYS[5]`, the actual dark-mode-contrast-corrected cell opacities
from that same file's `getRiskCellClass` (a fix quality-bar-loop rounds
10-12 specifically tuned — the first widget pass missed it and shipped
the pre-fix flat values), and the actual node/edge opacities + category-
color ring styling + a genuine `computePageRank` result from
`RiskGraphPage.tsx`, not a fabricated "PR:100"; (2) **depth and a
signature element**: the section background reuses `HeroSection`'s own
grid+radial-glow treatment for visual continuity with the hero, each
card gets a gradient-glow border in its own dominant accent color, and
a decorative connector rail above the three cards (three animated nodes
labeled "Plots risk" / "Correlates it" / "Triggers alert") literalizes
the "one data model underlies every module" claim `FeaturesSection`
already makes in copy — a real narrative device, not decoration for its
own sake. Also fixed a live-caught mobile truncation bug (`truncate`
clipped "Catastrophic" mid-word with no way to recover it on a touch
device — switched to word-wrap).

**Not done — remaining Phase E scope** (as of PR #1011): "interactive
demos" beyond scroll-triggered animation (no click-to-explore yet) and
using `RiskMatrixPreview`'s dedicated mock dataset for anything beyond
what `RiskMatrixWidget` already derives from the same underlying
fixture. Both were addressed in the follow-up 11-PR overhaul below.

## Phase E, round two: full landing-page overhaul (PRs #1013–#1023)

Direct user feedback after the round-one demo section shipped: the
static "See it in action" widgets weren't the "designs, motion, demos"
the initiative had earlier explored, and several real product moments
(interactive demos, a signature "one data model" interaction) hadn't
made it into the actual page. A synthesized plan (external review +
this project's own design-exploration findings, revised twice against
follow-up feedback — see the plan's own v1→v2→v3 changelog for detail)
became this second build pass, sequenced as 11 small, independently
revertable PRs:

| PR | What shipped | Real bug/gap caught during review |
|---|---|---|
| [#1013](https://github.com/Qiyrix/aexa-frontend/pull/1013) | Hero motion polish (bounded stagger + one count-up) + new `CredibilityBand` (real, checkable stats — no fabricated usage metrics) | `useCountUp` froze mid-animation under React StrictMode's dev-mode double-effect-invocation (a 92% target stuck at 6%) — root-caused and fixed at the hook level, not worked around |
| [#1014](https://github.com/Qiyrix/aexa-frontend/pull/1014) | KRI threshold slider demo, porting `compute_kri_status` verbatim from aexa-server | — |
| [#1015](https://github.com/Qiyrix/aexa-frontend/pull/1015) | Copy fix: replaced defensive "Real analysis, not a screenshot" framing (argued against an objection nobody raised) with copy that leads with the interaction itself | — |
| [#1016](https://github.com/Qiyrix/aexa-frontend/pull/1016) | Extracted `RiskMatrixView`'s pure calc functions into shared `riskMatrixCalc.ts`; built the clickable `LandingRiskMatrixWidget` on that same layer; added a reusable `DemoTabs` component (grid-stacked crossfade, `inert` on the inactive panel) | The widget passed the display-flipped grid row straight to `getMatrixColor`, inverting the color ramp on the likelihood axis (a real critical risk rendered as `bg-risk-high`) — caught, root-caused, fixed with a negative-control-verified regression test |
| [#1017](https://github.com/Qiyrix/aexa-frontend/pull/1017) | Role-scoped register demo (Admin/Lead Auditor/Light User), gated by the real, unmodified `canWriteOrgResource` | Missing ARIA APG arrow-key navigation on the role radiogroup; an inconsistent French translation for "Light User" | 
| [#1018](https://github.com/Qiyrix/aexa-frontend/pull/1018) | Connector-line motion on the `HeroFeatures` "how it works" band (horizontal rail desktop, vertical rail mobile) | — |
| [#1019](https://github.com/Qiyrix/aexa-frontend/pull/1019) | Rebuilt `FeaturesSection`'s module showcase with 4 real UI crops sourced from a dedicated research pass (`AllFindingsPage`'s overdue treatment, `AuditPage`'s engagement cards, the Compliance Scorecard heatmap, `AlertsPage`'s severity chips) | The 4 crops rendered fabricated illustrative content with no `aria-hidden` — a screen reader would announce it as real page data |
| [#1020](https://github.com/Qiyrix/aexa-frontend/pull/1020) | Authored `MOCK_AUDIT_FINDINGS`/`MOCK_MITIGATIONS` — real fields on real types (`AuditFinding.linked_risk_id`, `Mitigation.risk_id`) that had zero populated mock rows anywhere in the codebase, linked to the same hub risk (`CYB-014`/`risk-1`) the rest of the page already uses | — |
| [#1021](https://github.com/Qiyrix/aexa-frontend/pull/1021) | The Connected Data Model interaction — the signature piece. One risk, shown simultaneously as a register row, a KRI, an audit finding, and a mitigation; clicking any of the 5 cards highlights all 5 at once | `aria-pressed` misused on 5 buttons sharing one boolean (two of three independent review angles caught this); no hover affordance on any of the 5 cards; the SVG fan-out geometry rendered too flat under `preserveAspectRatio="none"`'s non-uniform scale; the "one data model" claim was duplicated verbatim across two adjacent sections' copy |
| [#1022](https://github.com/Qiyrix/aexa-frontend/pull/1022) | New `FinalCTASection` | A pre-existing mismatch caught while duplicating `HeroSection`'s modal-flow handler: the Contact Sales button's label had been corrected in an earlier pass, but its `mailto` subject/body still said "Demo Request" |
| [#1023](https://github.com/Qiyrix/aexa-frontend/pull/1023) | Closing pass: audited all `home.*` copy for hype adjectives/exclamation points (clean, no changes needed); closed 3 pre-existing `motion-reduce` gaps in `HeroSection`/`FeaturesSection`; added a `border-t` to break up 3 consecutive same-background sections | — |

Every PR in this sequence went through this initiative's established
review discipline: self-QA gate (typecheck/lint/full suite), live
browser verification (not just unit tests), then 1-3 independent review
agents per PR (scaled to risk — 3 angles for #1021, the highest-risk
PR in the sequence), with a verified fix round before merge whenever a
review surfaced a real finding. Every real risk/KRI/finding/mitigation
shown across all 11 PRs traces back to the same shared mock fixtures
(`riskMatrixMockData.ts` / `overviewMockData.ts` / the new PR #1020
file) — no page in this sequence fabricates its own disconnected mock
data.

## How to revert this whole initiative

Because each phase is its own PR, reverting everything is reverting each
phase's merge commit in reverse phase order (F, then E, ... then A). There
is no shared migration or schema change anything else depends on — the
design-token layer was never touched, so a full revert leaves the app
exactly where it was before this initiative started.
