import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import InspectionActions from "./InspectionActions"

vi.mock("react-router", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router")>()
  return { ...mod, useParams: () => ({ id: "insp-1" }) }
})

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mockUseGetAllFindingsQuery = vi.fn()
const mockCreateNewFinding = vi.fn()
const mockUpdateFindingById = vi.fn()
const mockDeleteFindingById = vi.fn()

vi.mock("@/redux/apis/organization/findings.api", () => ({
  useGetAllFindingsQuery: (...args: unknown[]) =>
    mockUseGetAllFindingsQuery(...args),
  useCreateNewFindingMutation: () => [mockCreateNewFinding],
  useUpdateFindingByIdMutation: () => [mockUpdateFindingById],
  useDeleteFindingByIdMutation: () => [mockDeleteFindingById],
}))

function makeAction(overrides = {}) {
  return {
    id: "act-1",
    inspectionId: "insp-1",
    actionTitle: "Replace extinguisher",
    actionDisc: "Zone B fire extinguisher needs replacement.",
    priority: "High",
    dueDate: "2099-07-01T00:00:00.000Z",
    status: "TO_DO",
    site: null,
    attachments: [],
    messages: [],
    ...overrides,
  }
}

const emptyResponse = {
  meta: { page: 1, limit: 100, total: 0, totalPage: 0 },
  data: [],
}

function renderPage() {
  return render(
    <MemoryRouter>
      <InspectionActions />
    </MemoryRouter>
  )
}

describe("InspectionActions", () => {
  beforeEach(() => {
    mockUseGetAllFindingsQuery.mockReset()
    mockCreateNewFinding.mockReset()
    mockUpdateFindingById.mockReset()
    mockDeleteFindingById.mockReset()
    mockCreateNewFinding.mockReturnValue({ unwrap: () => Promise.resolve({}) })
    mockUpdateFindingById.mockReturnValue({ unwrap: () => Promise.resolve({}) })
    mockDeleteFindingById.mockReturnValue({ unwrap: () => Promise.resolve({}) })
  })

  it("shows a loading spinner initially", () => {
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    })
    renderPage()
    expect(document.querySelector(".animate-spin")).toBeInTheDocument()
  })

  it("shows empty state when no actions for this inspection", async () => {
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: emptyResponse,
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText("pages.inspection.actions.empty")).toBeInTheDocument()
    )
  })

  it("renders action cards", async () => {
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: { ...emptyResponse, data: [makeAction()] },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText("Replace extinguisher")).toBeInTheDocument()
    )
    expect(
      screen.getByText("Zone B fire extinguisher needs replacement.")
    ).toBeInTheDocument()
    expect(screen.getByText("pages.inspection.actions.priorityHigh")).toBeInTheDocument()
  })

  it("applies the correct colour class to each priority badge", async () => {
    const priorities = ["Low", "Medium", "High"] as const
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: {
        ...emptyResponse,
        data: priorities.map((p, i) =>
          makeAction({ id: `a-${i}`, priority: p, actionTitle: `Action ${p}` })
        ),
      },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() => screen.getByText("Action Low"))

    const classMap: Record<string, string> = {
      "pages.inspection.actions.priorityLow": "bg-slate-100",
      "pages.inspection.actions.priorityMedium": "bg-amber-100",
      "pages.inspection.actions.priorityHigh": "bg-red-100",
    }
    document.querySelectorAll("span.rounded-full").forEach((badge) => {
      const label = badge.textContent?.trim() ?? ""
      if (label in classMap) expect(badge.className).toContain(classMap[label])
    })
  })

  it("requests findings scoped to this inspection via inspectionId", async () => {
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: {
        ...emptyResponse,
        data: [makeAction({ id: "a1", actionTitle: "Mine" })],
      },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() => expect(screen.getByText("Mine")).toBeInTheDocument())
    expect(mockUseGetAllFindingsQuery).toHaveBeenCalledWith(
      expect.objectContaining({ inspectionId: "insp-1" }),
      expect.anything()
    )
  })

  it('opens the create form when "New action" is clicked', async () => {
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: emptyResponse,
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() => screen.getByText("pages.inspection.actions.empty"))
    await userEvent.click(screen.getByText("pages.inspection.actions.newAction"))
    expect(
      screen.getByPlaceholderText("pages.inspection.actions.form.titlePlaceholder")
    ).toBeInTheDocument()
  })

  it("submits the create form via createNewFinding", async () => {
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: emptyResponse,
      isLoading: false,
      isError: false,
    })

    renderPage()
    await waitFor(() => screen.getByText("pages.inspection.actions.newAction"))
    await userEvent.click(screen.getByText("pages.inspection.actions.newAction"))

    await userEvent.type(
      screen.getByPlaceholderText("pages.inspection.actions.form.titlePlaceholder"),
      "Fix lighting"
    )
    await userEvent.type(
      screen.getByPlaceholderText("pages.inspection.actions.form.descriptionPlaceholder"),
      "Replace emergency lighting."
    )
    await userEvent.type(
      document.querySelector('input[type="date"]') as HTMLElement,
      "2026-08-01"
    )

    await userEvent.click(screen.getByText("pages.inspection.actions.createAction"))

    await waitFor(() =>
      expect(mockCreateNewFinding).toHaveBeenCalledWith(
        expect.objectContaining({
          actionTitle: "Fix lighting",
          inspectionId: "insp-1",
        })
      )
    )
    // create form closes on success
    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText("pages.inspection.actions.form.titlePlaceholder")
      ).not.toBeInTheDocument()
    )
  })

  it("shows the server error message when create fails", async () => {
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: emptyResponse,
      isLoading: false,
      isError: false,
    })
    mockCreateNewFinding.mockReturnValue({
      unwrap: () => Promise.reject({ data: { message: "Duplicate title" } }),
    })

    renderPage()
    await waitFor(() => screen.getByText("pages.inspection.actions.newAction"))
    await userEvent.click(screen.getByText("pages.inspection.actions.newAction"))

    await userEvent.type(
      screen.getByPlaceholderText("pages.inspection.actions.form.titlePlaceholder"),
      "Fix lighting"
    )
    await userEvent.type(
      screen.getByPlaceholderText("pages.inspection.actions.form.descriptionPlaceholder"),
      "Replace emergency lighting."
    )
    await userEvent.type(
      document.querySelector('input[type="date"]') as HTMLElement,
      "2026-08-01"
    )
    await userEvent.click(screen.getByText("pages.inspection.actions.createAction"))

    await waitFor(() =>
      expect(screen.getByText("Duplicate title")).toBeInTheDocument()
    )
  })

  it("opens the edit form when the edit button is clicked", async () => {
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: { ...emptyResponse, data: [makeAction()] },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() => screen.getByText("Replace extinguisher"))

    await userEvent.click(screen.getByLabelText("pages.inspection.actions.editAction"))
    expect(screen.getByText("pages.inspection.actions.editActionFormTitle")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Replace extinguisher")).toBeInTheDocument()
  })

  it("opens the edit form for an action with a null actionDisc without a controlled-input warning (aexa-server#173 -- actionDisc is now optional/nullable)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: { ...emptyResponse, data: [makeAction({ actionDisc: null })] },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() => screen.getByText("Replace extinguisher"))

    await userEvent.click(screen.getByLabelText("pages.inspection.actions.editAction"))
    expect(screen.getByText("pages.inspection.actions.editActionFormTitle")).toBeInTheDocument()
    expect(
      consoleError.mock.calls.some((args) =>
        String(args[0]).includes("a component is changing an uncontrolled input")
      )
    ).toBe(false)

    consoleError.mockRestore()
  })

  it("submits the edit form via updateFindingById with { id, body } shape", async () => {
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: { ...emptyResponse, data: [makeAction()] },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() => screen.getByText("Replace extinguisher"))

    await userEvent.click(screen.getByLabelText("pages.inspection.actions.editAction"))
    const titleInput = screen.getByDisplayValue("Replace extinguisher")
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, "Updated title")
    await userEvent.click(screen.getByText("pages.inspection.actions.saveChanges"))

    await waitFor(() =>
      expect(mockUpdateFindingById).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "act-1",
          body: expect.objectContaining({ actionTitle: "Updated title" }),
        })
      )
    )
  })

  it("allows editing an overdue action without resetting its past due date", async () => {
    const overdueAction = makeAction({ dueDate: "2020-01-15T00:00:00.000Z" })
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: { ...emptyResponse, data: [overdueAction] },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() => screen.getByText("Replace extinguisher"))

    await userEvent.click(screen.getByLabelText("pages.inspection.actions.editAction"))
    const dateInput = screen.getByLabelText(
      "pages.inspection.actions.form.dueDateLabel"
    )
    expect(dateInput).toHaveValue("2020-01-15")
    expect(dateInput).not.toHaveAttribute("min")

    await userEvent.click(screen.getByText("pages.inspection.actions.saveChanges"))

    await waitFor(() =>
      expect(mockUpdateFindingById).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "act-1",
          body: expect.objectContaining({
            dueDate: "2020-01-15T00:00:00.000Z",
          }),
        })
      )
    )
  })

  it("shows inline delete confirm and calls deleteFindingById on confirm", async () => {
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: { ...emptyResponse, data: [makeAction()] },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() => screen.getByText("Replace extinguisher"))

    await userEvent.click(screen.getByLabelText("pages.inspection.actions.deleteAction"))
    expect(screen.getByText("pages.inspection.actions.deleteConfirm")).toBeInTheDocument()

    await userEvent.click(screen.getByText("pages.inspection.actions.delete"))
    await waitFor(() =>
      expect(mockDeleteFindingById).toHaveBeenCalledWith("act-1")
    )
  })

  it("calls updateFindingById with { id, body: { status } } via select change and disables it while pending", async () => {
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: { ...emptyResponse, data: [makeAction()] },
      isLoading: false,
      isError: false,
    })
    let resolveUpdate: (v: unknown) => void = () => {}
    mockUpdateFindingById.mockReturnValue({
      unwrap: () =>
        new Promise((resolve) => {
          resolveUpdate = resolve
        }),
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText("Replace extinguisher")).toBeInTheDocument()
    )

    const select = screen.getByDisplayValue("pages.inspection.actions.statusToDo")
    await userEvent.selectOptions(select, "IN_PROGRESS")

    expect(mockUpdateFindingById).toHaveBeenCalledWith({
      id: "act-1",
      body: { status: "IN_PROGRESS" },
    })
    expect(select).toBeDisabled()

    resolveUpdate({})
    await waitFor(() => expect(select).not.toBeDisabled())
  })

  it("shows a toast error and re-enables the select when a status update fails", async () => {
    const { toast } = await import("sonner")
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: { ...emptyResponse, data: [makeAction()] },
      isLoading: false,
      isError: false,
    })
    mockUpdateFindingById.mockReturnValue({
      unwrap: () => Promise.reject({ data: { message: "Server unavailable" } }),
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText("Replace extinguisher")).toBeInTheDocument()
    )

    const select = screen.getByDisplayValue("pages.inspection.actions.statusToDo")
    await userEvent.selectOptions(select, "IN_PROGRESS")

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Server unavailable")
    )
    await waitFor(() => expect(select).not.toBeDisabled())
  })

  it("falls back to a generic status-update error message when the rejection has no data.message", async () => {
    const { toast } = await import("sonner")
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: { ...emptyResponse, data: [makeAction()] },
      isLoading: false,
      isError: false,
    })
    mockUpdateFindingById.mockReturnValue({
      unwrap: () => Promise.reject({}),
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText("Replace extinguisher")).toBeInTheDocument()
    )

    const select = screen.getByDisplayValue("pages.inspection.actions.statusToDo")
    await userEvent.selectOptions(select, "IN_PROGRESS")

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("pages.inspection.actions.statusUpdateFailed")
    )
  })

  // aexa-server#252 / aexa-frontend#214: COMPLETE/CANT_DO can now only be
  // reached via an approved closure request -- a direct PATCH sending
  // either as `status` 400s, even as a no-op resend of the finding's own
  // current value. Found during review of #214 -- this file wasn't fixed
  // when CreateNewFindingModal.tsx got the equivalent fix.
  describe("closed findings (#214)", () => {
    it("shows status read-only (no select) for an already-COMPLETE finding", async () => {
      mockUseGetAllFindingsQuery.mockReturnValue({
        data: { ...emptyResponse, data: [makeAction({ status: "COMPLETE" })] },
        isLoading: false,
        isError: false,
      })
      renderPage()
      await waitFor(() =>
        expect(screen.getByText("Replace extinguisher")).toBeInTheDocument()
      )

      expect(
        screen.getByText("pages.inspection.actions.statusComplete")
      ).toBeInTheDocument()
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    })

    it("shows status read-only (no select) for an already-CANT_DO finding", async () => {
      mockUseGetAllFindingsQuery.mockReturnValue({
        data: { ...emptyResponse, data: [makeAction({ status: "CANT_DO" })] },
        isLoading: false,
        isError: false,
      })
      renderPage()
      await waitFor(() =>
        expect(screen.getByText("Replace extinguisher")).toBeInTheDocument()
      )

      expect(
        screen.getByText("pages.inspection.actions.statusCantDo")
      ).toBeInTheDocument()
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    })

    it("only offers TO_DO and IN_PROGRESS for a non-closed finding -- no COMPLETE/CANT_DO option exists", async () => {
      mockUseGetAllFindingsQuery.mockReturnValue({
        data: { ...emptyResponse, data: [makeAction({ status: "IN_PROGRESS" })] },
        isLoading: false,
        isError: false,
      })
      renderPage()
      await waitFor(() =>
        expect(screen.getByText("Replace extinguisher")).toBeInTheDocument()
      )

      const select = screen.getByDisplayValue(
        "pages.inspection.actions.statusInProgress"
      ) as HTMLSelectElement
      const optionValues = Array.from(select.options).map((o) => o.value)
      expect(optionValues).toEqual(["TO_DO", "IN_PROGRESS"])
    })
  })

  it("shows a subtle refreshing indicator during a background refetch (not just initial load)", async () => {
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: { ...emptyResponse, data: [makeAction()] },
      isLoading: false,
      isFetching: true,
      isError: false,
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText("Replace extinguisher")).toBeInTheDocument()
    )
    expect(screen.getByLabelText("pages.inspection.actions.refreshing")).toBeInTheDocument()
  })

  it("displays image attachments on action cards", async () => {
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: {
        ...emptyResponse,
        data: [makeAction({ attachments: ["/uploads/photo.jpg"] })],
      },
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() => screen.getByText("Replace extinguisher"))
    const img = document.querySelector(
      'img[alt="pages.inspection.actions.attachment"]'
    ) as HTMLImageElement
    expect(img).toBeInTheDocument()
    expect(img.src).toContain("/uploads/photo.jpg")
  })

  it("shows an attach file input in the create form", async () => {
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: emptyResponse,
      isLoading: false,
      isError: false,
    })
    renderPage()
    await waitFor(() => screen.getByText("pages.inspection.actions.empty"))
    await userEvent.click(screen.getByText("pages.inspection.actions.newAction"))
    // The hidden file input should be present in the DOM
    expect(document.querySelector('input[type="file"]')).toBeInTheDocument()
  })

  // Attachment upload is intentionally left as an unconverted raw fetch call
  // (no RTK Query endpoint exists for POST /api/action/attachment yet — see
  // aexa-server issue #20) — these two tests spy on global fetch directly.
  it("uploads an attachment successfully", async () => {
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: emptyResponse,
      isLoading: false,
      isError: false,
    })

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          url: "/uploads/test.png",
        },
      }),
    } as Response)

    renderPage()

    await waitFor(() => screen.getByText("pages.inspection.actions.empty"))

    await userEvent.click(screen.getByText("pages.inspection.actions.newAction"))

    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement

    const file = new File(["hello"], "test.png", {
      type: "image/png",
    })

    await userEvent.upload(input, file)

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
    })

    fetchSpy.mockRestore()
  })
  it("shows a toast error when an attachment upload throws (aexa-frontend#242 -- this used to fail silently, leaving the user thinking the file attached when it didn't)", async () => {
    const { toast } = await import("sonner")
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: emptyResponse,
      isLoading: false,
      isError: false,
    })

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Upload failed"))

    renderPage()

    await waitFor(() => screen.getByText("pages.inspection.actions.empty"))

    await userEvent.click(screen.getByText("pages.inspection.actions.newAction"))

    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement

    const file = new File(["hello"], "test.png", {
      type: "image/png",
    })

    await userEvent.upload(input, file)

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
    })
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "pages.inspection.actions.uploadFailed"
      )
    )

    fetchSpy.mockRestore()
  })

  it("shows a toast error when the upload response has no ok flag (aexa-frontend#242)", async () => {
    const { toast } = await import("sonner")
    mockUseGetAllFindingsQuery.mockReturnValue({
      data: emptyResponse,
      isLoading: false,
      isError: false,
    })

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response)

    renderPage()

    await waitFor(() => screen.getByText("pages.inspection.actions.empty"))
    await userEvent.click(screen.getByText("pages.inspection.actions.newAction"))

    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    const file = new File(["hello"], "test.png", { type: "image/png" })

    await userEvent.upload(input, file)

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "pages.inspection.actions.uploadFailed"
      )
    )

    fetchSpy.mockRestore()
  })
})
