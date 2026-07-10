/**
 * Pure extraction/normalization logic for the frontend<->server route contract check.
 *
 * Deliberately has ZERO filesystem access so it can be unit tested with inline
 * fixture strings. All file reading lives in check-route-contract.ts.
 */

export interface ServerRoute {
  method: string // lowercase: get|post|patch|put|delete
  path: string // normalized, e.g. /api/note/:param
}

export interface FrontendCall {
  method: string // lowercase
  path: string // normalized, e.g. /api/note/:param
  file: string
  line: number
}

/**
 * Strip `//` line comments and `/* *\/` block comments from source text
 * before running extraction regexes over it, so a commented-out route or
 * call (a common transitional pattern, e.g. while migrating an endpoint)
 * isn't parsed identically to live code.
 *
 * This is a lightweight, string-literal-unaware pass -- it does not try to
 * distinguish "//" inside a string/template literal from a real comment.
 * That's an acceptable tradeoff here: none of the URL/route strings this
 * script parses legitimately contain "//" or "/*", so the risk of
 * accidentally treating literal content as a comment is negligible in
 * practice, and it keeps the implementation simple.
 */
export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
}

/**
 * Normalize a path for comparison:
 * - strip query string / hash fragment
 * - collapse `:paramName` style dynamic segments to `:param`
 * - collapse double slashes
 * - strip trailing slash (except for root `/`)
 */
export function normalizePath(rawPath: string): string {
  let path = rawPath.split("?")[0].split("#")[0]
  path = path.replace(/:[A-Za-z0-9_]+/g, ":param")
  path = path.replace(/\/{2,}/g, "/")
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1)
  }
  return path
}

/**
 * Given the contents of aexa-server's src/routes.ts, extract a map of
 * router import identifier -> { prefix, importPath }.
 *
 * Handles the `moduleRoutes` array of `{ path: '<prefix>', route: <identifier> }`
 * entries, resolving each `<identifier>` back to the module it was imported from.
 */
export interface ModuleRouteEntry {
  prefix: string
  importPath: string
}

export function parseRoutesIndex(source: string): ModuleRouteEntry[] {
  const cleanSource = stripComments(source)
  // Map import identifier -> import path, e.g. noteRoute -> ./app/modules/note/note.route.js
  const importMap = new Map<string, string>()
  const importRegex = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = importRegex.exec(cleanSource)) !== null) {
    importMap.set(m[1], m[2])
  }

  // Find the moduleRoutes array body.
  const arrayMatch = cleanSource.match(/moduleRoutes\s*=\s*\[([\s\S]*?)\]/)
  if (!arrayMatch) return []
  const arrayBody = arrayMatch[1]

  const entryRegex =
    /\{\s*path:\s*['"]([^'"]*)['"]\s*,\s*route:\s*(\w+)\s*,?\s*\}/g
  const entries: ModuleRouteEntry[] = []
  while ((m = entryRegex.exec(arrayBody)) !== null) {
    const [, prefix, identifier] = m
    const importPath = importMap.get(identifier)
    if (importPath) {
      entries.push({ prefix, importPath })
    }
  }
  return entries
}

const HTTP_METHODS = ["get", "post", "patch", "put", "delete"] as const

/**
 * Given the contents of a `*.route.ts` file, extract `router.METHOD('path', ...)`
 * calls. Handles both single-line and multi-line call patterns.
 */
export function parseRouteFile(
  source: string
): Array<{ method: string; path: string }> {
  const cleanSource = stripComments(source)
  const results: Array<{ method: string; path: string }> = []
  const callRegex = new RegExp(
    `\\.(${HTTP_METHODS.join("|")})\\(\\s*['"]([^'"]*)['"]`,
    "g"
  )
  let m: RegExpExecArray | null
  while ((m = callRegex.exec(cleanSource)) !== null) {
    results.push({ method: m[1], path: m[2] })
  }
  return results
}

/**
 * Combine a module prefix + a route's own path into a full server route path,
 * prefixed with /api. Root path '/' collapses to just the prefix.
 */
export function buildServerPath(prefix: string, routePath: string): string {
  const combined =
    routePath === "/" ? `/api${prefix}` : `/api${prefix}${routePath}`
  return normalizePath(combined)
}

/** 1-based line number of the character at `index` within `source`. */
export function lineNumberAt(source: string, index: number): number {
  return source.slice(0, index).split("\n").length
}

/**
 * Look ahead from `startIndex` for a `method: "X"` field, but stop the
 * search at the start of the NEXT sibling endpoint (the next `url:` or
 * `query:` occurrence after `startIndex`) rather than a fixed character
 * count. This prevents a `method:` field belonging to a different, nearby
 * endpoint from bleeding into this one when two endpoints are close
 * together (e.g. one that omits `method:` immediately followed by one that
 * specifies `method: "DELETE"` a few dozen characters later).
 *
 * Falls back to a generous fixed-size window if no next-boundary marker is
 * found (e.g. this is the last endpoint in the file), so we don't scan the
 * entire remainder of a large file.
 */
export function findMethodNear(source: string, startIndex: number): string {
  const FALLBACK_WINDOW = 300
  const boundaryRegex = /\b(?:url|query)\s*:/g
  boundaryRegex.lastIndex = startIndex + 1
  const nextBoundaryMatch = boundaryRegex.exec(source)
  const windowEnd = nextBoundaryMatch
    ? nextBoundaryMatch.index
    : Math.min(source.length, startIndex + FALLBACK_WINDOW)

  const lookahead = source.slice(startIndex, windowEnd)
  const methodMatch = lookahead.match(/method:\s*['"](\w+)['"]/)
  return (methodMatch ? methodMatch[1] : "get").toLowerCase()
}

/**
 * Extract RTK Query endpoint definitions from an apis/**\/*.ts file.
 *
 * Looks for `url:` and the nearest following `method:` inside the same
 * object literal (the `query: (...) => ({ url: ..., method: ... })` shape
 * used throughout src/redux/apis). If no explicit `method:` is present,
 * RTK Query defaults to GET.
 *
 * IMPORTANT FOOTGUN: baseApi's baseUrl is VITE_SERVER_BASE_URL, which does
 * NOT include the `/api` prefix (unlike the legacy src/lib/api.ts client,
 * whose paths already start with /api literally). So every RTK Query url
 * extracted here must have `/api` prepended before comparing against server
 * routes -- otherwise everything would spuriously report as MISSING.
 *
 * GUARD: if a url already starts with `/api` (e.g. a copy-paste mistake
 * from the legacy api.ts pattern), do NOT double-prepend it -- that would
 * produce a malformed `/api/api/...` path that silently reports as a
 * misleading false-positive MISSING instead of surfacing the real bug (the
 * frontend url itself being wrong). We use the url as-is in that case.
 */
export function parseRtkQueryFile(
  source: string,
  file: string
): FrontendCall[] {
  const cleanSource = stripComments(source)
  const results: FrontendCall[] = []
  // Match a `url: <template-or-string>` followed (within a bounded window,
  // see findMethodNear) by an optional `method: "X"`.
  const urlRegex = /url:\s*(?:`([^`]*)`|'([^']*)'|"([^"]*)")/g
  let m: RegExpExecArray | null
  while ((m = urlRegex.exec(cleanSource)) !== null) {
    const rawUrl = m[1] ?? m[2] ?? m[3] ?? ""
    const line = lineNumberAt(cleanSource, m.index)
    const method = findMethodNear(cleanSource, m.index)

    const strippedUrl = stripInterpolations(rawUrl)
    const normalized = normalizePath(
      strippedUrl.startsWith("/api") ? strippedUrl : `/api${strippedUrl}`
    )
    results.push({ method, path: normalized, file, line })
  }
  return results
}

/**
 * Extract legacy `api.get/post/patch/delete('/api/...')` calls from a
 * src/**\/*.{ts,tsx} file. These URLs already include the literal `/api`
 * prefix, so it is NOT prepended again.
 */
export function parseLegacyApiFile(
  source: string,
  file: string
): FrontendCall[] {
  const cleanSource = stripComments(source)
  const results: FrontendCall[] = []
  const callRegex = new RegExp(
    `api\\.(${HTTP_METHODS.join("|")})(?:<[^>(]*>)?\\(\\s*(?:\`([^\`]*)\`|'([^']*)'|"([^"]*)")`,
    "g"
  )
  let m: RegExpExecArray | null
  while ((m = callRegex.exec(cleanSource)) !== null) {
    const method = m[1].toLowerCase()
    const rawUrl = m[2] ?? m[3] ?? m[4] ?? ""
    const line = lineNumberAt(cleanSource, m.index)
    const strippedUrl = stripInterpolations(rawUrl)
    const normalized = normalizePath(strippedUrl)
    results.push({ method, path: normalized, file, line })
  }
  return results
}

/** Replace `${...}` template interpolations with `:param`. */
export function stripInterpolations(url: string): string {
  return url.replace(/\$\{[^}]*\}/g, ":param")
}

/**
 * Strip a leading `${BASE_URL}`-style interpolation (a base-URL variable,
 * not a route param) from a template-literal URL, then delegate to
 * stripInterpolations for any remaining (genuine route-param) interpolations.
 *
 * e.g. `${BASE_URL}/api/note/${id}` -> `/api/note/:param`
 * (the leading interpolation contributes nothing to the path, so it is
 * dropped rather than turned into a `:param` segment.)
 */
export function stripBaseUrlPrefix(url: string): string {
  const withoutBase = url.replace(/^\$\{[^}]*\}/, "")
  return stripInterpolations(withoutBase)
}

/**
 * Extract raw `fetch(...)` calls from a src/**\/*.{ts,tsx} file, e.g.
 * `fetch(\`${BASE_URL}/api/action/attachment\`, { method: "POST", ... })`.
 *
 * Handles both single-line and multi-line calls. These URLs are template
 * literals prefixed with a base-URL variable interpolation (which is
 * dropped, not treated as a route param) followed by a literal `/api/...`
 * path that may itself contain further `${...}` route-param interpolations.
 *
 * Only template-literal fetch() calls with a leading `${...}` interpolation
 * are matched -- plain string-literal fetch('/foo') calls are rare in this
 * codebase and would need a separate pattern; template literals are the
 * only form observed in production code so far.
 */
export function parseFetchCallFile(
  source: string,
  file: string
): FrontendCall[] {
  const cleanSource = stripComments(source)
  const results: FrontendCall[] = []
  const callRegex = /fetch\(\s*`(\$\{[^}]*\}[^`]*)`/g
  let m: RegExpExecArray | null
  while ((m = callRegex.exec(cleanSource)) !== null) {
    const rawUrl = m[1]
    const line = lineNumberAt(cleanSource, m.index)

    const strippedUrl = stripBaseUrlPrefix(rawUrl)
    const normalized = normalizePath(strippedUrl)

    // Skip calls whose entire path is itself a dynamic interpolation with no
    // literal route text (e.g. a generic `fetch(\`${BASE_URL}${path}\`, ...)`
    // wrapper helper, as seen in src/lib/api.ts). Those aren't call sites for
    // a specific endpoint -- the actual endpoint URLs passed into such a
    // helper are matched separately (e.g. via parseLegacyApiFile). A real
    // route always has literal /api/... text, so require that prefix here.
    if (!normalized.startsWith("/api/") && normalized !== "/api") {
      continue
    }

    // fetch() defaults to GET when no method is specified, same as RTK
    // Query's query object.
    const method = findMethodNear(cleanSource, m.index)

    results.push({ method, path: normalized, file, line })
  }
  return results
}

/**
 * Check every frontend call against the set of known server routes.
 * Returns the list of calls that have no matching server route.
 */
export function findMissingRoutes(
  frontendCalls: FrontendCall[],
  serverRoutes: ServerRoute[]
): FrontendCall[] {
  const serverSet = new Set(serverRoutes.map((r) => `${r.method} ${r.path}`))
  return frontendCalls.filter((c) => !serverSet.has(`${c.method} ${c.path}`))
}
