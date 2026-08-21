// PREVIEW-PROTO safety net. RiskMatrixPreview.tsx (and any future page built
// on the same "presentational component fed static mock data, mounted on an
// unauthenticated route" pattern) has no authentication boundary of its own
// -- the whole point is that it renders without a live RTK Query call. That
// means nothing today would stop a future engineer from copying this
// pattern for another page and accidentally wiring a real hook instead of
// mock data: the component would compile and look identical, and only leak
// live data once actually deployed to production.
//
// This is a cheap runtime tripwire, not a feature-flag system: call it once
// at the top of a preview entry point. In dev it throws immediately (fail
// loud, fail fast, catch the mistake before it ever reaches a real build).
// In a production build it can't safely throw -- that would turn a
// leftover preview route into a hard crash for any real visitor who hits
// it -- so it only console.errors loudly, UNLESS the explicit
// VITE_ENABLE_PREVIEW_ROUTES opt-in flag is set, which is the one legitimate
// reason a preview route would still be reachable in a production build.
export function assertPreviewOnly(componentName: string): void {
  const message = `assertPreviewOnly: ${componentName} is a preview-only component (renders mock data, not live API results) but is mounted in a PRODUCTION build without VITE_ENABLE_PREVIEW_ROUTES="true" set. This almost certainly means a throwaway preview route shipped by accident -- remove it, or set the opt-in flag if this is intentional.`

  // DEV and PROD are mutually exclusive in Vite (DEV === !PROD), so this
  // must be its own top-level check, not a branch reached only after an
  // `isProd`-gated early return -- an earlier version of this guard
  // returned immediately whenever `!isProd`, which meant the "throw in
  // dev" branch below it was unreachable in every real build mode (found
  // by an independent review of this PR). Dev never needs the opt-in
  // exception either -- a dev build is never what a real visitor hits.
  if (import.meta.env.DEV) {
    throw new Error(message)
  }

  const previewRoutesExplicitlyEnabled =
    import.meta.env.VITE_ENABLE_PREVIEW_ROUTES === "true"
  if (previewRoutesExplicitlyEnabled) return

  console.error(message)
}
