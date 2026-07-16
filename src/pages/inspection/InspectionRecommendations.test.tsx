import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import InspectionRecommendations from "./InspectionRecommendations"

vi.mock("react-router", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router")>()
  return { ...mod, useParams: () => ({ id: "insp-1" }) }
})

const mockUseGetRecommendationByInspectionIdQuery = vi.fn()
const mockUpdateRecommendationQuestionById = vi.fn()
const mockUpdateRecommendationSummary = vi.fn()

vi.mock("@/redux/apis/organization/recommendation.api", () => ({
  useGetRecommendationByInspectionIdQuery: (...args: unknown[]) =>
    mockUseGetRecommendationByInspectionIdQuery(...args),
  useUpdateRecommendationQuestionByIdMutation: () => [
    mockUpdateRecommendationQuestionById,
  ],
  useUpdateRecommendationSummaryMutation: () => [
    mockUpdateRecommendationSummary,
  ],
}))

const mockRec = {
  id: "rec-1",
  inspectionId: "insp-1",
  summary: "Overall inspection summary.",
  createdAt: "2026-06-21T10:00:00.000Z",
  questions: [
    {
      id: "rr-1",
      question: "Fire extinguisher condition",
      observation: "Units are expired.",
      standard: "ISO 23601",
      recommendation: "Replace all units immediately.",
    },
    {
      id: "rr-2",
      question: "Emergency exits",
      observation: "Exit signs not illuminated.",
      standard: "EN 1838",
      recommendation: "Install emergency lighting.",
    },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter>
      <InspectionRecommendations />
    </MemoryRouter>
  )
}

describe("InspectionRecommendations", () => {
  beforeEach(() => {
    mockUseGetRecommendationByInspectionIdQuery.mockReset()
    mockUpdateRecommendationQuestionById.mockReset()
    mockUpdateRecommendationSummary.mockReset()
    mockUpdateRecommendationQuestionById.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })
    mockUpdateRecommendationSummary.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })
  })

  it("shows a loading spinner initially", () => {
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: undefined,
    })
    renderPage()
    expect(document.querySelector(".animate-spin")).toBeInTheDocument()
  })

  it('shows "no recommendations" state on 404', async () => {
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 404 },
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText("No recommendations yet")).toBeInTheDocument()
    )
    expect(screen.getByText(/Complete the inspection/i)).toBeInTheDocument()
  })

  it("shows a generic error message on a non-404 error", async () => {
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 500 },
    })
    renderPage()
    await waitFor(() =>
      expect(
        screen.getByText("Failed to load recommendations")
      ).toBeInTheDocument()
    )
  })

  it("renders summary and finding count when data is present", async () => {
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: mockRec },
      isLoading: false,
      error: undefined,
    })
    renderPage()
    await waitFor(() =>
      expect(
        screen.getByDisplayValue("Overall inspection summary.")
      ).toBeInTheDocument()
    )
    expect(screen.getByText("2 findings")).toBeInTheDocument()
  })

  it("renders finding question labels", async () => {
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: mockRec },
      isLoading: false,
      error: undefined,
    })
    renderPage()
    await waitFor(() =>
      expect(
        screen.getByText("Fire extinguisher condition")
      ).toBeInTheDocument()
    )
    expect(screen.getByText("Emergency exits")).toBeInTheDocument()
  })

  it("expands first finding by default showing observation fields", async () => {
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: mockRec },
      isLoading: false,
      error: undefined,
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByDisplayValue("Units are expired.")).toBeInTheDocument()
    )
    expect(screen.getByDisplayValue("ISO 23601")).toBeInTheDocument()
    expect(
      screen.getByDisplayValue("Replace all units immediately.")
    ).toBeInTheDocument()
  })

  it("collapses / expands a finding on click", async () => {
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: mockRec },
      isLoading: false,
      error: undefined,
    })
    renderPage()
    await waitFor(() =>
      expect(
        screen.getByText("Fire extinguisher condition")
      ).toBeInTheDocument()
    )

    // first finding starts expanded — click to collapse
    await userEvent.click(screen.getByText("Fire extinguisher condition"))
    expect(
      screen.queryByDisplayValue("Units are expired.")
    ).not.toBeInTheDocument()

    // click again to expand
    await userEvent.click(screen.getByText("Fire extinguisher condition"))
    await waitFor(() =>
      expect(screen.getByDisplayValue("Units are expired.")).toBeInTheDocument()
    )
  })

  it("calls updateRecommendationQuestionById on blur of an editable field", async () => {
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: mockRec },
      isLoading: false,
      error: undefined,
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByDisplayValue("Units are expired.")).toBeInTheDocument()
    )

    const field = screen.getByDisplayValue("Units are expired.")
    await userEvent.clear(field)
    await userEvent.type(field, "Updated observation")
    await userEvent.tab()

    await waitFor(() =>
      expect(mockUpdateRecommendationQuestionById).toHaveBeenCalledWith({
        id: "rr-1",
        data: { observation: "Updated observation" },
      })
    )
  })

  it("auto-expands the first finding again after navigating to a different inspection", async () => {
    // The route this page lives on doesn't remount the component between
    // different inspections, so this simulates React re-rendering the same
    // component instance with a brand-new recommendation payload (a
    // different inspection's data) rather than mounting a fresh one.
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: mockRec },
      isLoading: false,
      error: undefined,
    })
    const { rerender } = renderPage()
    await waitFor(() =>
      expect(screen.getByDisplayValue("Units are expired.")).toBeInTheDocument()
    )

    // Collapse the first finding so we can tell whether the second
    // inspection's auto-expand actually re-fires.
    await userEvent.click(screen.getByText("Fire extinguisher condition"))
    expect(
      screen.queryByDisplayValue("Units are expired.")
    ).not.toBeInTheDocument()

    const secondRec = {
      id: "rec-2",
      inspectionId: "insp-2",
      summary: "Second inspection summary.",
      createdAt: "2026-06-22T10:00:00.000Z",
      questions: [
        {
          id: "rr-3",
          question: "Fire alarm coverage",
          observation: "Alarms untested in 12 months.",
          standard: "NFPA 72",
          recommendation: "Schedule annual testing.",
        },
      ],
    }
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: secondRec },
      isLoading: false,
      error: undefined,
    })
    rerender(
      <MemoryRouter>
        <InspectionRecommendations />
      </MemoryRouter>
    )

    // The first finding of the *second* inspection should auto-expand too,
    // not stay collapsed because the one-shot flag was already spent on the
    // first inspection.
    await waitFor(() =>
      expect(
        screen.getByDisplayValue("Alarms untested in 12 months.")
      ).toBeInTheDocument()
    )
  })

  it("calls updateRecommendationSummary when saving the summary", async () => {
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: mockRec },
      isLoading: false,
      error: undefined,
    })
    renderPage()
    const summaryField = await screen.findByDisplayValue(
      "Overall inspection summary."
    )
    await userEvent.type(summaryField, " Updated.")
    await userEvent.click(screen.getByText("Save summary"))

    await waitFor(() =>
      expect(mockUpdateRecommendationSummary).toHaveBeenCalledWith({
        id: "rec-1",
        data: { summary: "Overall inspection summary. Updated." },
      })
    )
  })
})
