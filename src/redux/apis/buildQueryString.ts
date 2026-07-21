// Shared query-string builder for RTK Query `query` functions.
//
// Several org API modules (risk, inspection, template, sites, findings)
// build list-endpoint URLs from user-typed input (searchTerm, siteId,
// category, status). Interpolating those values straight into a template
// string is unsafe: an `&`, `=`, or `#` in the search text silently
// truncates/reshapes the query string, and it's an unencoded-input
// footgun in general. URLSearchParams encodes every value correctly and
// drops undefined/empty keys instead of sending literal "undefined".
export const buildQueryString = (
  params: Record<string, string | number | undefined>
): string => {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    searchParams.set(key, String(value))
  }
  return searchParams.toString()
}
