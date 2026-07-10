#!/usr/bin/env node
/**
 * Frontend-URL <-> server-route contract check.
 *
 * Statically parses aexa-server's route definitions (no server boot required)
 * and cross-checks them against every URL the frontend calls, in both its
 * RTK Query layer (src/redux/apis/), its legacy fetch wrapper
 * (api.get/post/patch/delete(...) calls anywhere under src/), and raw
 * fetch(...) calls with a template-literal URL anywhere under src/.
 *
 * Direction is frontend -> server ONLY: a server route with no frontend
 * caller is not flagged (it may be internal/AI-only/not yet wired up).
 * A frontend URL with no matching server route IS flagged -- that's a real
 * seam bug (dead code, typo, or a route that got renamed/removed server-side
 * without the frontend being updated).
 *
 * NOTE ON NOISE: this check is intentionally NOT a required PR gate (see
 * .github/workflows/route-contract-check.yml) precisely because in-flight
 * branches on either repo can transiently disagree (e.g. a frontend PR
 * adding a call to a not-yet-merged server route, or vice versa). No
 * suppression/allowlist tooling is built for that -- it runs on a schedule
 * instead of blocking every PR, which keeps false positives out of the
 * critical path at the cost of some staleness between runs.
 *
 * Usage:
 *   npx tsx scripts/check-route-contract.ts [aexaServerPath]
 *
 * The aexa-server checkout path can also be provided via the
 * AEXA_SERVER_PATH env var. Defaults to ../aexa-server (relative to this
 * repo), which matches how the repos are laid out on the local dev machine.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs"
import { join, relative, dirname, extname } from "node:path"
import { fileURLToPath } from "node:url"

import {
  parseRoutesIndex,
  parseRouteFile,
  parseRtkQueryFile,
  parseLegacyApiFile,
  parseFetchCallFile,
  buildServerPath,
  findMissingRoutes,
  type ServerRoute,
  type FrontendCall,
} from "./route-contract/extract.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = join(__dirname, "..")

function resolveServerPath(): string {
  const fromArg = process.argv[2]
  const fromEnv = process.env.AEXA_SERVER_PATH
  const candidate =
    fromArg ?? fromEnv ?? join(FRONTEND_ROOT, "..", "aexa-server")
  if (!existsSync(candidate)) {
    console.error(`aexa-server checkout not found at: ${candidate}`)
    console.error(
      "Pass a path as the first CLI arg, set AEXA_SERVER_PATH, or check out " +
        "aexa-server as a sibling directory of aexa-frontend."
    )
    process.exit(2)
  }
  return candidate
}

function collectServerRoutes(serverRoot: string): ServerRoute[] {
  const routesIndexPath = join(serverRoot, "src", "routes.ts")
  if (!existsSync(routesIndexPath)) {
    console.error(
      `Could not find ${routesIndexPath} -- has aexa-server's layout changed?`
    )
    process.exit(2)
  }
  const routesIndexSource = readFileSync(routesIndexPath, "utf-8")
  const moduleEntries = parseRoutesIndex(routesIndexSource)

  if (moduleEntries.length === 0) {
    console.error(
      "Parsed 0 entries out of routes.ts moduleRoutes array -- the extraction regex likely " +
        "no longer matches the actual file structure. Aborting rather than silently reporting a false pass."
    )
    process.exit(2)
  }

  const serverRoutes: ServerRoute[] = []
  for (const entry of moduleEntries) {
    // import path is like './app/modules/note/note.route.js' -- resolve
    // relative to src/, and swap .js -> .ts since we're reading source.
    const relImportPath = entry.importPath.replace(/\.js$/, ".ts")
    const routeFilePath = join(serverRoot, "src", relImportPath)
    if (!existsSync(routeFilePath)) {
      console.error(
        `WARN: resolved route file does not exist, skipping: ${routeFilePath}`
      )
      continue
    }
    const routeSource = readFileSync(routeFilePath, "utf-8")
    const calls = parseRouteFile(routeSource)
    for (const call of calls) {
      serverRoutes.push({
        method: call.method,
        path: buildServerPath(entry.prefix, call.path),
      })
    }
  }
  return serverRoutes
}

const TEST_FILE_RE = /\.(test|spec)\.[tj]sx?$/

/**
 * Recursively list files under `dir` (relative to `root`) with one of
 * `extensions`. Skips test/spec files -- those contain fixture URLs
 * (e.g. "/api/test") that are never real server routes and would otherwise
 * show up as permanent false-positive MISSING entries.
 */
function walkFiles(root: string, dir: string, extensions: string[]): string[] {
  const absDir = join(root, dir)
  let entries: import("node:fs").Dirent[]
  try {
    entries = readdirSync(absDir, { withFileTypes: true })
  } catch {
    return []
  }
  const results: string[] = []
  for (const entry of entries) {
    const relPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkFiles(root, relPath, extensions))
    } else if (
      extensions.includes(extname(entry.name)) &&
      !TEST_FILE_RE.test(entry.name)
    ) {
      results.push(relPath)
    }
  }
  return results
}

function collectFrontendCalls(frontendRoot: string): FrontendCall[] {
  const calls: FrontendCall[] = []

  const rtkFiles = walkFiles(frontendRoot, join("src", "redux", "apis"), [
    ".ts",
  ])
  for (const relFile of rtkFiles) {
    const absFile = join(frontendRoot, relFile)
    const source = readFileSync(absFile, "utf-8")
    calls.push(...parseRtkQueryFile(source, relFile))
  }

  const legacyFiles = walkFiles(frontendRoot, "src", [".ts", ".tsx"])
  for (const relFile of legacyFiles) {
    const absFile = join(frontendRoot, relFile)
    const source = readFileSync(absFile, "utf-8")
    calls.push(...parseLegacyApiFile(source, relFile))
    calls.push(...parseFetchCallFile(source, relFile))
  }

  return calls
}

function main() {
  const serverRoot = resolveServerPath()
  const serverRoutes = collectServerRoutes(serverRoot)
  const frontendCalls = collectFrontendCalls(FRONTEND_ROOT)

  console.log(
    `Parsed ${serverRoutes.length} server routes from ${relative(process.cwd(), serverRoot) || serverRoot}`
  )
  console.log(
    `Parsed ${frontendCalls.length} frontend URL call sites from this repo`
  )

  if (serverRoutes.length === 0 || frontendCalls.length === 0) {
    console.error(
      "One or both extraction passes returned 0 results -- refusing to report success, " +
        "since that likely means the extraction is broken rather than the contract being clean."
    )
    process.exit(2)
  }

  const missing = findMissingRoutes(frontendCalls, serverRoutes)

  if (missing.length === 0) {
    console.log("\nOK: every frontend URL call matches a known server route.")
    process.exit(0)
  }

  const sorted = [...missing].sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file)
    return a.line - b.line
  })

  console.log("")
  for (const m of sorted) {
    console.log(
      `MISSING: ${m.method.toUpperCase()} ${m.path}  (frontend: ${m.file}:${m.line})`
    )
  }
  console.log(
    `\n${sorted.length} frontend URL(s) have no matching server route.`
  )
  process.exit(1)
}

main()
