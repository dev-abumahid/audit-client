// Mirrors the backend's httpUrl Zod refinement (aexa-server's
// inspection.validation.ts/action.validation.ts): rejects javascript:/data:
// and any other non-http(s) scheme. Used as a render-time guard for
// user-supplied URL-shaped values (question answers, media file URLs)
// before they reach a dangerous sink (href/src/window.open) — a defense
// against any value that predates the backend schema fix, or a value
// stored via a different path that didn't go through it.
export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false
  return /^https?:\/\//i.test(value)
}
