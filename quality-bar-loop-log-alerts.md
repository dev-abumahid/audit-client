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
