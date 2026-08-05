import React from "react"

// The Risk Graph: six signal nodes converge through a dashed oversight ring
// onto one resolved center point. Replaces the earlier shield+checkmark
// placeholder with the real brand mark (handoff: qiyrix-brand-spec.md).
//
// Colored via the --logo-primary/--logo-ring/--logo-accent/--logo-accent-ring
// custom properties defined in index.css's :root/.dark blocks -- NOT via the
// handoff SVG's own internal `@media (prefers-color-scheme: dark)` block.
// This app's dark mode is a manual .dark class on <html> (theme-provider.tsx),
// not just the OS media query, so wiring the mark into the same token
// convention every other color in this app already uses is what makes it
// actually follow the in-app light/dark toggle. The standalone favicon.svg
// keeps the handoff's original self-theming version instead, since a
// favicon can only ever respond to the OS/browser's own preference anyway.
//
// Do not recolor individual parts independently of these four tokens, add
// opacity back onto any stroke, or re-space the six nodes to a perfect 60°
// grid -- three are deliberately offset (see qiyrix-brand-spec.md).
const Logo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="10 8 124 124"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    {...props}
  >
    <circle
      cx="72"
      cy="70"
      r="30"
      fill="none"
      stroke="var(--logo-ring)"
      strokeWidth="3.5"
      strokeDasharray="9 6"
    />

    <g stroke="var(--logo-primary)" strokeWidth="3.6">
      <line x1="72" y1="18" x2="72" y2="70" />
      <line x1="120.86" y1="52.21" x2="72" y2="70" />
      <line x1="117" y1="96" x2="72" y2="70" />
      <line x1="80.13" y1="121.36" x2="72" y2="70" />
      <line x1="27" y1="96" x2="72" y2="70" />
      <line x1="32.76" y1="35.88" x2="72" y2="70" />
    </g>

    <g fill="var(--logo-primary)">
      <circle cx="72" cy="18" r="6.5" />
      <circle cx="120.86" cy="52.21" r="6" />
      <circle cx="117" cy="96" r="7" />
      <circle cx="80.13" cy="121.36" r="6.5" />
      <circle cx="27" cy="96" r="6" />
      <circle cx="32.76" cy="35.88" r="7" />
    </g>

    <circle
      cx="72"
      cy="70"
      r="17"
      fill="none"
      stroke="var(--logo-accent-ring)"
      strokeWidth="3"
    />
    <circle cx="72" cy="70" r="10.5" fill="var(--logo-accent)" />
  </svg>
)

export default Logo
