import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { StrictMode } from "react"
import { MemoryRouter } from "react-router"
import RunInspection from "./RunInspection"

const mockNavigate = vi.fn()
vi.mock("react-router", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router")>()
  return {
    ...mod,
    useParams: () => ({ id: "insp-1" }),
    useNavigate: () => mockNavigate,
  }
})

// ── role gating (aexa-frontend#275) — mocked per-test via this mutable
// holder, same convention as InspectionTable.test.tsx/FindingDetails.test.tsx.
// Defaults to ADMIN so every pre-existing test below (written before #275
// added any gating) keeps exercising the full-access path unchanged.
let mockRole: string | undefined = "ADMIN"
vi.mock("@/hooks/useMyOrgRole", () => ({
  useMyOrgRole: () => mockRole,
}))

// ── assignment gating (aexa-frontend#275, reusing #270's plumbing) — same
// mutable-holder convention as mockRole above. `undefined` means "assignment
// data unavailable / still loading", matching useMyAssignedInspectionIds'
// real contract.
let mockAssignedInspectionIds: Set<string> | undefined = new Set(["insp-1"])
vi.mock("@/hooks/useMyAssignments", () => ({
  useMyAssignedInspectionIds: () => mockAssignedInspectionIds,
}))

const mockUseGetSingleInspectionQuery = vi.fn()
const mockUpdateInspectionQuestionAnswer = vi.fn()
const mockUpdateInspection = vi.fn()

vi.mock("@/redux/apis/organization/inspection.api", () => ({
  useGetSingleInspectionQuery: (...args: unknown[]) =>
    mockUseGetSingleInspectionQuery(...args),
  useUpdateInspectionQuestionAnswerMutation: () => [
    mockUpdateInspectionQuestionAnswer,
  ],
  useUpdateInspectionMutation: () => [mockUpdateInspection],
}))

const mockUseGetAllFindingsQuery = vi.fn()
vi.mock("@/redux/apis/organization/findings.api", () => ({
  useGetAllFindingsQuery: (...args: unknown[]) =>
    mockUseGetAllFindingsQuery(...args),
}))

const mockInspection = {
  id: "insp-1",
  status: "IN_PROGRESS",
  createdAt: "2026-06-21T00:00:00.000Z",
  updatedAt: "2026-06-21T00:00:00.000Z",
  unSplitText: null,
  note: null,
  site: { id: "s-1", name: "HQ Casablanca" },
  template: {
    id: "t-1",
    templateName: "Fire Safety Audit",
    pages: [
      {
        id: "pg-1",
        pageIndex: 1,
        title: "General info",
        questions: [
          {
            id: "q-1",
            index: 0,
            question: "Location?",
            isRequired: true,
            answerType: "TEXT",
            value: null,
          },
          {
            id: "q-2",
            index: 1,
            question: "Date?",
            isRequired: false,
            answerType: "DATE",
            value: null,
          },
        ],
      },
      {
        id: "pg-2",
        pageIndex: 2,
        title: "Fire systems",
        questions: [
          {
            id: "q-3",
            index: 0,
            question: "Extinguisher ok?",
            isRequired: true,
            answerType: "CHECKBOX",
            value: ["Yes", "No"],
          },
        ],
      },
    ],
  },
  questionAnswers: [
    {
      id: "qa-1",
      questionId: "q-1",
      answer: "",
      note: null,
      mediaFiles: null,
      question: {
        id: "q-1",
        question: "Location?",
        answerType: "TEXT",
        value: null,
      },
    },
    {
      id: "qa-2",
      questionId: "q-2",
      answer: "",
      note: null,
      mediaFiles: null,
      question: {
        id: "q-2",
        question: "Date?",
        answerType: "DATE",
        value: null,
      },
    },
    {
      id: "qa-3",
      questionId: "q-3",
      answer: [],
      note: null,
      mediaFiles: null,
      question: {
        id: "q-3",
        question: "Extinguisher ok?",
        answerType: "CHECKBOX",
        value: ["Yes", "No"],
      },
    },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter>
      <RunInspection />
    </MemoryRouter>
  )
}

function renderPageInStrictMode() {
  return render(
    <StrictMode>
      <MemoryRouter>
        <RunInspection />
      </MemoryRouter>
    </StrictMode>
  )
}

describe("RunInspection", () => {
  beforeEach(() => {
    mockRole = "ADMIN"
    mockAssignedInspectionIds = new Set(["insp-1"])
    mockUseGetSingleInspectionQuery.mockReset()
    mockUpdateInspectionQuestionAnswer.mockReset()
    mockUpdateInspection.mockReset()
    mockUseGetAllFindingsQuery.mockReset()
    mockNavigate.mockReset()
    mockUpdateInspectionQuestionAnswer.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })
    mockUpdateInspection.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: { data: [], meta: { page: 1, limit: 100, total: 0, totalPage: 0 } },
    })
  })

  it("shows a loading spinner initially", () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    })
    renderPage()
    expect(document.querySelector(".animate-spin")).toBeInTheDocument()
  })

  it("shows an error when the fetch fails", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText("pages.inspection.run.loadError")).toBeInTheDocument()
    )
  })

  it("renders the template name in the breadcrumb", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: mockInspection },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText("Fire Safety Audit")).toBeInTheDocument()
    )
  })

  it("renders all page titles in the sidebar", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: mockInspection },
      isLoading: false,
      isError: false,
    })
    renderPage()
    // "General info" appears in both sidebar nav and as the current page heading
    await waitFor(() =>
      expect(screen.getAllByText("General info").length).toBeGreaterThan(0)
    )
    expect(screen.getByText("Fire systems")).toBeInTheDocument()
  })

  it("renders questions for the current page", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: mockInspection },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText("Location?")).toBeInTheDocument()
    )
    expect(screen.getByText("Date?")).toBeInTheDocument()
    // Second page questions should not be visible yet
    expect(screen.queryByText("Extinguisher ok?")).not.toBeInTheDocument()
  })

  it("navigates to the next page when Next is clicked", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: mockInspection },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() => screen.getByText("pages.inspection.run.next"))
    await userEvent.click(screen.getByText("pages.inspection.run.next"))
    await waitFor(() =>
      expect(screen.getByText("Extinguisher ok?")).toBeInTheDocument()
    )
    expect(screen.queryByText("Location?")).not.toBeInTheDocument()
  })

  it("Previous button is disabled on the first page", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: mockInspection },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() => screen.getByText("pages.inspection.run.previous"))
    expect(screen.getByText("pages.inspection.run.previous").closest("button")).toBeDisabled()
  })

  it("marks inspection complete and navigates to list", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: mockInspection },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() => screen.getByText("pages.inspection.run.markComplete"))
    await userEvent.click(screen.getByText("pages.inspection.run.markComplete"))
    await waitFor(() =>
      expect(mockUpdateInspection).toHaveBeenCalledWith({
        id: "insp-1",
        data: { status: "COMPLETED" },
      })
    )
    expect(mockNavigate).toHaveBeenCalledWith("/organization/audit/inspections")
  })

  it('shows "Upload notes" link when inspection has no note', async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: mockInspection },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText("pages.inspection.run.uploadNotes")).toBeInTheDocument()
    )
  })

  it('shows "View notes" link when inspection has an existing note', async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: { ...mockInspection, note: { id: "note-1" } } },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText("pages.inspection.run.viewNotes")).toBeInTheDocument()
    )
  })

  it("renders questions as read-only when inspection is COMPLETED", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: { ...mockInspection, status: "COMPLETED" } },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() => screen.getByText("Location?"))
    const inputs = screen.getAllByRole("textbox")
    inputs.forEach((input) => expect(input).toBeDisabled())
  })

  it("shows the finding count badge from the (server-filtered) findings query", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: mockInspection },
      isLoading: false,
      isError: false,
    })
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: {
        data: [
          { id: "a1", inspectionId: "insp-1" },
          { id: "a2", inspectionId: "insp-1" },
        ],
        meta: { page: 1, limit: 100, total: 2, totalPage: 1 },
      },
    })
    renderPage()
    await waitFor(() => screen.getByText("Location?"))
    expect(screen.getAllByText("2").length).toBeGreaterThan(0)
    expect(mockUseGetAllFindingsQuery).toHaveBeenCalledWith(
      expect.objectContaining({ inspectionId: "insp-1" }),
      expect.anything()
    )
  })

  it("renders a relative mediaFile URL with the BASE_URL prefix", async () => {
    const inspectionWithMedia = {
      ...mockInspection,
      questionAnswers: [
        {
          id: "qa-1",
          questionId: "q-1",
          answer: "Paris",
          note: null,
          mediaFiles: [{ url: "/uploads/photo.jpg" }],
          question: {
            id: "q-1",
            question: "Location?",
            answerType: "TEXT",
            value: null,
          },
        },
        {
          id: "qa-2",
          questionId: "q-2",
          answer: "",
          note: null,
          mediaFiles: null,
          question: {
            id: "q-2",
            question: "Date?",
            answerType: "DATE",
            value: null,
          },
        },
        {
          id: "qa-3",
          questionId: "q-3",
          answer: [],
          note: null,
          mediaFiles: null,
          question: {
            id: "q-3",
            question: "Extinguisher ok?",
            answerType: "CHECKBOX",
            value: ["Yes", "No"],
          },
        },
      ],
    }
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: inspectionWithMedia },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() => screen.getByText("Location?"))
    const img = document.querySelector(
      'img[alt="pages.inspection.run.attachment"]'
    ) as HTMLImageElement
    expect(img).toBeInTheDocument()
    // VITE_API_BASE_URL is not set in the test environment so it falls back to ''
    // meaning relative paths are kept as-is (no double slash)
    expect(img.src).toContain("/uploads/photo.jpg")
  })

  it("does not lose an already-answered question's completion status on a same-inspection background refetch", async () => {
    // Single-question page so the sidebar "done" checkmark reflects q-1's
    // status directly.
    const raceInspection = {
      ...mockInspection,
      template: {
        ...mockInspection.template,
        pages: [
          {
            id: "pg-1",
            pageIndex: 1,
            title: "General info",
            questions: [
              {
                id: "q-1",
                index: 0,
                question: "Location?",
                isRequired: true,
                answerType: "TEXT",
                value: null,
              },
            ],
          },
        ],
      },
      questionAnswers: [
        {
          id: "qa-1",
          questionId: "q-1",
          answer: "Paris",
          note: null,
          mediaFiles: null,
          question: {
            id: "q-1",
            question: "Location?",
            answerType: "TEXT",
            value: null,
          },
        },
      ],
    }

    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: raceInspection },
      isLoading: false,
      isError: false,
    })
    const { rerender } = renderPage()
    await waitFor(() => screen.getByText("Location?"))
    // Page is fully answered — sidebar shows a checkmark, not "1".
    expect(screen.getByText("✓")).toBeInTheDocument()

    // Simulate a background refetch of the *same* inspection (RTK Query
    // hands back a brand-new object reference on every refetch, even for
    // unchanged data) that races ahead of the just-answered question's own
    // row — e.g. read-replica lag right after the autosave that triggered
    // this refetch. Same inspection id, but questionAnswers is temporarily
    // missing q-1's row.
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: { ...raceInspection, questionAnswers: [] } },
      isLoading: false,
      isError: false,
    })
    rerender(
      <MemoryRouter>
        <RunInspection />
      </MemoryRouter>
    )

    // Because the reseed is keyed on inspection id (not object reference),
    // the local answer cache from the first render is retained and still
    // reports q-1 as answered, so the checkmark should NOT revert to "1".
    await waitFor(() => expect(screen.getByText("✓")).toBeInTheDocument())
    expect(screen.queryByText("1")).not.toBeInTheDocument()
  })

  it("renders an absolute mediaFile URL unchanged", async () => {
    const inspectionWithMedia = {
      ...mockInspection,
      questionAnswers: [
        {
          id: "qa-1",
          questionId: "q-1",
          answer: "Paris",
          note: null,
          mediaFiles: ["https://cdn.example.com/photo.png"],
          question: {
            id: "q-1",
            question: "Location?",
            answerType: "TEXT",
            value: null,
          },
        },
        {
          id: "qa-2",
          questionId: "q-2",
          answer: "",
          note: null,
          mediaFiles: null,
          question: {
            id: "q-2",
            question: "Date?",
            answerType: "DATE",
            value: null,
          },
        },
        {
          id: "qa-3",
          questionId: "q-3",
          answer: [],
          note: null,
          mediaFiles: null,
          question: {
            id: "q-3",
            question: "Extinguisher ok?",
            answerType: "CHECKBOX",
            value: ["Yes", "No"],
          },
        },
      ],
    }
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: inspectionWithMedia },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() => screen.getByText("Location?"))
    const img = document.querySelector(
      'img[alt="pages.inspection.run.attachment"]'
    ) as HTMLImageElement
    expect(img).toBeInTheDocument()
    expect(img.src).toBe("https://cdn.example.com/photo.png")
  })

  it("saves both answers when two different questions are answered within the debounce window", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: mockInspection },
      isLoading: false,
      isError: false,
    })
    const { container } = renderPage()
    await screen.findByText("Location?")

    vi.useFakeTimers()
    try {
      const textInput = container.querySelector(
        'input[type="text"]'
      ) as HTMLInputElement
      const dateInput = container.querySelector(
        'input[type="date"]'
      ) as HTMLInputElement
      expect(textInput).toBeTruthy()
      expect(dateInput).toBeTruthy()

      // Answer question A (q-1 / qa-1)...
      fireEvent.change(textInput, { target: { value: "Paris" } })
      fireEvent.blur(textInput)

      // ...then, within the 600ms debounce window, answer question B
      // (q-2 / qa-2). Before the fix, this cleared the shared timer and
      // qa-1's save was silently dropped.
      await act(async () => {
        vi.advanceTimersByTime(300)
      })
      fireEvent.change(dateInput, { target: { value: "2026-07-01" } })
      fireEvent.blur(dateInput)

      // Let both independent per-question timers fire.
      await act(async () => {
        vi.advanceTimersByTime(600)
      })
    } finally {
      vi.useRealTimers()
    }

    expect(mockUpdateInspectionQuestionAnswer).toHaveBeenCalledWith({
      id: "qa-1",
      data: { answer: "Paris" },
    })
    expect(mockUpdateInspectionQuestionAnswer).toHaveBeenCalledWith({
      id: "qa-2",
      data: { answer: "2026-07-01" },
    })
    expect(mockUpdateInspectionQuestionAnswer).toHaveBeenCalledTimes(2)
  })

  it("flushes a pending debounced save when the component unmounts before the debounce timer fires (regression for #267)", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: mockInspection },
      isLoading: false,
      isError: false,
    })
    const { container, unmount } = renderPage()
    await screen.findByText("Location?")

    vi.useFakeTimers()
    try {
      const textInput = container.querySelector(
        'input[type="text"]'
      ) as HTMLInputElement
      expect(textInput).toBeTruthy()

      // Answer the question, then navigate away (unmount) well within the
      // 600ms debounce window -- before the fix, the unmount cleanup just
      // cleared this pending timer and the answer was lost silently, with
      // no save call and no error shown.
      fireEvent.change(textInput, { target: { value: "Paris" } })
      fireEvent.blur(textInput)

      await act(async () => {
        vi.advanceTimersByTime(200)
      })
      expect(mockUpdateInspectionQuestionAnswer).not.toHaveBeenCalled()

      unmount()

      // The unmount cleanup fires flushPendingSaves() itself (not a
      // setTimeout callback), so its mutation call happens on the
      // microtask queue rather than the fake clock -- flush microtasks
      // without advancing the timer.
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })
    } finally {
      vi.useRealTimers()
    }

    expect(mockUpdateInspectionQuestionAnswer).toHaveBeenCalledWith({
      id: "qa-1",
      data: { answer: "Paris" },
    })
  })

  it("does not double-submit a pending answer when handleComplete's flush and the unmount cleanup's flush overlap", async () => {
    // Regression test for the concurrent-flush race flagged in review:
    // handleComplete() calls flushPendingSaves() and awaits it; if the
    // component unmounts (e.g. a fast double-navigation) while that flush
    // is still in flight, the unmount cleanup fires its own
    // flushPendingSaves() call. Both calls must share the same in-flight
    // work rather than each independently reading saveTimeouts.current and
    // re-submitting the same pending answer.
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: mockInspection },
      isLoading: false,
      isError: false,
    })

    let resolveSave: () => void = () => {}
    mockUpdateInspectionQuestionAnswer.mockReturnValue({
      unwrap: () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve
        }),
    })
    mockUpdateInspection.mockReturnValue({
      unwrap: () => new Promise(() => {}), // never resolves; not relevant to this test
    })

    const { container, unmount } = renderPage()
    await screen.findByText("Location?")

    const textInput = container.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement
    fireEvent.change(textInput, { target: { value: "Paris" } })
    fireEvent.blur(textInput)

    const completeButton = screen
      .getByText("pages.inspection.run.markComplete")
      .closest("button")!

    // handleComplete() calls flushPendingSaves(), which is now in flight
    // (held open by the unresolved mock above) -- exactly one call so far.
    await act(async () => {
      fireEvent.click(completeButton)
      await Promise.resolve()
    })
    expect(mockUpdateInspectionQuestionAnswer).toHaveBeenCalledTimes(1)

    // Unmount while that flush is still unresolved -- its cleanup fires a
    // second flushPendingSaves() call. Without the dedup fix, this would
    // read the still-pending qa-1 entry (only cleared on save *success*)
    // and re-submit it, double-saving the same answer.
    unmount()
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(mockUpdateInspectionQuestionAnswer).toHaveBeenCalledTimes(1)

    // Resolve the shared in-flight save; still only one call total.
    await act(async () => {
      resolveSave()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(mockUpdateInspectionQuestionAnswer).toHaveBeenCalledTimes(1)
  })

  it("still shows the save indicator after React 18 StrictMode's dev-only synthetic mount/cleanup/remount", async () => {
    // StrictMode (enabled app-wide in src/main.tsx) intentionally
    // mounts, cleans up, and remounts every component once in dev to
    // surface effects that aren't idempotent. The unmount cleanup effect
    // sets isMountedRef.current = false; without resetting it back to
    // true on the following (re-)setup, that synthetic first cleanup
    // would permanently pin isMountedRef.current to false for the rest
    // of the component's real lifetime, silently breaking the
    // isMountedRef-guarded "saved"/"error" indicator from the very first
    // real render onward.
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: mockInspection },
      isLoading: false,
      isError: false,
    })

    const { container } = renderPageInStrictMode()
    await screen.findByText("Location?")

    const textInput = container.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement
    fireEvent.change(textInput, { target: { value: "Paris" } })
    fireEvent.blur(textInput)

    await act(async () => {
      vi.useFakeTimers()
      vi.advanceTimersByTime(600)
      vi.useRealTimers()
      await Promise.resolve()
      await Promise.resolve()
    })

    await waitFor(() =>
      expect(screen.getByText("pages.inspection.run.saved")).toBeInTheDocument()
    )
  })

  it("does not warn about setting state on an unmounted component when the ordinary debounce timer's own save resolves after unmount", async () => {
    // Distinct from the flush-path tests above: here the 600ms debounce
    // timer fires normally *while still mounted*, kicking off the save's
    // own .then/.catch (handleAnswerChange's, not flushPendingSaves'). The
    // component then unmounts before that save's promise settles, so this
    // covers the other place setSaveState can fire post-unmount.
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: mockInspection },
      isLoading: false,
      isError: false,
    })

    let resolveSave: () => void = () => {}
    mockUpdateInspectionQuestionAnswer.mockReturnValue({
      unwrap: () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve
        }),
    })

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {})

    const { container, unmount } = renderPage()
    await screen.findByText("Location?")

    vi.useFakeTimers()
    try {
      const textInput = container.querySelector(
        'input[type="text"]'
      ) as HTMLInputElement
      fireEvent.change(textInput, { target: { value: "Paris" } })
      fireEvent.blur(textInput)

      // Let the debounce timer fire on its own (component still mounted),
      // kicking off the save mutation -- which we're holding unresolved.
      await act(async () => {
        vi.advanceTimersByTime(600)
      })
      expect(mockUpdateInspectionQuestionAnswer).toHaveBeenCalledWith({
        id: "qa-1",
        data: { answer: "Paris" },
      })

      // Navigate away before the in-flight save resolves.
      unmount()

      // Now let the save resolve, well after unmount.
      await act(async () => {
        resolveSave()
        await Promise.resolve()
        await Promise.resolve()
      })
    } finally {
      vi.useRealTimers()
    }

    const reactStateWarning = consoleErrorSpy.mock.calls.find((call) =>
      String(call[0]).includes(
        "Can't perform a React state update on an unmounted component"
      )
    )
    expect(reactStateWarning).toBeUndefined()

    consoleErrorSpy.mockRestore()
  })

  it("does not warn about setting state on an unmounted component when a flushed save fails after unmount", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: mockInspection },
      isLoading: false,
      isError: false,
    })
    mockUpdateInspectionQuestionAnswer.mockReturnValue({
      unwrap: () => Promise.reject(new Error("network error")),
    })
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {})

    const { container, unmount } = renderPage()
    await screen.findByText("Location?")

    vi.useFakeTimers()
    try {
      const textInput = container.querySelector(
        'input[type="text"]'
      ) as HTMLInputElement
      fireEvent.change(textInput, { target: { value: "Paris" } })
      fireEvent.blur(textInput)

      await act(async () => {
        vi.advanceTimersByTime(200)
      })

      unmount()

      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })
    } finally {
      vi.useRealTimers()
    }

    const reactStateWarning = consoleErrorSpy.mock.calls.find((call) =>
      String(call[0]).includes(
        "Can't perform a React state update on an unmounted component"
      )
    )
    expect(reactStateWarning).toBeUndefined()

    consoleErrorSpy.mockRestore()
  })

  it("flushes a pending debounced save before completing the inspection", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: mockInspection },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await screen.findByText("pages.inspection.run.next")
    await userEvent.click(screen.getByText("pages.inspection.run.next"))
    await screen.findByText("Extinguisher ok?")

    const checkbox = document.querySelector(
      'input[type="checkbox"]'
    ) as HTMLInputElement
    expect(checkbox).toBeTruthy()

    // Answer the final question, then immediately hit Complete — well
    // within the 600ms debounce window — without ever letting the
    // debounce timer fire on its own.
    fireEvent.click(checkbox)

    const completeButton = screen
      .getByText("pages.inspection.run.completeInspection")
      .closest("button")!

    await act(async () => {
      fireEvent.click(completeButton)
      // Flush the microtask queue so the awaited flush + completion
      // mutation promises resolve without relying on real timers.
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockUpdateInspectionQuestionAnswer).toHaveBeenCalledWith({
      id: "qa-3",
      data: { answer: ["Yes"] },
    })
    await waitFor(() =>
      expect(mockUpdateInspection).toHaveBeenCalledWith({
        id: "insp-1",
        data: { status: "COMPLETED" },
      })
    )

    // The flushed save must be ordered before (or at worst alongside) the
    // completion mutation — never after — so the server never marks the
    // inspection COMPLETED while a newer answer is still unsaved.
    const saveCallOrder = mockUpdateInspectionQuestionAnswer.mock
      .invocationCallOrder[0]
    const completeCallOrder =
      mockUpdateInspection.mock.invocationCallOrder[0]
    expect(saveCallOrder).toBeLessThan(completeCallOrder)
  })

  it("does not mark the inspection complete if a flushed pending save fails", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: mockInspection },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await screen.findByText("pages.inspection.run.next")
    await userEvent.click(screen.getByText("pages.inspection.run.next"))
    await screen.findByText("Extinguisher ok?")

    // The pending save for this answer will fail once flushed.
    mockUpdateInspectionQuestionAnswer.mockReturnValue({
      unwrap: () => Promise.reject(new Error("network error")),
    })

    const checkbox = document.querySelector(
      'input[type="checkbox"]'
    ) as HTMLInputElement
    fireEvent.click(checkbox)

    const completeButton = screen
      .getByText("pages.inspection.run.completeInspection")
      .closest("button")!

    await act(async () => {
      fireEvent.click(completeButton)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    // The completion mutation must never fire once the flush reports a
    // failed save -- otherwise the inspection would be marked COMPLETED
    // while an answer was silently lost.
    expect(mockUpdateInspection).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.getByText("pages.inspection.run.saveFailed")).toBeInTheDocument()
    )
  })

  it("re-attempts a previously failed save on a second Complete click and only then completes (regression for #255)", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: mockInspection },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await screen.findByText("pages.inspection.run.next")
    await userEvent.click(screen.getByText("pages.inspection.run.next"))
    await screen.findByText("Extinguisher ok?")

    // First flush attempt fails (transient network error).
    mockUpdateInspectionQuestionAnswer.mockReturnValue({
      unwrap: () => Promise.reject(new Error("network error")),
    })

    const checkbox = document.querySelector(
      'input[type="checkbox"]'
    ) as HTMLInputElement
    fireEvent.click(checkbox)

    const completeButton = screen
      .getByText("pages.inspection.run.completeInspection")
      .closest("button")!

    await act(async () => {
      fireEvent.click(completeButton)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    // Sanity check: first attempt genuinely failed and did not complete.
    expect(mockUpdateInspection).not.toHaveBeenCalled()
    expect(mockUpdateInspectionQuestionAnswer).toHaveBeenCalledTimes(1)

    // Network issue is now fixed -- the save will succeed if re-attempted.
    mockUpdateInspectionQuestionAnswer.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })

    await act(async () => {
      fireEvent.click(completeButton)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    // The previously-failed answer must genuinely be re-sent (not just
    // silently skipped because it was already cleared from the pending
    // map on the first, failed attempt).
    expect(mockUpdateInspectionQuestionAnswer).toHaveBeenCalledTimes(2)
    expect(mockUpdateInspectionQuestionAnswer).toHaveBeenNthCalledWith(2, {
      id: "qa-3",
      data: { answer: ["Yes"] },
    })

    await waitFor(() =>
      expect(mockUpdateInspection).toHaveBeenCalledWith({
        id: "insp-1",
        data: { status: "COMPLETED" },
      })
    )
  })

  it("disables question inputs while completion is in flight", async () => {
    mockUseGetSingleInspectionQuery.mockReturnValue({
      data: { data: mockInspection },
      isLoading: false,
      isError: false,
    })

    let resolveComplete: () => void = () => {}
    mockUpdateInspection.mockReturnValue({
      unwrap: () =>
        new Promise<void>((resolve) => {
          resolveComplete = resolve
        }),
    })

    renderPage()
    await screen.findByText("pages.inspection.run.markComplete")

    await act(async () => {
      fireEvent.click(screen.getByText("pages.inspection.run.markComplete"))
      await Promise.resolve()
    })

    // Completion mutation hasn't resolved yet -- inputs must stay disabled
    // so an in-flight edit can't create a save that never gets re-flushed
    // before the inspection is marked COMPLETED.
    const textInput = document.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement
    expect(textInput).toBeDisabled()

    await act(async () => {
      resolveComplete()
      await Promise.resolve()
      await Promise.resolve()
    })
  })

  // aexa-frontend#275: this page previously had zero role/assignment
  // gating at all -- any authenticated user navigating straight to the URL
  // saw the full interactive Save/Complete flow, which would 403
  // server-side on submit for anyone assertCanWriteToInspection denies.
  // These mirror InspectionTable.test.tsx's "assignment gating (#270)"
  // describe block, adapted to this page's redirect-based UX (unlike
  // InspectionTable/FindingDetails, this is an edit-only page with a
  // separate read-only report view, so an unauthorized viewer is sent back
  // to the list rather than shown a disabled version of this page).
  describe("write-access gating (#275)", () => {
    it("lets an ADMIN save and complete regardless of assignment", async () => {
      mockRole = "ADMIN"
      mockAssignedInspectionIds = new Set()
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: { data: mockInspection },
        isLoading: false,
        isError: false,
      })
      renderPage()
      await waitFor(() =>
        expect(
          screen.getByText("pages.inspection.run.markComplete")
        ).toBeInTheDocument()
      )
      expect(mockNavigate).not.toHaveBeenCalled()
      const textInput = document.querySelector(
        'input[type="text"]'
      ) as HTMLInputElement
      expect(textInput).not.toBeDisabled()
    })

    it("lets a LEAD_AUDITOR with an active assignment on this inspection save and complete", async () => {
      mockRole = "LEAD_AUDITOR"
      mockAssignedInspectionIds = new Set(["insp-1"])
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: { data: mockInspection },
        isLoading: false,
        isError: false,
      })
      renderPage()
      await waitFor(() =>
        expect(
          screen.getByText("pages.inspection.run.markComplete")
        ).toBeInTheDocument()
      )
      expect(mockNavigate).not.toHaveBeenCalled()
      const textInput = document.querySelector(
        'input[type="text"]'
      ) as HTMLInputElement
      expect(textInput).not.toBeDisabled()
    })

    it("redirects a LEAD_AUDITOR with no assignment on this inspection back to the inspection list", async () => {
      mockRole = "LEAD_AUDITOR"
      mockAssignedInspectionIds = new Set()
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: { data: mockInspection },
        isLoading: false,
        isError: false,
      })
      renderPage()
      await waitFor(() =>
        expect(mockNavigate).toHaveBeenCalledWith(
          "/organization/audit/inspections",
          { replace: true }
        )
      )
      // Never flashes the interactive Save/Complete flow for a confirmed
      // no-access role/assignment combination.
      expect(
        screen.queryByText("pages.inspection.run.markComplete")
      ).not.toBeInTheDocument()
    })

    it("redirects a VIEWER back to the inspection list", async () => {
      mockRole = "VIEWER"
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: { data: mockInspection },
        isLoading: false,
        isError: false,
      })
      renderPage()
      await waitFor(() =>
        expect(mockNavigate).toHaveBeenCalledWith(
          "/organization/audit/inspections",
          { replace: true }
        )
      )
    })

    it("redirects a LIGHT_USER back to the inspection list", async () => {
      mockRole = "LIGHT_USER"
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: { data: mockInspection },
        isLoading: false,
        isError: false,
      })
      renderPage()
      await waitFor(() =>
        expect(mockNavigate).toHaveBeenCalledWith(
          "/organization/audit/inspections",
          { replace: true }
        )
      )
    })

    it("does not prematurely block or redirect a LEAD_AUDITOR while assignment data is still loading", async () => {
      mockRole = "LEAD_AUDITOR"
      mockAssignedInspectionIds = undefined
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: { data: mockInspection },
        isLoading: false,
        isError: false,
      })
      renderPage()
      // Degrades to the pre-#270/#275 role-only behavior (allowed) rather
      // than denying access just because assignment data hasn't resolved.
      await waitFor(() =>
        expect(
          screen.getByText("pages.inspection.run.markComplete")
        ).toBeInTheDocument()
      )
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it("does not redirect while the role itself is still loading", async () => {
      mockRole = undefined
      mockUseGetSingleInspectionQuery.mockReturnValue({
        data: { data: mockInspection },
        isLoading: false,
        isError: false,
      })
      renderPage()
      await waitFor(() =>
        expect(screen.getByText("Location?")).toBeInTheDocument()
      )
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })
})
