/**
 * Local fallback placeholder used when an inspection media `<img>` fails to
 * load (e.g. a stale/expired media URL). Rendered as an inline SVG data URI
 * so it never depends on a network request (unlike the third-party
 * via.placeholder.com service this replaces) or a static asset that could go
 * missing from `public/`.
 */
export const PLACEHOLDER_IMAGE_SRC =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" fill="none">` +
      `<rect width="56" height="56" fill="#E5E7EB"/>` +
      `<path d="M16 38L23.5 28L29 34.5L34 28L40 38H16Z" fill="#9CA3AF"/>` +
      `<circle cx="21" cy="21" r="3.5" fill="#9CA3AF"/>` +
      `<rect x="10" y="10" width="36" height="36" rx="2" stroke="#9CA3AF" stroke-width="2"/>` +
      `</svg>`,
  )
