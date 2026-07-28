import { renderHook } from "@testing-library/react"
import {
  useMyActiveFindingAssignmentIds,
  useMyAssignedInspectionIds,
} from "./useMyAssignments"

const mockUseGetMyInspectionAssignmentsQuery = vi.fn()
vi.mock("@/redux/apis/organization/inspection.api", () => ({
  useGetMyInspectionAssignmentsQuery: () =>
    mockUseGetMyInspectionAssignmentsQuery(),
}))

const mockUseGetMyFindingAssignmentsQuery = vi.fn()
vi.mock("@/redux/apis/organization/findings.api", () => ({
  useGetMyFindingAssignmentsQuery: () =>
    mockUseGetMyFindingAssignmentsQuery(),
}))

describe("useMyAssignedInspectionIds", () => {
  it("returns undefined while loading", () => {
    mockUseGetMyInspectionAssignmentsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    })
    const { result } = renderHook(() => useMyAssignedInspectionIds())
    expect(result.current).toBeUndefined()
  })

  it("returns undefined on error, never throws", () => {
    mockUseGetMyInspectionAssignmentsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    })
    const { result } = renderHook(() => useMyAssignedInspectionIds())
    expect(result.current).toBeUndefined()
  })

  it("returns only non-revoked inspection ids", () => {
    mockUseGetMyInspectionAssignmentsQuery.mockReturnValue({
      data: {
        data: [
          { id: "a1", inspectionId: "insp-1", revokedAt: null, createdAt: "" },
          {
            id: "a2",
            inspectionId: "insp-2",
            revokedAt: "2026-01-01T00:00:00.000Z",
            createdAt: "",
          },
        ],
      },
      isLoading: false,
      isError: false,
    })
    const { result } = renderHook(() => useMyAssignedInspectionIds())
    expect(result.current).toEqual(new Set(["insp-1"]))
  })

  it("returns an empty (known, not unavailable) set when the caller has zero assignments", () => {
    mockUseGetMyInspectionAssignmentsQuery.mockReturnValue({
      data: { data: [] },
      isLoading: false,
      isError: false,
    })
    const { result } = renderHook(() => useMyAssignedInspectionIds())
    expect(result.current).toEqual(new Set())
  })
})

describe("useMyActiveFindingAssignmentIds", () => {
  it("returns undefined while loading or on error", () => {
    mockUseGetMyFindingAssignmentsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    })
    expect(
      renderHook(() => useMyActiveFindingAssignmentIds()).result.current
    ).toBeUndefined()

    mockUseGetMyFindingAssignmentsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    })
    expect(
      renderHook(() => useMyActiveFindingAssignmentIds()).result.current
    ).toBeUndefined()
  })

  it("only includes ACTIVE, non-revoked assignments -- PENDING_APPROVAL/REJECTED grant nothing", () => {
    mockUseGetMyFindingAssignmentsQuery.mockReturnValue({
      data: {
        data: [
          {
            id: "fa1",
            actionId: "action-1",
            status: "ACTIVE",
            revokedAt: null,
            createdAt: "",
            action: {
              id: "action-1",
              actionTitle: "",
              inspectionId: "insp-1",
              status: "TO_DO",
            },
          },
          {
            id: "fa2",
            actionId: "action-2",
            status: "PENDING_APPROVAL",
            revokedAt: null,
            createdAt: "",
            action: {
              id: "action-2",
              actionTitle: "",
              inspectionId: "insp-1",
              status: "TO_DO",
            },
          },
          {
            id: "fa3",
            actionId: "action-3",
            status: "ACTIVE",
            revokedAt: "2026-01-01T00:00:00.000Z",
            createdAt: "",
            action: {
              id: "action-3",
              actionTitle: "",
              inspectionId: "insp-1",
              status: "TO_DO",
            },
          },
        ],
      },
      isLoading: false,
      isError: false,
    })
    const { result } = renderHook(() => useMyActiveFindingAssignmentIds())
    expect(result.current).toEqual(new Set(["action-1"]))
  })
})
