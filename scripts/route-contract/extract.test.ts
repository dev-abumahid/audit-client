import { describe, it, expect } from "vitest"
import {
  normalizePath,
  parseRoutesIndex,
  parseRouteFile,
  buildServerPath,
  parseRtkQueryFile,
  parseLegacyApiFile,
  parseFetchCallFile,
  stripInterpolations,
  stripBaseUrlPrefix,
  stripComments,
  lineNumberAt,
  findMethodNear,
  findMissingRoutes,
} from "./extract"

describe("normalizePath", () => {
  it("collapses named dynamic segments to :param", () => {
    expect(normalizePath("/api/note/:id")).toBe("/api/note/:param")
    expect(normalizePath("/api/recommendation/:recommendationId")).toBe(
      "/api/recommendation/:param"
    )
  })

  it("strips query strings", () => {
    expect(normalizePath("/api/site?page=1&limit=10")).toBe("/api/site")
  })

  it("strips hash fragments", () => {
    expect(normalizePath("/api/site#section")).toBe("/api/site")
  })

  it("collapses double slashes", () => {
    expect(normalizePath("/api//note")).toBe("/api/note")
  })

  it("strips trailing slash but keeps root", () => {
    expect(normalizePath("/api/note/")).toBe("/api/note")
    expect(normalizePath("/")).toBe("/")
  })
})

describe("stripInterpolations", () => {
  it("replaces template interpolations with :param", () => {
    expect(stripInterpolations("/note/${id}")).toBe("/note/:param")
    expect(stripInterpolations("/action?page=${page}&limit=${limit}")).toBe(
      "/action?page=:param&limit=:param"
    )
  })

  it("leaves plain strings untouched", () => {
    expect(stripInterpolations("/note/save-raw-note")).toBe(
      "/note/save-raw-note"
    )
  })
})

describe("parseRoutesIndex", () => {
  it("resolves moduleRoutes entries back to their import paths", () => {
    const source = `
import { Router } from 'express';
import accountRouter from './app/modules/account/account.route.js';
import noteRoute from './app/modules/note/note.route.js';

const appRouter = Router();

const moduleRoutes = [
  { path: '/note', route: noteRoute },
  { path: '/auth', route: accountRouter },
];

moduleRoutes.forEach((route) => appRouter.use(route.path, route.route));
export default appRouter;
`
    const entries = parseRoutesIndex(source)
    expect(entries).toEqual([
      { prefix: "/note", importPath: "./app/modules/note/note.route.js" },
      { prefix: "/auth", importPath: "./app/modules/account/account.route.js" },
    ])
  })

  it("returns an empty array when there is no moduleRoutes array", () => {
    expect(parseRoutesIndex("export default 1;")).toEqual([])
  })

  it("tolerates a trailing comma before the closing brace (Prettier multi-line reformat)", () => {
    // Prettier will reformat `{ path: '/note', route: noteRoute }` onto
    // multiple lines with a trailing comma when the array itself wraps,
    // e.g.:
    //   const moduleRoutes = [
    //     {
    //       path: '/note',
    //       route: noteRoute,
    //     },
    //   ];
    const source = `
import noteRoute from './app/modules/note/note.route.js';

const moduleRoutes = [
  {
    path: '/note',
    route: noteRoute,
  },
];
`
    expect(parseRoutesIndex(source)).toEqual([
      { prefix: "/note", importPath: "./app/modules/note/note.route.js" },
    ])
  })
})

describe("stripComments", () => {
  it("strips // line comments", () => {
    const source = `router.get('/', controller.list); // TODO: remove\nconst x = 1;`
    expect(stripComments(source)).toBe(
      `router.get('/', controller.list); \nconst x = 1;`
    )
  })

  it("strips /* */ block comments, including multi-line ones", () => {
    const source = `/*\n * old route, replaced by v2\n */\nrouter.get('/legacy', controller.legacy);`
    expect(stripComments(source)).toBe(
      "\nrouter.get('/legacy', controller.legacy);"
    )
  })

  it("strips an entire commented-out line so it contributes no matches", () => {
    const source = `// router.delete('/:id', auth('ORGANIZATION'), controller.remove);\nrouter.get('/', controller.list);`
    const cleaned = stripComments(source)
    expect(cleaned).not.toContain("router.delete")
    expect(cleaned).toContain("router.get")
  })
})

describe("lineNumberAt", () => {
  it("returns 1 for the first line", () => {
    expect(lineNumberAt("abc\ndef", 0)).toBe(1)
  })

  it("returns the correct 1-based line for a later index", () => {
    const source = "line1\nline2\nline3"
    expect(lineNumberAt(source, source.indexOf("line3"))).toBe(3)
  })
})

describe("findMethodNear", () => {
  it("finds a method: field within the fallback window when no next boundary exists", () => {
    const source = `url: "/note", method: "POST",`
    expect(findMethodNear(source, 0)).toBe("post")
  })

  it("defaults to get when no method: field is found before the next boundary", () => {
    const source = `url: "/note",\nurl: "/other", method: "POST",`
    expect(findMethodNear(source, 0)).toBe("get")
  })
})

describe("parseRouteFile with comments", () => {
  it("does not extract a commented-out router call", () => {
    const source = `
// router.delete('/:id', auth('ORGANIZATION'), action_controller.delete_action);
router.get('/', auth('ORGANIZATION'), action_controller.get_all_action);
`
    expect(parseRouteFile(source)).toEqual([{ method: "get", path: "/" }])
  })

  it("does not extract a route inside a block comment", () => {
    const source = `
/*
router.post('/', auth('ORGANIZATION'), action_controller.create_action);
*/
router.get('/', auth('ORGANIZATION'), action_controller.get_all_action);
`
    expect(parseRouteFile(source)).toEqual([{ method: "get", path: "/" }])
  })
})

describe("parseRouteFile", () => {
  it("extracts single-line router calls", () => {
    const source = `router.get('/', auth('ORGANIZATION'), controller.list);`
    expect(parseRouteFile(source)).toEqual([{ method: "get", path: "/" }])
  })

  it("extracts multi-line router calls", () => {
    const source = `
router.patch(
  '/:id',
  auth('ORGANIZATION'),
  RequestValidator(validations.update),
  controller.update,
);
`
    expect(parseRouteFile(source)).toEqual([{ method: "patch", path: "/:id" }])
  })

  it("extracts multiple calls across methods", () => {
    const source = `
router.get('/', auth('ORGANIZATION'), controller.list);
router.post('/', auth('ORGANIZATION'), controller.create);
router.get('/:id', auth('ORGANIZATION'), controller.getOne);
router.delete('/:id', auth('ORGANIZATION'), controller.remove);
`
    expect(parseRouteFile(source)).toEqual([
      { method: "get", path: "/" },
      { method: "post", path: "/" },
      { method: "get", path: "/:id" },
      { method: "delete", path: "/:id" },
    ])
  })
})

describe("buildServerPath", () => {
  it("prepends /api and the module prefix", () => {
    expect(buildServerPath("/note", "/save-raw-note")).toBe(
      "/api/note/save-raw-note"
    )
  })

  it("collapses the root path '/' to just the prefix", () => {
    expect(buildServerPath("/site", "/")).toBe("/api/site")
  })

  it("normalizes dynamic segments", () => {
    expect(buildServerPath("/action", "/:id")).toBe("/api/action/:param")
  })
})

describe("parseRtkQueryFile", () => {
  it("extracts url + method and prepends /api (RTK baseUrl footgun)", () => {
    const source = `
const noteApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    saveRawNote: builder.mutation({
      query: (body) => ({
        url: \`/note/save-raw-note\`,
        method: "POST",
        body,
      }),
    }),
  }),
})
`
    const calls = parseRtkQueryFile(
      source,
      "src/redux/apis/organization/note.api.ts"
    )
    expect(calls).toEqual([
      {
        method: "post",
        path: "/api/note/save-raw-note",
        file: "src/redux/apis/organization/note.api.ts",
        line: 6,
      },
    ])
  })

  it("defaults to GET when no method field is present", () => {
    const source = `
const orgUserApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllOrgUsers: builder.query({
      query: (body) => ({
        url: \`/org-user\`,
      }),
    }),
  }),
})
`
    const calls = parseRtkQueryFile(
      source,
      "src/redux/apis/organization/org.user.api.ts"
    )
    expect(calls[0].method).toBe("get")
    expect(calls[0].path).toBe("/api/org-user")
  })

  it("strips template interpolations to :param", () => {
    const source = `
query: (id: string) => ({
  url: \`/note/\${id}\`,
  method: "DELETE",
}),
`
    const calls = parseRtkQueryFile(
      source,
      "src/redux/apis/organization/note.api.ts"
    )
    expect(calls[0].path).toBe("/api/note/:param")
    expect(calls[0].method).toBe("delete")
  })

  it("does not double-prepend /api when the url already starts with /api (copy-paste footgun)", () => {
    // Regression test: a url like "/api/note/create" copy-pasted from the
    // legacy api.ts pattern into an RTK Query endpoint would previously
    // become "/api/api/note/create" after the unconditional /api prepend,
    // silently producing a misleading false-positive MISSING instead of
    // surfacing the real bug (the malformed frontend url itself).
    const source = `
query: () => ({
  url: "/api/note/create",
  method: "POST",
}),
`
    const calls = parseRtkQueryFile(
      source,
      "src/redux/apis/organization/note.api.ts"
    )
    expect(calls[0].path).toBe("/api/note/create")
  })

  it("does not let a nearby sibling endpoint's method: bleed into an endpoint that omits it", () => {
    // Regression test: two adjacent endpoints where the first has no
    // `method:` field (implicit GET) and the second specifies
    // `method: "DELETE"` only ~70 chars later. A fixed-size lookahead
    // window previously picked up the second endpoint's DELETE for the
    // first endpoint's GET.
    const source = `
const orgUserApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllOrgUsers: builder.query({
      query: () => ({
        url: \`/org-user\`,
      }),
    }),
    deleteOrgUser: builder.mutation({
      query: (id: string) => ({
        url: \`/org-user/\${id}\`,
        method: "DELETE",
      }),
    }),
  }),
})
`
    const calls = parseRtkQueryFile(
      source,
      "src/redux/apis/organization/org.user.api.ts"
    )
    expect(calls).toEqual([
      {
        method: "get",
        path: "/api/org-user",
        file: "src/redux/apis/organization/org.user.api.ts",
        line: 6,
      },
      {
        method: "delete",
        path: "/api/org-user/:param",
        file: "src/redux/apis/organization/org.user.api.ts",
        line: 11,
      },
    ])
  })
})

describe("parseLegacyApiFile", () => {
  it("extracts api.METHOD(...) calls without re-prepending /api", () => {
    const source = `const data = await api.get<InspectionDetail>(\`/api/inspection/\${id}\`)`
    const calls = parseLegacyApiFile(
      source,
      "src/pages/inspection/RunInspection.tsx"
    )
    expect(calls).toEqual([
      {
        method: "get",
        path: "/api/inspection/:param",
        file: "src/pages/inspection/RunInspection.tsx",
        line: 1,
      },
    ])
  })

  it("handles multi-line calls", () => {
    const source = `
      const updated = await api.patch<Action>(
        \`/api/action/\${editingAction.id}\`,
        {
          ...editForm,
        }
      )
`
    const calls = parseLegacyApiFile(
      source,
      "src/pages/inspection/InspectionActions.tsx"
    )
    expect(calls).toEqual([
      {
        method: "patch",
        path: "/api/action/:param",
        file: "src/pages/inspection/InspectionActions.tsx",
        line: 2,
      },
    ])
  })

  it("handles multiple calls in one file", () => {
    const source = `
await api.post<Action>("/api/action", body)
await api.delete(\`/api/action/\${id}\`)
`
    const calls = parseLegacyApiFile(source, "src/pages/x.tsx")
    expect(calls.map((c) => c.method)).toEqual(["post", "delete"])
    expect(calls.map((c) => c.path)).toEqual([
      "/api/action",
      "/api/action/:param",
    ])
  })

  it("ignores a commented-out api.* call", () => {
    const source = `
// await api.delete(\`/api/action/\${id}\`)
await api.post<Action>("/api/action", body)
`
    const calls = parseLegacyApiFile(source, "src/pages/x.tsx")
    expect(calls).toEqual([
      { method: "post", path: "/api/action", file: "src/pages/x.tsx", line: 3 },
    ])
  })
})

describe("stripBaseUrlPrefix", () => {
  it("drops a leading ${BASE_URL}-style interpolation entirely", () => {
    expect(stripBaseUrlPrefix("${BASE_URL}/api/note/save-raw-note")).toBe(
      "/api/note/save-raw-note"
    )
  })

  it("still strips further route-param interpolations to :param", () => {
    expect(stripBaseUrlPrefix("${BASE_URL}/api/note/${id}")).toBe(
      "/api/note/:param"
    )
  })
})

describe("parseFetchCallFile", () => {
  it("extracts a raw fetch() call with a ${BASE_URL} template literal", () => {
    const source = `
      const res = await fetch(\`\${BASE_URL}/api/action/attachment\`, {
        method: "POST",
        credentials: "include",
        body: form,
      })
`
    const calls = parseFetchCallFile(
      source,
      "src/pages/inspection/InspectionActions.tsx"
    )
    expect(calls).toEqual([
      {
        method: "post",
        path: "/api/action/attachment",
        file: "src/pages/inspection/InspectionActions.tsx",
        line: 2,
      },
    ])
  })

  it("defaults to GET when no method is specified", () => {
    const source = `
    fetch(\`\${BASE_URL}/api/note/by-inspection/\${inspectionId}\`, {
      credentials: "include",
    })
`
    const calls = parseFetchCallFile(
      source,
      "src/pages/inspection/InspectionNote.tsx"
    )
    expect(calls[0].method).toBe("get")
    expect(calls[0].path).toBe("/api/note/by-inspection/:param")
  })

  it("handles a multi-line fetch() call where the URL and init are separate args", () => {
    const source = `
      const extractRes = await fetch(
        \`\${BASE_URL}/api/inspection/split-note-into-inspection/\${inspectionId}\`,
        { method: "POST", credentials: "include" }
      )
`
    const calls = parseFetchCallFile(
      source,
      "src/pages/inspection/InspectionNote.tsx"
    )
    expect(calls).toEqual([
      {
        method: "post",
        path: "/api/inspection/split-note-into-inspection/:param",
        file: "src/pages/inspection/InspectionNote.tsx",
        line: 2,
      },
    ])
  })

  it("ignores a generic fetch() wrapper whose path is entirely dynamic (no literal /api/ text)", () => {
    // Mirrors src/lib/api.ts's `fetch(\`${BASE_URL}${path}\`, ...)` helper --
    // this is not itself a call site for a specific endpoint.
    const source = "const res = await fetch(`${BASE_URL}${path}`, { ...init })"
    expect(parseFetchCallFile(source, "src/lib/api.ts")).toEqual([])
  })

  it("ignores plain string-literal fetch() calls without a leading interpolation", () => {
    const source = 'fetch("/api/note", { method: "GET" })'
    expect(parseFetchCallFile(source, "src/x.ts")).toEqual([])
  })

  it("ignores a commented-out fetch() call", () => {
    const source = `
      // const res = await fetch(\`\${BASE_URL}/api/action/attachment\`, { method: "POST" })
      const other = await fetch(\`\${BASE_URL}/api/note\`, { method: "GET" })
`
    const calls = parseFetchCallFile(source, "src/x.ts")
    expect(calls).toEqual([
      { method: "get", path: "/api/note", file: "src/x.ts", line: 3 },
    ])
  })
})

describe("findMissingRoutes", () => {
  const serverRoutes = [
    { method: "get", path: "/api/note" },
    { method: "post", path: "/api/note/save-raw-note" },
    { method: "delete", path: "/api/note/:param" },
  ]

  it("returns frontend calls with no matching server route", () => {
    const frontendCalls = [
      { method: "get", path: "/api/note", file: "a.ts", line: 1 },
      { method: "get", path: "/api/org-user", file: "b.ts", line: 2 },
    ]
    const missing = findMissingRoutes(frontendCalls, serverRoutes)
    expect(missing).toEqual([
      { method: "get", path: "/api/org-user", file: "b.ts", line: 2 },
    ])
  })

  it("returns an empty array when every call matches", () => {
    const frontendCalls = [
      {
        method: "post",
        path: "/api/note/save-raw-note",
        file: "a.ts",
        line: 1,
      },
      { method: "delete", path: "/api/note/:param", file: "a.ts", line: 2 },
    ]
    expect(findMissingRoutes(frontendCalls, serverRoutes)).toEqual([])
  })

  it("does not flag a server route with no frontend caller (frontend->server direction only)", () => {
    const frontendCalls = [
      { method: "get", path: "/api/note", file: "a.ts", line: 1 },
    ]
    expect(findMissingRoutes(frontendCalls, serverRoutes)).toEqual([])
  })
})
