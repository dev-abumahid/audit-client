import {
  canWriteFinding,
  canWriteInspection,
  deriveAssignmentState,
  resolveViewerVisibleIds,
} from "./assignmentScope"

describe("deriveAssignmentState", () => {
  it("returns everAssigned: false and an empty activeIds set for no rows", () => {
    const state = deriveAssignmentState<{ revokedAt: string | null; id: string }>(
      [],
      (row) => row.id
    )
    expect(state.everAssigned).toBe(false)
    expect(state.activeIds.size).toBe(0)
  })

  it("includes only non-revoked rows in activeIds by default", () => {
    const rows = [
      { id: "a", revokedAt: null },
      { id: "b", revokedAt: "2026-01-01T00:00:00.000Z" },
    ]
    const state = deriveAssignmentState(rows, (row) => row.id)
    expect(state.everAssigned).toBe(true)
    expect([...state.activeIds]).toEqual(["a"])
  })

  it("marks everAssigned true even when every row is revoked", () => {
    const rows = [{ id: "a", revokedAt: "2026-01-01T00:00:00.000Z" }]
    const state = deriveAssignmentState(rows, (row) => row.id)
    expect(state.everAssigned).toBe(true)
    expect(state.activeIds.size).toBe(0)
  })

  it("supports a custom isActive predicate (FindingAssignment's status check)", () => {
    const rows = [
      { id: "a", revokedAt: null, status: "ACTIVE" as const },
      { id: "b", revokedAt: null, status: "PENDING_APPROVAL" as const },
      { id: "c", revokedAt: "2026-01-01T00:00:00.000Z", status: "ACTIVE" as const },
    ]
    const state = deriveAssignmentState(
      rows,
      (row) => row.id,
      (row) => row.status === "ACTIVE" && row.revokedAt === null
    )
    expect([...state.activeIds]).toEqual(["a"])
    expect(state.everAssigned).toBe(true)
  })
})

describe("resolveViewerVisibleIds", () => {
  // Mirrors org_scope.ts's applyViewerAssignmentScope / the Viewer
  // fallback-vs-deny asymmetry called out in aexa-frontend#270.
  it("falls back to org-wide (null) when the Viewer was never assigned anything", () => {
    const result = resolveViewerVisibleIds({
      activeIds: new Set(),
      everAssigned: false,
    })
    expect(result).toBeNull()
  })

  it("denies (empty set, not fallback) when every assignment was revoked", () => {
    const result = resolveViewerVisibleIds({
      activeIds: new Set(),
      everAssigned: true,
    })
    expect(result).not.toBeNull()
    expect(result?.size).toBe(0)
  })

  it("scopes to exactly the active assignments when some are still active", () => {
    const result = resolveViewerVisibleIds({
      activeIds: new Set(["insp-1"]),
      everAssigned: true,
    })
    expect(result).toEqual(new Set(["insp-1"]))
  })
})

describe("canWriteInspection", () => {
  it("always allows ADMIN, regardless of assignment data", () => {
    expect(canWriteInspection("ADMIN", "insp-1", undefined)).toBe(true)
    expect(canWriteInspection("ADMIN", "insp-1", new Set())).toBe(true)
  })

  it("denies VIEWER and LIGHT_USER regardless of assignment data", () => {
    expect(canWriteInspection("VIEWER", "insp-1", new Set(["insp-1"]))).toBe(
      false
    )
    expect(
      canWriteInspection("LIGHT_USER", "insp-1", new Set(["insp-1"]))
    ).toBe(false)
  })

  it("allows an assigned LEAD_AUDITOR", () => {
    expect(
      canWriteInspection("LEAD_AUDITOR", "insp-1", new Set(["insp-1"]))
    ).toBe(true)
  })

  it("denies an unassigned LEAD_AUDITOR with known (empty) assignment data", () => {
    expect(canWriteInspection("LEAD_AUDITOR", "insp-1", new Set())).toBe(
      false
    )
  })

  it("denies a LEAD_AUDITOR who is assigned to a DIFFERENT inspection", () => {
    expect(
      canWriteInspection("LEAD_AUDITOR", "insp-1", new Set(["insp-2"]))
    ).toBe(false)
  })

  it("degrades to allowed for LEAD_AUDITOR when assignment data is unavailable", () => {
    expect(canWriteInspection("LEAD_AUDITOR", "insp-1", undefined)).toBe(true)
  })

  it("denies while role is still loading (undefined)", () => {
    expect(canWriteInspection(undefined, "insp-1", new Set(["insp-1"]))).toBe(
      false
    )
  })
})

describe("canWriteFinding", () => {
  it("always allows ADMIN", () => {
    expect(
      canWriteFinding("ADMIN", "action-1", "insp-1", undefined, undefined)
    ).toBe(true)
  })

  it("denies VIEWER regardless of assignment data", () => {
    expect(
      canWriteFinding(
        "VIEWER",
        "action-1",
        "insp-1",
        new Set(["insp-1"]),
        new Set(["action-1"])
      )
    ).toBe(false)
  })

  it("allows a LEAD_AUDITOR assigned to the finding's parent inspection", () => {
    expect(
      canWriteFinding(
        "LEAD_AUDITOR",
        "action-1",
        "insp-1",
        new Set(["insp-1"]),
        undefined
      )
    ).toBe(true)
  })

  it("denies a LEAD_AUDITOR not assigned to the parent inspection", () => {
    expect(
      canWriteFinding(
        "LEAD_AUDITOR",
        "action-1",
        "insp-1",
        new Set(["insp-2"]),
        undefined
      )
    ).toBe(false)
  })

  it("degrades to allowed for LEAD_AUDITOR when inspection assignment data is unavailable", () => {
    expect(
      canWriteFinding("LEAD_AUDITOR", "action-1", "insp-1", undefined, undefined)
    ).toBe(true)
  })

  it("allows a LIGHT_USER with an active FindingAssignment on this exact finding", () => {
    expect(
      canWriteFinding(
        "LIGHT_USER",
        "action-1",
        "insp-1",
        undefined,
        new Set(["action-1"])
      )
    ).toBe(true)
  })

  it("denies a LIGHT_USER with a revoked/absent FindingAssignment on this finding", () => {
    expect(
      canWriteFinding("LIGHT_USER", "action-1", "insp-1", undefined, new Set())
    ).toBe(false)
  })

  it("denies a LIGHT_USER assigned to a DIFFERENT finding", () => {
    expect(
      canWriteFinding(
        "LIGHT_USER",
        "action-1",
        "insp-1",
        undefined,
        new Set(["action-2"])
      )
    ).toBe(false)
  })

  it("degrades LIGHT_USER to the caller-supplied default when finding assignment data is unavailable", () => {
    expect(
      canWriteFinding(
        "LIGHT_USER",
        "action-1",
        "insp-1",
        undefined,
        undefined,
        true
      )
    ).toBe(true)
    expect(
      canWriteFinding(
        "LIGHT_USER",
        "action-1",
        "insp-1",
        undefined,
        undefined,
        false
      )
    ).toBe(false)
  })

  it("defaults the LIGHT_USER degrade case to false when not specified", () => {
    expect(
      canWriteFinding("LIGHT_USER", "action-1", "insp-1", undefined, undefined)
    ).toBe(false)
  })
})
