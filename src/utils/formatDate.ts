/**
 * Locale-aware date formatting, matching the app's only two supported UI
 * languages (English/French, see src/i18n/locales). Formats with the
 * French locale when `i18n.language` starts with "fr", English otherwise --
 * the same ternary already established at
 * TeamMembersTab.tsx:349 before this helper existed, now shared instead of
 * repeated (and instead of several call sites hardcoding "en-US"
 * unconditionally or omitting a locale argument, which silently formats
 * dates in the visiting browser's locale rather than the app's selected
 * language -- aexa-frontend round-3 audit bugs #3/#4).
 *
 * `options` is passed straight through to `Date.prototype.toLocaleDateString`
 * so existing call sites' format options (month: "long"/"short", etc.) carry
 * over unchanged.
 */
export function formatLocaleDate(
  date: Date | string | number,
  language: string | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  const locale = language?.startsWith("fr") ? "fr-FR" : "en-US"
  const d = date instanceof Date ? date : new Date(date)
  return d.toLocaleDateString(locale, options)
}
