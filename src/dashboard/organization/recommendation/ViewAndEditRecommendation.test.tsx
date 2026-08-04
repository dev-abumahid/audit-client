import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ViewAndEditRecommendation from "./ViewAndEditRecommendation"

// Run lodash's debounce synchronously so save-on-change assertions don't need real timers.
vi.mock("lodash", () => ({
  debounce: (fn: (...args: unknown[]) => unknown) => {
    const wrapped = (...args: unknown[]) => fn(...args)
    wrapped.cancel = vi.fn()
    return wrapped
  },
}))

const mockUseGetRecommendationByInspectionIdQuery = vi.fn()
const mockUpdateRecommendationQuestion = vi.fn()
const mockUpdateRecommendationSummary = vi.fn()
const mockGenerateRecommendation = vi.fn()

vi.mock("@/redux/apis/organization/recommendation.api", () => ({
  useGetRecommendationByInspectionIdQuery: (...args: unknown[]) =>
    mockUseGetRecommendationByInspectionIdQuery(...args),
  useUpdateRecommendationQuestionByIdMutation: () => [
    mockUpdateRecommendationQuestion,
  ],
  useUpdateRecommendationSummaryMutation: () => [
    mockUpdateRecommendationSummary,
  ],
}))

vi.mock("@/redux/apis/organization/ai.api", () => ({
  useGenerateRecommendationFromAiMutation: () => [mockGenerateRecommendation],
}))

vi.mock("../findings/CreateNewFindingModal", () => ({
  default: ({
    open,
    additionalData,
  }: {
    open: boolean
    additionalData?: { actionDisc?: string }
  }) =>
    open ? (
      <div>
        Finding modal open
        {additionalData?.actionDisc && (
          <div data-testid="prefilled-action-disc">
            {additionalData.actionDisc}
          </div>
        )}
      </div>
    ) : null,
}))

function makeRecommendation(overrides = {}) {
  return {
    id: "rec-1",
    summary: "Overall the site is compliant.",
    createdAt: "2026-06-01T10:00:00.000Z",
    questions: [
      {
        id: "q-1",
        question: "Fire extinguisher present?",
        observation: "Extinguisher found near exit",
        recommendation: "Ensure monthly inspection tag is current",
        standard: "NFPA 10",
      },
    ],
    ...overrides,
  }
}

describe("ViewAndEditRecommendation", () => {
  beforeEach(() => {
    mockUseGetRecommendationByInspectionIdQuery.mockReset()
    mockUpdateRecommendationQuestion.mockReset()
    mockUpdateRecommendationSummary.mockReset()
    mockGenerateRecommendation.mockReset()
    mockUpdateRecommendationQuestion.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })
    mockUpdateRecommendationSummary.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })
  })

  it("renders nothing while loading", () => {
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      refetch: vi.fn(),
    })

    const { container } = render(
      <ViewAndEditRecommendation inspectionId="insp-1" />
    )

    expect(container).toBeEmptyDOMElement()
  })

  it("shows the generate button when there is no recommendation yet", () => {
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: { questions: [] } },
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<ViewAndEditRecommendation inspectionId="insp-1" />)

    expect(
      screen.getByText("organization.recommendation.noRecommendation")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: "organization.recommendation.generateNow",
      })
    ).toBeInTheDocument()
  })

  it("calls generateRecommendation and refetches on click", async () => {
    const refetch = vi.fn()
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: { questions: [] } },
      isLoading: false,
      refetch,
    })
    mockGenerateRecommendation.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })

    render(<ViewAndEditRecommendation inspectionId="insp-77" />)
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.recommendation.generateNow",
      })
    )

    await waitFor(() =>
      expect(mockGenerateRecommendation).toHaveBeenCalledWith({
        inspectionId: "insp-77",
      })
    )
    await waitFor(() => expect(refetch).toHaveBeenCalled())
  })

  it("renders question observation, recommendation and standard fields", () => {
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: makeRecommendation() },
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<ViewAndEditRecommendation inspectionId="insp-1" />)

    expect(
      screen.getByDisplayValue("Extinguisher found near exit")
    ).toBeInTheDocument()
    expect(
      screen.getByDisplayValue("Ensure monthly inspection tag is current")
    ).toBeInTheDocument()
    expect(screen.getByDisplayValue("NFPA 10")).toBeInTheDocument()
    expect(
      screen.getByDisplayValue("Overall the site is compliant.")
    ).toBeInTheDocument()
  })

  // Round 13 (#505): each textarea only had an adjacent heading, not a real
  // htmlFor/aria-labelledby/aria-label association.
  it("associates the Observation, Recommendation, Standard and Executive Summary fields with their headings", () => {
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: makeRecommendation() },
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<ViewAndEditRecommendation inspectionId="insp-1" />)

    expect(
      screen.getByLabelText("organization.recommendation.aiObservation")
    ).toHaveDisplayValue("Extinguisher found near exit")
    expect(
      screen.getByLabelText("organization.recommendation.aiRecommendation")
    ).toHaveDisplayValue("Ensure monthly inspection tag is current")
    expect(
      screen.getByLabelText("organization.recommendation.applicableStandard")
    ).toHaveDisplayValue("NFPA 10")
    expect(
      screen.getByLabelText("organization.recommendation.executiveSummary")
    ).toHaveDisplayValue("Overall the site is compliant.")
  })

  // Round 13 (#505): the question-title control used to be a disabled
  // <input> that still carried a full onChange handler that could never
  // fire. It's now plain text -- confirm the question text still renders,
  // and that there's no longer a (dead, disabled) textbox for it.
  it("renders the question title as plain text, not a dead disabled input", () => {
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: makeRecommendation() },
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<ViewAndEditRecommendation inspectionId="insp-1" />)

    expect(screen.getByText("Fire extinguisher present?")).toBeInTheDocument()
    expect(
      screen.queryByDisplayValue("Fire extinguisher present?")
    ).not.toBeInTheDocument()
  })

  it("saves an edited observation via updateRecommendationQuestion", async () => {
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: makeRecommendation() },
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<ViewAndEditRecommendation inspectionId="insp-1" />)
    const observationField = screen.getByDisplayValue(
      "Extinguisher found near exit"
    )
    await userEvent.type(observationField, "!")

    await waitFor(() =>
      expect(mockUpdateRecommendationQuestion).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "q-1",
          data: expect.objectContaining({
            observation: "Extinguisher found near exit!",
          }),
        })
      )
    )
  })

  it("saves an edited summary via updateRecommendationSummary", async () => {
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: makeRecommendation() },
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<ViewAndEditRecommendation inspectionId="insp-1" />)
    const summaryField = screen.getByDisplayValue(
      "Overall the site is compliant."
    )
    await userEvent.type(summaryField, " Updated.")

    await waitFor(() =>
      expect(mockUpdateRecommendationSummary).toHaveBeenCalledWith(
        expect.objectContaining({ id: "rec-1" })
      )
    )
  })

  it("does not refetch and re-enables the button when generating a recommendation fails", async () => {
    const refetch = vi.fn()
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: { questions: [] } },
      isLoading: false,
      refetch,
    })
    mockGenerateRecommendation.mockReturnValue({
      unwrap: () =>
        Promise.reject({ data: { message: "AI service unavailable" } }),
    })

    render(<ViewAndEditRecommendation inspectionId="insp-1" />)
    const button = screen.getByRole("button", {
      name: "organization.recommendation.generateNow",
    })
    await userEvent.click(button)

    await waitFor(() => expect(mockGenerateRecommendation).toHaveBeenCalled())
    // The catch branch skips refetch() and re-enables the button (isGenerating reset in `finally`)
    expect(refetch).not.toHaveBeenCalled()
    expect(button).not.toBeDisabled()
  })

  it("shows an error status (with fallback message) when saving an observation fails", async () => {
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: makeRecommendation() },
      isLoading: false,
      refetch: vi.fn(),
    })
    mockUpdateRecommendationQuestion.mockReturnValue({
      unwrap: () => Promise.reject({}),
    })

    render(<ViewAndEditRecommendation inspectionId="insp-1" />)
    const observationField = screen.getByDisplayValue(
      "Extinguisher found near exit"
    )
    await userEvent.type(observationField, "!")

    await waitFor(() =>
      expect(
        screen.getByText("organization.recommendation.saveFailed")
      ).toBeInTheDocument()
    )
  })

  it("shows an error status when saving the summary fails", async () => {
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: makeRecommendation() },
      isLoading: false,
      refetch: vi.fn(),
    })
    mockUpdateRecommendationSummary.mockReturnValue({
      unwrap: () => Promise.reject({}),
    })

    render(<ViewAndEditRecommendation inspectionId="insp-1" />)
    const summaryField = screen.getByDisplayValue(
      "Overall the site is compliant."
    )
    await userEvent.type(summaryField, "!")

    await waitFor(() =>
      expect(
        screen.getByText("organization.recommendation.summarySaveFailed")
      ).toBeInTheDocument()
    )
  })

  it('opens the finding modal when "Add To Finding" is clicked', async () => {
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: makeRecommendation() },
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<ViewAndEditRecommendation inspectionId="insp-1" />)
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.recommendation.addToFinding",
      })
    )

    expect(screen.getByText("Finding modal open")).toBeInTheDocument()
  })

  // aexa-frontend#519 -- the "Add to Finding" prefill jammed
  // question.recommendation and question.standard together with no
  // separator (e.g. "Ensure monthly inspection tag is currentNFPA 10").
  // They're distinct fields, so join them with a blank line instead.
  it("separates recommendation and standard with a blank line when prefilling a new finding", async () => {
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: makeRecommendation() },
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<ViewAndEditRecommendation inspectionId="insp-1" />)
    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.recommendation.addToFinding",
      })
    )

    // toHaveTextContent collapses whitespace, so assert on the raw
    // textContent to prove the fields are actually separated (a direct
    // concatenation would produce "...currentNFPA 10" with no boundary).
    expect(screen.getByTestId("prefilled-action-disc").textContent).toBe(
      "Ensure monthly inspection tag is current\n\nNFPA 10"
    )
  })

  // aexa-frontend#488 -- the "Created" date used a bare
  // `new Date(...).toLocaleDateString("en-US", ...)` instead of the shared
  // formatLocaleDate() helper every other file in this scope uses, so it
  // ignored the app's selected language. Spied the same way
  // RiskApprovalControls.test.tsx proves its own decidedOn date is routed
  // through the shared helper.
  it("formats the created date via the shared formatLocaleDate() helper", async () => {
    const formatDateModule = await import("@/utils/formatDate")
    const spy = vi.spyOn(formatDateModule, "formatLocaleDate")

    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: makeRecommendation() },
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<ViewAndEditRecommendation inspectionId="insp-1" />)

    expect(spy.mock.calls[0]?.[0]).toBe("2026-06-01T10:00:00.000Z")
    spy.mockRestore()
  })

  // aexa-frontend#488 -- this component's own <h1> collided with
  // UpdateInspection.tsx's page-level h1 (its only caller), and the
  // question-card labels skipped from h1 straight to h4. Now the page title
  // is an h2 and the question-card labels are h3, giving a clean
  // h2 -> h3 -> h3 -> h3 -> h2 (Executive Summary) structure with no
  // duplicate h1 and no skipped level.
  it("renders the page title as h2 (not h1) and the question-card labels as h3 (not h4)", () => {
    mockUseGetRecommendationByInspectionIdQuery.mockReturnValue({
      data: { data: makeRecommendation() },
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<ViewAndEditRecommendation inspectionId="insp-1" />)

    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "organization.recommendation.title",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "organization.recommendation.aiObservation",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "organization.recommendation.aiRecommendation",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "organization.recommendation.applicableStandard",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "organization.recommendation.executiveSummary",
      })
    ).toBeInTheDocument()
  })
})
