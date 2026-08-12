/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import CreateNewFindingModal from "./CreateNewFindingModal"
import { toLocalDatetimeInputValue } from "./dueDateInput"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const mockUploadFile = vi.fn()
vi.mock("@/redux/apis/common.api", () => ({
  useUploadAnyFileAwsMutation: () => [mockUploadFile],
}))

const mockCreateNewFinding = vi.fn()
const mockUpdateFindingById = vi.fn()
const mockAddFindingMessage = vi.fn()
const mockGetFindingById = vi.fn<
  (
    id: string,
    options?: { skip?: boolean }
  ) => { data: unknown; isError?: boolean }
>(() => ({
  data: undefined,
}))
vi.mock("@/redux/apis/organization/findings.api", () => ({
  useCreateNewFindingMutation: () => [
    mockCreateNewFinding,
    { isLoading: false },
  ],
  useUpdateFindingByIdMutation: () => [
    mockUpdateFindingById,
    { isLoading: false },
  ],
  useAddFindingMessageMutation: () => [
    mockAddFindingMessage,
    { isLoading: false },
  ],
  useGetFindingByIdQuery: (id: string, options?: { skip?: boolean }) =>
    mockGetFindingById(id, options),
}))

const mockInspections = vi.fn<
  () => {
    data: { data: { id: string; template: { templateName: string } }[] }
    isLoading: boolean
  }
>(() => ({
  data: {
    data: [
      {
        id: "insp-1",
        template: { templateName: "Daily Safety Checklist" },
      },
    ],
  },
  isLoading: false,
}))
vi.mock("@/redux/apis/organization/inspection.api", () => ({
  useGetAllInspectionQuery: () => mockInspections(),
}))

const mockOrgUsers = vi.fn(() => ({
  data: {
    data: [] as {
      id: string
      account?: { email?: string; profile?: { fullName?: string } }
    }[],
  },
  isLoading: false,
}))
vi.mock("@/redux/apis/organization/org.user.api", () => ({
  useGetAllOrgUsersQuery: () => mockOrgUsers(),
}))

function makeEditData(overrides = {}) {
  return {
    id: "finding-1",
    orgAccountId: "org-1",
    inspectionId: "insp-1",
    siteId: "site-1",
    questionId: "question-1",
    actionTitle: "Fix broken railing",
    actionDisc: "Railing on level 2 is loose.",
    priority: "High",
    dueDate: "2099-07-01T00:00:00.000Z",
    status: "TO_DO",
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
    messages: [],
    assignBy: [],
    attachments: ["https://cdn.example.com/existing.png"],
    ...overrides,
  }
}

describe("CreateNewFindingModal", () => {
  beforeEach(async () => {
    mockUploadFile.mockReset()
    mockCreateNewFinding.mockReset()
    mockUpdateFindingById.mockReset()
    mockAddFindingMessage.mockReset()
    mockGetFindingById.mockReset()
    mockGetFindingById.mockReturnValue({ data: undefined })
    const { toast } = await import("sonner")
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    vi.mocked(toast.info).mockClear()
    // quality-bar-loop (Inspections, round 29 review finding): this was
    // missing before -- a test that overrides mockOrgUsers with
    // `isError: true` (see the "query failure indicators" describe block)
    // left that override in place for every test that runs after it,
    // relying on later tests happening not to touch the assignees
    // dropdown rather than genuinely resetting state.
    mockOrgUsers.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })
    mockInspections.mockReturnValue({
      data: {
        data: [
          {
            id: "insp-1",
            template: { templateName: "Daily Safety Checklist" },
          },
        ],
      },
      isLoading: false,
    })
  })

  it("keys Inspection dropdown options by the real InspectionSummary shape (id only, no _id) without a React key warning (#120)", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {})

    mockInspections.mockReturnValue({
      data: {
        data: [
          { id: "insp-1", template: { templateName: "Daily Safety" } },
          { id: "insp-2", template: { templateName: "Weekly Fire Check" } },
          { id: "insp-3", template: { templateName: "Monthly Electrical" } },
        ],
      },
      isLoading: false,
    })

    render(<CreateNewFindingModal open onClose={vi.fn()} />)

    expect(screen.getByText("Daily Safety")).toBeInTheDocument()
    expect(screen.getByText("Weekly Fire Check")).toBeInTheDocument()
    expect(screen.getByText("Monthly Electrical")).toBeInTheDocument()

    const keyWarning = consoleError.mock.calls.some((args) =>
      String(args[0]).includes('Each child in a list should have a unique "key" prop')
    )
    expect(keyWarning).toBe(false)

    consoleError.mockRestore()
  })

  // quality-bar-loop (Inspections, round 29 accessibility finding): every
  // <label> in this form was a visual-only sibling of its control -- no
  // htmlFor, no wrapping -- so 8 of 10 fields had zero programmatic label
  // association despite visible label text next to each one. getByLabelText
  // only succeeds via a real id/htmlFor (or aria-label/aria-labelledby)
  // association, so these assertions fail if that wiring regresses.
  it("gives every form field a real accessible name via htmlFor/id or aria-label, not just visual-adjacent text", async () => {
    render(<CreateNewFindingModal open onClose={vi.fn()} />)

    expect(
      screen.getByLabelText("organization.findings.actionTitleLabel")
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("organization.findings.descriptionOptional")
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("organization.findings.inspectionLabel")
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("organization.findings.priority")
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("organization.findings.statusLabel")
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("organization.findings.dueDateLabel")
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("organization.findings.uploadMedia")
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("organization.findings.addUpdatePlaceholder")
    ).toBeInTheDocument()
    // Line of Defense was already correctly associated before this round --
    // included here as a same-pattern sanity check, not a new fix.
    expect(
      screen.getByLabelText("organization.findings.lineOfDefenseLabel")
    ).toBeInTheDocument()
  })

  // quality-bar-loop (Inspections, round 30 accessibility finding, round
  // 31 fix): round 29's otherwise-complete label-association pass on this
  // component missed the Five Cs fields -- same visual-only-label defect,
  // just inside the collapsible section so it wasn't caught by the
  // always-visible fields the earlier test covers.
  it("gives the Five Cs fields a real accessible name once the section is expanded", async () => {
    render(<CreateNewFindingModal open onClose={vi.fn()} />)

    await userEvent.click(
      screen.getByText("organization.findings.fiveCsSectionTitle")
    )

    expect(
      screen.getByLabelText("organization.findings.criteriaLabel")
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("organization.findings.conditionLabel")
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("organization.findings.causeLabel")
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("organization.findings.effectLabel")
    ).toBeInTheDocument()
  })

  it("does not point the Status label at a nonexistent control when the finding is closed (read-only status)", async () => {
    render(
      <CreateNewFindingModal
        open
        onClose={vi.fn()}
        editData={makeEditData({ status: "COMPLETE" }) as any}
      />
    )
    await waitFor(() =>
      expect(screen.getByDisplayValue("Fix broken railing")).toBeInTheDocument()
    )
    // A closed finding renders status as a read-only <span>, not a <select>
    // -- getByLabelText would throw if the label's htmlFor pointed at an id
    // that doesn't exist in the DOM in this state.
    expect(screen.queryByRole("combobox", { name: /status/i })).not.toBeInTheDocument()
  })

  it("sends questionId (not question) in the request body when a question is selected", async () => {
    mockCreateNewFinding.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })

    render(
      <CreateNewFindingModal
        open
        onClose={vi.fn()}
        additionalData={{ questionId: "question-42" }}
      />
    )

    await userEvent.type(
      screen.getByPlaceholderText("organization.findings.actionTitlePlaceholder"),
      "New finding"
    )
    await userEvent.selectOptions(
      screen.getByLabelText("organization.findings.lineOfDefenseLabel"),
      "FIRST"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.findings.createFindingBtn" })
    )

    await waitFor(() => expect(mockCreateNewFinding).toHaveBeenCalled())
    const payload = mockCreateNewFinding.mock.calls[0][0]
    expect(payload).toHaveProperty("questionId", "question-42")
    expect(payload).not.toHaveProperty("question")
  })

  it("sends complianceObligationId from additionalData on create (aexa-frontend#166)", async () => {
    mockCreateNewFinding.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })

    render(
      <CreateNewFindingModal
        open
        onClose={vi.fn()}
        additionalData={{
          actionTitle: "Remediate: GDPR Article 30 records",
          complianceObligationId: "comp-99",
        }}
      />
    )

    // Title comes pre-filled from additionalData — no typing needed.
    await userEvent.selectOptions(
      screen.getByLabelText("organization.findings.lineOfDefenseLabel"),
      "FIRST"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.findings.createFindingBtn" })
    )

    await waitFor(() => expect(mockCreateNewFinding).toHaveBeenCalled())
    const payload = mockCreateNewFinding.mock.calls[0][0]
    expect(payload).toHaveProperty("complianceObligationId", "comp-99")
    expect(payload.actionTitle).toBe("Remediate: GDPR Article 30 records")
  })

  it("does NOT send complianceObligationId when editing an existing finding (create-only, aexa-server#226)", async () => {
    mockUpdateFindingById.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })

    render(
      <CreateNewFindingModal
        open
        onClose={vi.fn()}
        editData={makeEditData() as any}
        // Even if some caller passed it, an edit must never carry it.
        additionalData={{ complianceObligationId: "comp-99" }}
      />
    )

    await waitFor(() =>
      expect(screen.getByDisplayValue("Fix broken railing")).toBeInTheDocument()
    )

    await userEvent.click(
      screen.getByRole("button", { name: "organization.findings.updateFindingBtn" })
    )

    await waitFor(() => expect(mockUpdateFindingById).toHaveBeenCalled())
    const call = mockUpdateFindingById.mock.calls[0][0]
    expect(call.body).not.toHaveProperty("complianceObligationId")
    expect(mockCreateNewFinding).not.toHaveBeenCalled()
  })

  it("includes uploaded media URLs in the payload after uploading a file", async () => {
    mockUploadFile.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ data: "https://cdn.example.com/new.png" }),
    })
    mockCreateNewFinding.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })

    render(<CreateNewFindingModal open onClose={vi.fn()} />)

    await userEvent.type(
      screen.getByPlaceholderText("organization.findings.actionTitlePlaceholder"),
      "New finding with media"
    )

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    const file = new File(["hello"], "photo.png", { type: "image/png" })
    await userEvent.upload(fileInput, file)

    await waitFor(() => expect(mockUploadFile).toHaveBeenCalled())

    await userEvent.selectOptions(
      screen.getByLabelText("organization.findings.lineOfDefenseLabel"),
      "FIRST"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.findings.createFindingBtn" })
    )

    await waitFor(() => expect(mockCreateNewFinding).toHaveBeenCalled())
    const payload = mockCreateNewFinding.mock.calls[0][0]
    expect(payload.attachments).toContain("https://cdn.example.com/new.png")
  })

  // Regression (aexa-frontend#489): the media preview always rendered an
  // <img>, even for a video upload (the input accepts "image/*,video/*"),
  // producing a broken-image icon. A video upload must render a <video>
  // preview instead.
  it("renders a <video> preview (not a broken <img>) after uploading a video file", async () => {
    mockUploadFile.mockReturnValue({
      unwrap: () =>
        Promise.resolve({ data: "https://cdn.example.com/clip.mp4" }),
    })

    render(<CreateNewFindingModal open onClose={vi.fn()} />)

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    const file = new File(["hello"], "clip.mp4", { type: "video/mp4" })
    await userEvent.upload(fileInput, file)

    await waitFor(() => expect(mockUploadFile).toHaveBeenCalled())

    await waitFor(() => {
      const video = document.querySelector(
        'video[src="https://cdn.example.com/clip.mp4"]'
      )
      expect(video).toBeInTheDocument()
    })
    expect(
      document.querySelector('img[src="https://cdn.example.com/clip.mp4"]')
    ).not.toBeInTheDocument()
  })

  // quality-bar-loop (Inspections, round 28 review finding): this modal is
  // now also opened by InspectionActions.tsx with editData.actionDisc
  // potentially null (aexa-server#173 -- actionDisc is optional/nullable at
  // the DB level) -- previously only covered by InspectionActions.tsx's own
  // now-deleted local-form test, leaving this integration point untested.
  it("opens for edit with a null actionDisc without a controlled-input warning (aexa-server#173)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    render(
      <CreateNewFindingModal
        open
        onClose={vi.fn()}
        editData={makeEditData({ actionDisc: null }) as any}
      />
    )

    await waitFor(() =>
      expect(screen.getByDisplayValue("Fix broken railing")).toBeInTheDocument()
    )
    expect(
      consoleError.mock.calls.some((args) =>
        String(args[0]).includes("a component is changing an uncontrolled input")
      )
    ).toBe(false)

    consoleError.mockRestore()
  })

  // quality-bar-loop (Inspections, round 28 review finding): InspectionActions.tsx
  // only ever passes additionalData={{ inspectionId }} (no actionTitle/
  // questionId/complianceObligationId) -- every other test above exercises a
  // richer additionalData shape, leaving this specific bare-inspectionId
  // integration untested.
  it("sends inspectionId from a bare additionalData={{ inspectionId }} shape on create", async () => {
    mockCreateNewFinding.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })

    render(
      <CreateNewFindingModal
        open
        onClose={vi.fn()}
        additionalData={{ inspectionId: "insp-1" }}
      />
    )

    await userEvent.type(
      screen.getByPlaceholderText("organization.findings.actionTitlePlaceholder"),
      "Bare inspectionId finding"
    )
    await userEvent.selectOptions(
      screen.getByLabelText("organization.findings.lineOfDefenseLabel"),
      "FIRST"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.findings.createFindingBtn" })
    )

    await waitFor(() => expect(mockCreateNewFinding).toHaveBeenCalled())
    const payload = mockCreateNewFinding.mock.calls[0][0]
    expect(payload).toHaveProperty("inspectionId", "insp-1")
  })

  // aexa-frontend#242-equivalent for this modal's own upload path: the old
  // InspectionActions.tsx local form had a dedicated test for an upload
  // failure toast; that coverage didn't move with the upload logic into
  // this modal (round 28 review finding) -- only the success path was
  // tested here.
  it("shows a toast error when a media upload fails", async () => {
    const { toast } = await import("sonner")
    mockUploadFile.mockReturnValue({
      unwrap: () => Promise.reject(new Error("Upload failed")),
    })

    render(<CreateNewFindingModal open onClose={vi.fn()} />)

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    const file = new File(["hello"], "photo.png", { type: "image/png" })
    await userEvent.upload(fileInput, file)

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "organization.findings.mediaUploadFailed"
      )
    )
  })

  // quality-bar-loop (Inspections, round 29 mobile finding): the dialog's
  // `min-w-xl` (min-width: 576px) applied unconditionally, forcing the
  // modal to overflow off-screen at mobile viewports with no way to
  // dismiss it (onInteractOutside/onEscapeKeyDown are both suppressed, and
  // the close button rendered off-screen along with the rest of the
  // dialog). Scoped the min-width to `sm:` and up so mobile falls back to
  // the base DialogContent's viewport-safe `max-w-[calc(100%-2rem)]`.
  it("does not force a fixed minimum dialog width below the sm breakpoint", () => {
    render(<CreateNewFindingModal open onClose={vi.fn()} />)
    const dialog = document.querySelector('[data-slot="dialog-content"]')
    expect(dialog).toBeInTheDocument()
    expect(dialog?.className).toContain("sm:min-w-xl")
    expect(dialog?.className).not.toMatch(/(?<!sm:)\bmin-w-xl\b/)
  })

  // jsdom doesn't do real layout, so this can't assert computed width at a
  // viewport -- it guards the narrower, still-real regression of someone
  // dropping the `sm:` desktop sizing entirely while fixing the mobile bug
  // (e.g. removing min-w-xl outright), which would silently shrink the
  // dialog to the base DialogContent's much smaller `sm:max-w-sm` (384px)
  // at desktop widths too.
  it("still requests the wider desktop sizing at the sm breakpoint and up", () => {
    render(<CreateNewFindingModal open onClose={vi.fn()} />)
    const dialog = document.querySelector('[data-slot="dialog-content"]')
    expect(dialog?.className).toContain("max-w-xl")
    expect(dialog?.className).toContain("sm:min-w-xl")
  })

  it("gives the Status label a real accessible name that combines with its value when the finding is closed (read-only, no <select> to htmlFor)", async () => {
    render(
      <CreateNewFindingModal
        open
        onClose={vi.fn()}
        editData={makeEditData({ status: "COMPLETE" }) as any}
      />
    )
    await waitFor(() =>
      expect(screen.getByDisplayValue("Fix broken railing")).toBeInTheDocument()
    )
    const statusText = screen.getByText(
      "organization.findings.statusComplete"
    )
    expect(statusText.getAttribute("aria-labelledby")).toMatch(/\S+ \S+/)
  })

  // quality-bar-loop (Inspections, round 29 security finding): media
  // previews (sourced from editData.attachments -- server-returned,
  // pre-existing-record data) rendered straight into <img src>/<video src>
  // with no isHttpUrl guard, unlike every other attachment sink in this
  // codebase.
  it("does not render a non-http(s) media attachment URL into an img/video src", async () => {
    render(
      <CreateNewFindingModal
        open
        onClose={vi.fn()}
        editData={
          makeEditData({
            attachments: [
              "javascript:alert(1)",
              "https://cdn.example.com/existing.png",
            ],
          }) as any
        }
      />
    )

    await waitFor(() =>
      expect(screen.getByDisplayValue("Fix broken railing")).toBeInTheDocument()
    )
    expect(
      document.querySelector('img[src="https://cdn.example.com/existing.png"]')
    ).toBeInTheDocument()
    expect(document.querySelector('[src^="javascript:"]')).not.toBeInTheDocument()
  })

  // quality-bar-loop (Inspections, round 29 resilience finding): a failed
  // fetch on any of these three queries used to silently show just the
  // placeholder/empty state, with nothing distinguishing "no data" from
  // "couldn't load".
  describe("query failure indicators (round 29 resilience finding)", () => {
    it("shows an inline error under the Inspection dropdown when the inspections fetch fails", async () => {
      mockInspections.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      } as any)

      render(<CreateNewFindingModal open onClose={vi.fn()} />)

      expect(
        screen.getByText("organization.findings.inspectionsLoadFailed")
      ).toBeInTheDocument()
    })

    it("shows an inline error in the Assignees dropdown when the org-users fetch fails", async () => {
      mockOrgUsers.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      } as any)

      render(<CreateNewFindingModal open onClose={vi.fn()} />)
      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.findings.addAssignees",
        })
      )

      expect(
        screen.getByText("organization.findings.usersLoadFailed")
      ).toBeInTheDocument()
    })

    it("shows an inline error instead of a silently-empty conversation when the finding-detail fetch fails on edit", async () => {
      mockGetFindingById.mockReturnValue({ data: undefined, isError: true })

      render(
        <CreateNewFindingModal
          open
          onClose={vi.fn()}
          editData={makeEditData({ messages: [] }) as any}
        />
      )

      await waitFor(() =>
        expect(screen.getByDisplayValue("Fix broken railing")).toBeInTheDocument()
      )
      expect(
        screen.getByText("organization.findings.conversationLoadFailed")
      ).toBeInTheDocument()
    })

    it("does not show the conversation error on create (no detail fetch to fail)", async () => {
      mockGetFindingById.mockReturnValue({ data: undefined, isError: true })

      render(<CreateNewFindingModal open onClose={vi.fn()} />)

      expect(
        screen.queryByText("organization.findings.conversationLoadFailed")
      ).not.toBeInTheDocument()
    })
  })

  it("normalizes editData.assignBy ({id, name} objects) to raw user ids and preserves them on submit", async () => {
    mockOrgUsers.mockReturnValue({
      data: {
        data: [
          { id: "user-1", account: { profile: { fullName: "Alice" } } },
          { id: "user-2", account: { profile: { fullName: "Bob" } } },
        ],
      },
      isLoading: false,
    })
    mockUpdateFindingById.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })

    render(
      <CreateNewFindingModal
        open
        onClose={vi.fn()}
        editData={
          makeEditData({
            assignBy: [{ id: "user-1", name: "Alice" }],
          }) as any
        }
      />
    )

    await waitFor(() =>
      expect(screen.getByDisplayValue("Fix broken railing")).toBeInTheDocument()
    )

    const assigneesTrigger = screen
      .getByText("organization.findings.assignees")
      .closest("div")
      ?.querySelector("button") as HTMLButtonElement
    await userEvent.click(assigneesTrigger)

    // "Alice" now also appears on the trigger button itself (the display
    // text this test's own bug fix restored), so disambiguate to the
    // dropdown list item specifically.
    const aliceCheckbox = screen
      .getAllByText("Alice")
      .find((el) => el.closest("label"))
      ?.closest("label")
      ?.querySelector('input[type="checkbox"]') as HTMLInputElement
    const bobCheckbox = screen
      .getByText("Bob")
      .closest("label")
      ?.querySelector('input[type="checkbox"]') as HTMLInputElement

    // The previously-assigned user must show as checked — this is the bug:
    // editData.assignBy holds {id, name} objects, but the checkbox compared
    // field.value.includes(user.id), which is always false against objects.
    expect(aliceCheckbox.checked).toBe(true)
    expect(bobCheckbox.checked).toBe(false)

    await userEvent.click(
      screen.getByRole("button", { name: "organization.findings.updateFindingBtn" })
    )

    await waitFor(() => expect(mockUpdateFindingById).toHaveBeenCalled())
    const call = mockUpdateFindingById.mock.calls[0][0]
    // Must be a flat array of ids, not a mix of ids and {id, name} objects.
    expect(call.body.assignBy).toEqual(["user-1"])
  })

  it("preserves pre-existing attachments in the payload when editing a finding", async () => {
    mockUpdateFindingById.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })

    render(
      <CreateNewFindingModal
        open
        onClose={vi.fn()}
        editData={makeEditData() as any}
      />
    )

    await waitFor(() =>
      expect(screen.getByDisplayValue("Fix broken railing")).toBeInTheDocument()
    )

    await userEvent.click(
      screen.getByRole("button", { name: "organization.findings.updateFindingBtn" })
    )

    await waitFor(() => expect(mockUpdateFindingById).toHaveBeenCalled())
    const call = mockUpdateFindingById.mock.calls[0][0]
    expect(call.id).toBe("finding-1")
    expect(call.body.attachments).toContain(
      "https://cdn.example.com/existing.png"
    )
  })

  it("renders assignee name/email from the real /organization/members shape (id + nested account.profile.fullName), not the old mock _id/firstName shape (#40)", async () => {
    mockOrgUsers.mockReturnValue({
      data: {
        data: [
          {
            id: "member-1",
            account: {
              email: "auditor@test.com",
              profile: { fullName: "Auditor One" },
            },
          },
          // No profile.fullName set — must fall back to email, not render blank.
          { id: "member-2", account: { email: "noname@test.com" } },
        ],
      },
      isLoading: false,
    })
    mockCreateNewFinding.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })

    render(<CreateNewFindingModal open onClose={vi.fn()} />)

    const assigneesTrigger = screen
      .getByText("organization.findings.assignees")
      .closest("div")
      ?.querySelector("button") as HTMLButtonElement
    await userEvent.click(assigneesTrigger)

    expect(screen.getByText("Auditor One")).toBeInTheDocument()
    expect(screen.getByText("auditor@test.com")).toBeInTheDocument()
    // No profile.fullName on member-2, so the name line falls back to the
    // email — it legitimately renders twice (name line + email line).
    expect(screen.getAllByText("noname@test.com")).toHaveLength(2)

    const memberOneCheckbox = screen
      .getByText("Auditor One")
      .closest("label")
      ?.querySelector('input[type="checkbox"]') as HTMLInputElement
    await userEvent.click(memberOneCheckbox)

    await userEvent.type(
      screen.getByPlaceholderText("organization.findings.actionTitlePlaceholder"),
      "Finding with real member shape"
    )
    await userEvent.selectOptions(
      screen.getByLabelText("organization.findings.lineOfDefenseLabel"),
      "FIRST"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.findings.createFindingBtn" })
    )

    await waitFor(() => expect(mockCreateNewFinding).toHaveBeenCalled())
    const payload = mockCreateNewFinding.mock.calls[0][0]
    expect(payload.assignBy).toEqual(["member-1"])
  })

  // Regression (round 3 audit): the assignees button's display text was
  // commented out entirely -- getSelectedUserNames existed but was never
  // called, and even uncommented it compared the wrong id/name fields
  // (u._id/u.firstName) against the real user shape (user.id/
  // user.account.profile.fullName), so it would've silently shown nothing
  // useful either way. Both are fixed together here.
  it("shows placeholder, single-name, and count text on the assignees button as selection changes", async () => {
    mockOrgUsers.mockReturnValue({
      data: {
        data: [
          { id: "user-1", account: { profile: { fullName: "Alice" } } },
          { id: "user-2", account: { profile: { fullName: "Bob" } } },
        ],
      },
      isLoading: false,
    })

    render(<CreateNewFindingModal open onClose={vi.fn()} />)

    const assigneesTrigger = screen
      .getByText("organization.findings.assignees")
      .closest("div")
      ?.querySelector("button") as HTMLButtonElement
    expect(assigneesTrigger).toHaveTextContent(
      "organization.findings.addAssignees"
    )

    await userEvent.click(assigneesTrigger)
    await userEvent.click(
      screen
        .getByText("Alice")
        .closest("label")
        ?.querySelector('input[type="checkbox"]') as HTMLInputElement
    )
    expect(assigneesTrigger).toHaveTextContent("Alice")

    await userEvent.click(
      screen
        .getByText("Bob")
        .closest("label")
        ?.querySelector('input[type="checkbox"]') as HTMLInputElement
    )
    expect(assigneesTrigger).toHaveTextContent(
      "organization.findings.multipleUsersSelected"
    )
  })

  // Regression (aexa-frontend round-9 audit #469): the Assignees dropdown
  // toggle had no aria-expanded/aria-haspopup, unlike other disclosure
  // controls in the app, so screen-reader users got no indication it was a
  // listbox toggle or of its open/closed state.
  it("marks the Assignees dropdown toggle with aria-haspopup/aria-expanded that tracks open state", async () => {
    mockOrgUsers.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    })

    render(<CreateNewFindingModal open onClose={vi.fn()} />)

    const assigneesTrigger = screen
      .getByText("organization.findings.assignees")
      .closest("div")
      ?.querySelector("button") as HTMLButtonElement
    expect(assigneesTrigger).toHaveAttribute("aria-haspopup", "true")
    expect(assigneesTrigger).toHaveAttribute("aria-expanded", "false")

    await userEvent.click(assigneesTrigger)
    expect(assigneesTrigger).toHaveAttribute("aria-expanded", "true")
  })

  // Round 12 audit (aexa-frontend#498): the Five Cs collapsible toggle had no
  // aria-expanded, unlike the Assignees dropdown toggle a few lines away in
  // this same file, which already sets it correctly.
  it("marks the Five Cs toggle with aria-expanded that tracks open state", async () => {
    render(<CreateNewFindingModal open onClose={vi.fn()} />)

    const fiveCsTrigger = screen.getByText(
      "organization.findings.fiveCsSectionTitle"
    ).closest("button") as HTMLButtonElement
    expect(fiveCsTrigger).toHaveAttribute("aria-expanded", "false")

    await userEvent.click(fiveCsTrigger)
    expect(fiveCsTrigger).toHaveAttribute("aria-expanded", "true")
  })

  // aexa-server#244 / aexa-frontend#213: IIA's "Five Cs" fields on a finding.
  it("does not send criteria/condition/cause/effect when the Five Cs section is left untouched (create)", async () => {
    mockCreateNewFinding.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })

    render(<CreateNewFindingModal open onClose={vi.fn()} />)

    await userEvent.type(
      screen.getByPlaceholderText("organization.findings.actionTitlePlaceholder"),
      "Plain remediation task"
    )
    await userEvent.selectOptions(
      screen.getByLabelText("organization.findings.lineOfDefenseLabel"),
      "FIRST"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.findings.createFindingBtn" })
    )

    await waitFor(() => expect(mockCreateNewFinding).toHaveBeenCalled())
    const payload = mockCreateNewFinding.mock.calls[0][0]
    expect(payload.criteria).toBeUndefined()
    expect(payload.condition).toBeUndefined()
    expect(payload.cause).toBeUndefined()
    expect(payload.effect).toBeUndefined()
  })

  it("sends trimmed criteria/condition/cause/effect when the Five Cs section is filled in (create)", async () => {
    mockCreateNewFinding.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })

    render(<CreateNewFindingModal open onClose={vi.fn()} />)

    await userEvent.click(
      screen.getByText("organization.findings.fiveCsSectionTitle")
    )

    await userEvent.type(
      screen.getByPlaceholderText("organization.findings.actionTitlePlaceholder"),
      "Formal audit finding"
    )
    await userEvent.type(
      screen.getByPlaceholderText("organization.findings.criteriaPlaceholder"),
      "  OSHA walking-working surfaces standard  "
    )
    await userEvent.type(
      screen.getByPlaceholderText("organization.findings.conditionPlaceholder"),
      "Railing found damaged"
    )
    await userEvent.type(
      screen.getByPlaceholderText("organization.findings.causePlaceholder"),
      "Struck by a forklift"
    )
    await userEvent.type(
      screen.getByPlaceholderText("organization.findings.effectPlaceholder"),
      "Increased fall risk"
    )
    await userEvent.selectOptions(
      screen.getByLabelText("organization.findings.lineOfDefenseLabel"),
      "FIRST"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.findings.createFindingBtn" })
    )

    await waitFor(() => expect(mockCreateNewFinding).toHaveBeenCalled())
    const payload = mockCreateNewFinding.mock.calls[0][0]
    expect(payload.criteria).toBe("OSHA walking-working surfaces standard")
    expect(payload.condition).toBe("Railing found damaged")
    expect(payload.cause).toBe("Struck by a forklift")
    expect(payload.effect).toBe("Increased fall risk")
  })

  it("auto-expands the Five Cs section and pre-fills it when editing a finding that already has one of the fields set", async () => {
    render(
      <CreateNewFindingModal
        open
        onClose={vi.fn()}
        editData={
          makeEditData({
            criteria: "ISO 37301 clause 4.6",
            condition: null,
            cause: null,
            effect: null,
          }) as any
        }
      />
    )

    expect(
      screen.getByDisplayValue("ISO 37301 clause 4.6")
    ).toBeInTheDocument()
  })

  it("keeps the Five Cs section collapsed by default when editing a finding with none of the fields set", () => {
    render(
      <CreateNewFindingModal
        open
        onClose={vi.fn()}
        editData={makeEditData() as any}
      />
    )

    expect(
      screen.queryByPlaceholderText("organization.findings.criteriaPlaceholder")
    ).not.toBeInTheDocument()
  })

  it("fetches the single action detail (GET /action/:id) when opened for edit, and skips it when creating", async () => {
    render(
      <CreateNewFindingModal
        open
        onClose={vi.fn()}
        editData={makeEditData() as any}
      />
    )

    await waitFor(() =>
      expect(mockGetFindingById).toHaveBeenCalledWith(
        "finding-1",
        expect.objectContaining({ skip: false })
      )
    )

    mockGetFindingById.mockClear()
    render(<CreateNewFindingModal open onClose={vi.fn()} />)

    expect(mockGetFindingById).toHaveBeenCalledWith(
      "",
      expect.objectContaining({ skip: true })
    )
  })

  // #170: update_action_into_db (the PATCH handler behind updateFindingById)
  // never reads body.messages, so a comment typed while editing an existing
  // finding has to go through the dedicated PUT endpoint (addFindingMessage)
  // instead -- #106 added that endpoint server-side but nothing ever called
  // it from the UI.
  it("adds a new comment on an existing finding via addFindingMessage, not folded into the PATCH body (#170)", async () => {
    mockUpdateFindingById.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })
    mockAddFindingMessage.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })

    render(
      <CreateNewFindingModal
        open
        onClose={vi.fn()}
        editData={makeEditData() as any}
      />
    )

    await waitFor(() =>
      expect(screen.getByDisplayValue("Fix broken railing")).toBeInTheDocument()
    )

    await userEvent.type(
      screen.getByPlaceholderText("organization.findings.addUpdatePlaceholder"),
      "New comment on edit"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.findings.updateFindingBtn" })
    )

    await waitFor(() => expect(mockUpdateFindingById).toHaveBeenCalled())
    const patchCall = mockUpdateFindingById.mock.calls[0][0]
    // The PATCH body must not carry a messages array at all -- the backend
    // ignores it there, so sending it would just be misleading, and doing
    // so used to double-count the pre-existing messages (see below).
    expect(patchCall.body.messages).toBeUndefined()

    await waitFor(() => expect(mockAddFindingMessage).toHaveBeenCalled())
    expect(mockAddFindingMessage).toHaveBeenCalledWith({
      id: "finding-1",
      message: "New comment on edit",
    })
  })

  it("does not call addFindingMessage when editing a finding with no new comment typed (#170)", async () => {
    mockUpdateFindingById.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })

    render(
      <CreateNewFindingModal
        open
        onClose={vi.fn()}
        editData={makeEditData() as any}
      />
    )

    await waitFor(() =>
      expect(screen.getByDisplayValue("Fix broken railing")).toBeInTheDocument()
    )

    await userEvent.click(
      screen.getByRole("button", { name: "organization.findings.updateFindingBtn" })
    )

    await waitFor(() => expect(mockUpdateFindingById).toHaveBeenCalled())
    expect(mockAddFindingMessage).not.toHaveBeenCalled()
  })

  it("shows a partial-success error (not the generic full-failure toast) when the PATCH succeeds but addFindingMessage then fails (#170)", async () => {
    mockUpdateFindingById.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })
    mockAddFindingMessage.mockReturnValue({
      unwrap: () => Promise.reject({ data: {} }),
    })
    const onClose = vi.fn()
    const { toast } = await import("sonner")

    render(
      <CreateNewFindingModal
        open
        onClose={onClose}
        editData={makeEditData() as any}
      />
    )

    await waitFor(() =>
      expect(screen.getByDisplayValue("Fix broken railing")).toBeInTheDocument()
    )

    await userEvent.type(
      screen.getByPlaceholderText("organization.findings.addUpdatePlaceholder"),
      "Comment that will fail to save"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.findings.updateFindingBtn" })
    )

    await waitFor(() => expect(mockAddFindingMessage).toHaveBeenCalled())
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "organization.findings.commentFailed"
      )
    )
    // The action's own fields genuinely saved (PATCH succeeded) -- the
    // generic "organization.findings.updateFailed" full-failure message must not
    // fire, and neither must the success toast (only the comment failed).
    expect(toast.error).not.toHaveBeenCalledWith("organization.findings.updateFailed")
    expect(toast.success).not.toHaveBeenCalled()
    // Modal stays open and the typed comment isn't cleared, so the user can
    // see what failed and retry instead of silently losing it.
    expect(onClose).not.toHaveBeenCalled()
    expect(
      screen.getByDisplayValue("Comment that will fail to save")
    ).toBeInTheDocument()
  })

  it("sends the new comment as the finding's initial messages array on create (not via addFindingMessage)", async () => {
    mockCreateNewFinding.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })

    render(<CreateNewFindingModal open onClose={vi.fn()} />)

    await userEvent.type(
      screen.getByPlaceholderText("organization.findings.actionTitlePlaceholder"),
      "Finding with initial comment"
    )
    await userEvent.type(
      screen.getByPlaceholderText("organization.findings.addUpdatePlaceholder"),
      "First comment"
    )
    await userEvent.selectOptions(
      screen.getByLabelText("organization.findings.lineOfDefenseLabel"),
      "FIRST"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "organization.findings.createFindingBtn" })
    )

    await waitFor(() => expect(mockCreateNewFinding).toHaveBeenCalled())
    const payload = mockCreateNewFinding.mock.calls[0][0]
    expect(payload.messages).toEqual([{ message: "First comment" }])
    expect(mockAddFindingMessage).not.toHaveBeenCalled()
  })

  it("renders the existing conversation thread from the fetched detail, not from the (message-less) list row payload (#162)", async () => {
    // The list row's editData no longer carries full message bodies —
    // that's the whole point of #162. Only the detail fetch has them.
    mockGetFindingById.mockReturnValue({
      data: {
        data: makeEditData({
          messages: [
            {
              id: "msg-1",
              senderAccountId: "acc-1",
              message: "Replaced the loose bracket.",
              account: {
                profile: { fullName: "Alice", profilePhoto: null },
                organizationProfile: null,
              },
              createdAt: "2026-06-02T00:00:00.000Z",
              updatedAt: "2026-06-02T00:00:00.000Z",
            },
          ],
        }),
      },
    })

    render(
      <CreateNewFindingModal
        open
        onClose={vi.fn()}
        editData={makeEditData({ messages: [] }) as any}
      />
    )

    await waitFor(() =>
      expect(
        screen.getByText("Replaced the loose bracket.")
      ).toBeInTheDocument()
    )
    // Regression (round 3 audit): the sender name span was commented out,
    // rendering an empty bold tag above every message instead of who sent
    // it, matching the pattern FindingDetails.tsx's Messages tab uses.
    expect(screen.getByText("Alice:")).toBeInTheDocument()
  })

  it("falls back to the unknownUser label when a message's sender has no profile or org profile name", async () => {
    mockGetFindingById.mockReturnValue({
      data: {
        data: makeEditData({
          messages: [
            {
              id: "msg-1",
              senderAccountId: "acc-1",
              message: "Anonymous update.",
              account: { profile: null, organizationProfile: null },
              createdAt: "2026-06-02T00:00:00.000Z",
              updatedAt: "2026-06-02T00:00:00.000Z",
            },
          ],
        }),
      },
    })

    render(
      <CreateNewFindingModal
        open
        onClose={vi.fn()}
        editData={makeEditData({ messages: [] }) as any}
      />
    )

    await waitFor(() =>
      expect(screen.getByText("Anonymous update.")).toBeInTheDocument()
    )
    expect(
      screen.getByText("organization.findings.unknownUser:")
    ).toBeInTheDocument()
  })

  it("doesn't clobber in-progress edits to other fields when the detail fetch resolves after mount (the race the two-effect split exists to prevent)", async () => {
    // Detail fetch starts unresolved, same as a real slow network request.
    mockGetFindingById.mockReturnValue({ data: undefined })

    // Same object reference across both renders below, matching the real
    // app: AllFindingsPage's modalState.editData doesn't change identity
    // just because an internal RTK Query hook resolved. A fresh object on
    // rerender would itself re-trigger the load effect via its `editData`
    // dependency and mask the exact race this test exists to catch.
    const editData = makeEditData({ messages: [] }) as any

    const { rerender } = render(
      <CreateNewFindingModal open onClose={vi.fn()} editData={editData} />
    )

    const titleInput = await screen.findByDisplayValue("Fix broken railing")
    // User starts editing the title before the detail fetch has resolved.
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, "Fix broken railing urgently")

    // Detail fetch now resolves — simulate the RTK Query hook transitioning
    // from loading to success by re-rendering with the same props while the
    // mock's return value has changed underneath it.
    mockGetFindingById.mockReturnValue({
      data: {
        data: makeEditData({
          messages: [
            {
              id: "msg-1",
              senderAccountId: "acc-1",
              message: "Replaced the loose bracket.",
              account: {
                profile: { fullName: "Alice", profilePhoto: null },
                organizationProfile: null,
              },
              createdAt: "2026-06-02T00:00:00.000Z",
              updatedAt: "2026-06-02T00:00:00.000Z",
            },
          ],
        }),
      },
    })
    rerender(
      <CreateNewFindingModal open onClose={vi.fn()} editData={editData} />
    )

    // The message thread should now render...
    await waitFor(() =>
      expect(
        screen.getByText("Replaced the loose bracket.")
      ).toBeInTheDocument()
    )
    // ...without wiping out the title the user was already typing. A full
    // reset() firing on detail-fetch resolution (folding the two effects
    // back together) would fail this assertion by reverting to
    // "Fix broken railing".
    expect(
      screen.getByDisplayValue("Fix broken railing urgently")
    ).toBeInTheDocument()
  })

  // aexa-server#252 / aexa-frontend#214: COMPLETE/CANT_DO can now only be
  // reached via an approved closure request -- a direct PATCH sending
  // either as `status` 400s, even as a no-op resend of the finding's own
  // current value.
  describe("status field and closure-gated statuses (#214)", () => {
    it("only offers TO_DO and IN_PROGRESS on create -- no COMPLETE/CANT_DO option exists", () => {
      render(<CreateNewFindingModal open onClose={vi.fn()} />)

      const statusSelect = screen
        .getByText("organization.findings.statusLabel")
        .closest("div")!
        .querySelector("select")!
      const optionValues = Array.from(statusSelect.options).map((o) => o.value)

      expect(optionValues).toEqual(["TO_DO", "IN_PROGRESS"])
    })

    it("only offers TO_DO and IN_PROGRESS when editing a non-closed finding", () => {
      render(
        <CreateNewFindingModal
          open
          onClose={vi.fn()}
          editData={makeEditData({ status: "IN_PROGRESS" }) as any}
        />
      )

      const statusSelect = screen
        .getByText("organization.findings.statusLabel")
        .closest("div")!
        .querySelector("select")!
      const optionValues = Array.from(statusSelect.options).map((o) => o.value)

      expect(optionValues).toEqual(["TO_DO", "IN_PROGRESS"])
    })

    it("sends the selected status for a non-closed finding", async () => {
      mockUpdateFindingById.mockReturnValue({
        unwrap: () => Promise.resolve({}),
      })
      render(
        <CreateNewFindingModal
          open
          onClose={vi.fn()}
          editData={makeEditData({ status: "TO_DO" }) as any}
        />
      )

      const statusSelect = screen
        .getByText("organization.findings.statusLabel")
        .closest("div")!
        .querySelector("select")!
      await userEvent.selectOptions(statusSelect, "IN_PROGRESS")
      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.findings.updateFindingBtn",
        })
      )

      await waitFor(() => expect(mockUpdateFindingById).toHaveBeenCalled())
      const call = mockUpdateFindingById.mock.calls[0][0]
      expect(call.body.status).toBe("IN_PROGRESS")
    })

    it("shows status read-only (no select) and omits status from the payload when editing an already-COMPLETE finding", async () => {
      mockUpdateFindingById.mockReturnValue({
        unwrap: () => Promise.resolve({}),
      })
      render(
        <CreateNewFindingModal
          open
          onClose={vi.fn()}
          editData={makeEditData({ status: "COMPLETE" }) as any}
        />
      )

      expect(
        screen.queryByText("organization.findings.statusLabel")
          ? screen
              .getByText("organization.findings.statusLabel")
              .closest("div")!
              .querySelector("select")
          : null
      ).toBeNull()
      expect(
        screen.getByText("organization.findings.statusClosedHint")
      ).toBeInTheDocument()

      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.findings.updateFindingBtn",
        })
      )

      await waitFor(() => expect(mockUpdateFindingById).toHaveBeenCalled())
      const call = mockUpdateFindingById.mock.calls[0][0]
      expect(call.body.status).toBeUndefined()
    })

    it("shows status read-only and omits status from the payload when editing an already-CANT_DO finding", async () => {
      mockUpdateFindingById.mockReturnValue({
        unwrap: () => Promise.resolve({}),
      })
      render(
        <CreateNewFindingModal
          open
          onClose={vi.fn()}
          editData={makeEditData({ status: "CANT_DO" }) as any}
        />
      )

      expect(
        screen.getByText("organization.findings.statusClosedHint")
      ).toBeInTheDocument()

      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.findings.updateFindingBtn",
        })
      )

      await waitFor(() => expect(mockUpdateFindingById).toHaveBeenCalled())
      const call = mockUpdateFindingById.mock.calls[0][0]
      expect(call.body.status).toBeUndefined()
    })
  })

  // aexa-frontend#238: dueDate round-trips through a `datetime-local` input
  // (local wall-clock, no offset) on both sides -- reading a UTC ISO string
  // back into that input, and converting the input's value back to UTC on
  // submit. Getting either conversion wrong shifts the date by the local
  // UTC offset every edit, and can flip the future-date validator too.
  describe("due date timezone round-trip (#238)", () => {
    it("toLocalDatetimeInputValue converts a UTC instant to the correct local wall-clock value for a non-UTC, non-whole-hour offset", () => {
      // IST, UTC+5:30 -- getTimezoneOffset() is negative for zones east of UTC.
      const offsetSpy = vi
        .spyOn(Date.prototype, "getTimezoneOffset")
        .mockReturnValue(-330)

      expect(
        toLocalDatetimeInputValue(new Date("2026-08-15T18:30:00.000Z"))
      ).toBe("2026-08-16T00:00")

      offsetSpy.mockRestore()
    })

    it("toLocalDatetimeInputValue converts a UTC instant to the correct local wall-clock value west of UTC", () => {
      // EST, UTC-5.
      const offsetSpy = vi
        .spyOn(Date.prototype, "getTimezoneOffset")
        .mockReturnValue(300)

      expect(
        toLocalDatetimeInputValue(new Date("2026-08-15T18:30:00.000Z"))
      ).toBe("2026-08-15T13:30")

      offsetSpy.mockRestore()
    })

    // Exercises the real end-to-end path: editData.dueDate (server UTC ISO)
    // -> reset()'s dueDate via toLocalDatetimeInputValue (edit re-init,
    // ~line 222) -> the datetime-local input's displayed value -> back
    // through `new Date(values.dueDate).toISOString()` on submit (~line
    // 309+). Uses a real, fixed-offset (no DST) IANA zone rather than a
    // mocked getTimezoneOffset, because the submit side re-parses the
    // input's plain local-time string with `new Date(...)`, which consults
    // the actual host timezone, not a mocked prototype method.
    describe("with the process timezone pinned to a fixed non-UTC offset", () => {
      beforeAll(() => {
        // Arizona does not observe DST, so this is deterministic year-round.
        vi.stubEnv("TZ", "America/Phoenix") // UTC-7
      })

      afterAll(() => {
        vi.unstubAllEnvs()
      })

      it("resubmitting an edited finding without touching the due date sends back the exact same UTC instant", async () => {
        mockUpdateFindingById.mockReturnValue({
          unwrap: () => Promise.resolve({}),
        })
        const originalDueDate = "2099-08-15T18:30:00.000Z"

        render(
          <CreateNewFindingModal
            open
            onClose={vi.fn()}
            editData={makeEditData({ dueDate: originalDueDate }) as any}
          />
        )

        await waitFor(() =>
          expect(
            screen.getByDisplayValue("Fix broken railing")
          ).toBeInTheDocument()
        )

        // Reflects the local wall-clock time (UTC-7): 18:30 UTC -> 11:30.
        const dueDateInput = document.querySelector(
          'input[type="datetime-local"]'
        ) as HTMLInputElement
        expect(dueDateInput.value).toBe("2099-08-15T11:30")

        await userEvent.click(
          screen.getByRole("button", {
            name: "organization.findings.updateFindingBtn",
          })
        )

        await waitFor(() => expect(mockUpdateFindingById).toHaveBeenCalled())
        const call = mockUpdateFindingById.mock.calls[0][0]
        // The bug: a raw `.slice(0, 16)` on the edit re-init, with no offset
        // correction, would have displayed "2099-08-15T18:30" above and then
        // resubmitted as a UTC instant 7 hours later than the original.
        expect(call.body.dueDate).toBe(originalDueDate)
      })

      it("a finding due only a few hours from now still passes the future-date validator after being reopened for edit", async () => {
        mockUpdateFindingById.mockReturnValue({
          unwrap: () => Promise.resolve({}),
        })
        const nearFutureDueDate = new Date(
          Date.now() + 3 * 60 * 60 * 1000
        ).toISOString()

        render(
          <CreateNewFindingModal
            open
            onClose={vi.fn()}
            editData={makeEditData({ dueDate: nearFutureDueDate }) as any}
          />
        )

        await waitFor(() =>
          expect(
            screen.getByDisplayValue("Fix broken railing")
          ).toBeInTheDocument()
        )

        await userEvent.click(
          screen.getByRole("button", {
            name: "organization.findings.updateFindingBtn",
          })
        )

        // With the bug, the mis-converted value would read as 7 hours
        // earlier than the real due date -- possibly now "in the past" --
        // and the future-date validator would block the submit entirely.
        await waitFor(() => expect(mockUpdateFindingById).toHaveBeenCalled())
        expect(
          screen.queryByText("organization.findings.dueDatePast")
        ).not.toBeInTheDocument()
      })
    })
  })

  // aexa-frontend#340: the "must be in the future" dueDate validator ran
  // unconditionally on every submit, including edits -- so editing an
  // already-overdue finding (any change at all: status, a comment,
  // assignee) failed validation unless the user also bumped the due date
  // forward. Fixed to only enforce the future check for a *new* due date
  // value being set, not for preserving an already-past one unchanged.
  describe("editing an already-overdue finding (#340)", () => {
    const pastDueDate = "2020-01-01T00:00:00.000Z"

    it("allows resubmitting an edit without touching an already-past due date", async () => {
      mockUpdateFindingById.mockReturnValue({
        unwrap: () => Promise.resolve({}),
      })

      render(
        <CreateNewFindingModal
          open
          onClose={vi.fn()}
          editData={makeEditData({ dueDate: pastDueDate }) as any}
        />
      )

      await waitFor(() =>
        expect(
          screen.getByDisplayValue("Fix broken railing")
        ).toBeInTheDocument()
      )

      // Only touch an unrelated field -- the due date itself is left as-is.
      await userEvent.type(
        screen.getByPlaceholderText(
          "organization.findings.addUpdatePlaceholder"
        ),
        "Still working on this"
      )
      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.findings.updateFindingBtn",
        })
      )

      expect(
        screen.queryByText("organization.findings.dueDatePast")
      ).not.toBeInTheDocument()
      await waitFor(() => expect(mockUpdateFindingById).toHaveBeenCalled())
      const call = mockUpdateFindingById.mock.calls[0][0]
      expect(call.body.dueDate).toBe(pastDueDate)
    })

    it("still blocks the submit when a new past due date is explicitly set", async () => {
      mockUpdateFindingById.mockReturnValue({
        unwrap: () => Promise.resolve({}),
      })

      render(
        <CreateNewFindingModal
          open
          onClose={vi.fn()}
          editData={makeEditData({ dueDate: pastDueDate }) as any}
        />
      )

      await waitFor(() =>
        expect(
          screen.getByDisplayValue("Fix broken railing")
        ).toBeInTheDocument()
      )

      const dueDateInput = document.querySelector(
        'input[type="datetime-local"]'
      ) as HTMLInputElement
      // A different past value -- not the untouched original -- must still
      // trip the future-date validator.
      fireEvent.change(dueDateInput, { target: { value: "2020-06-15T10:00" } })
      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.findings.updateFindingBtn",
        })
      )

      expect(
        await screen.findByText("organization.findings.dueDatePast")
      ).toBeInTheDocument()
      expect(mockUpdateFindingById).not.toHaveBeenCalled()
    })

    it("still requires a future due date when creating a new finding (unaffected control case)", async () => {
      render(<CreateNewFindingModal open onClose={vi.fn()} />)

      await userEvent.type(
        screen.getByPlaceholderText(
          "organization.findings.actionTitlePlaceholder"
        ),
        "New finding with a past due date"
      )
      const dueDateInput = document.querySelector(
        'input[type="datetime-local"]'
      ) as HTMLInputElement
      fireEvent.change(dueDateInput, { target: { value: "2020-01-01T00:00" } })
      await userEvent.click(
        screen.getByRole("button", {
          name: "organization.findings.createFindingBtn",
        })
      )

      expect(
        await screen.findByText("organization.findings.dueDatePast")
      ).toBeInTheDocument()
      expect(mockCreateNewFinding).not.toHaveBeenCalled()
    })
  })

  // aexa-server#97: create_action requires line_of_defense with no default
  // (see action.validation.ts) -- this form previously never collected it
  // at all, so every real "Create Finding" submission 400'd.
  describe("line of defense (aexa-server#97)", () => {
    it("blocks create and shows a validation error when no line is selected", async () => {
      render(<CreateNewFindingModal open onClose={vi.fn()} />)

      await userEvent.type(
        screen.getByPlaceholderText("organization.findings.actionTitlePlaceholder"),
        "New finding"
      )
      await userEvent.click(
        screen.getByRole("button", { name: "organization.findings.createFindingBtn" })
      )

      expect(
        await screen.findByText("organization.findings.lineOfDefenseRequired")
      ).toBeInTheDocument()
      expect(mockCreateNewFinding).not.toHaveBeenCalled()
    })

    it("sends the selected line_of_defense on create", async () => {
      mockCreateNewFinding.mockReturnValue({ unwrap: () => Promise.resolve({}) })

      render(<CreateNewFindingModal open onClose={vi.fn()} />)

      await userEvent.type(
        screen.getByPlaceholderText("organization.findings.actionTitlePlaceholder"),
        "New finding"
      )
      await userEvent.selectOptions(
        screen.getByLabelText("organization.findings.lineOfDefenseLabel"),
        "THIRD"
      )
      await userEvent.click(
        screen.getByRole("button", { name: "organization.findings.createFindingBtn" })
      )

      await waitFor(() => expect(mockCreateNewFinding).toHaveBeenCalled())
      const payload = mockCreateNewFinding.mock.calls[0][0]
      expect(payload.line_of_defense).toBe("THIRD")
    })

    it("does not require a line on edit, and pre-fills the existing classified value", async () => {
      mockUpdateFindingById.mockReturnValue({ unwrap: () => Promise.resolve({}) })

      render(
        <CreateNewFindingModal
          open
          onClose={vi.fn()}
          editData={makeEditData({ line_of_defense: "SECOND" }) as any}
        />
      )

      const select = screen.getByLabelText(
        "organization.findings.lineOfDefenseLabel"
      ) as HTMLSelectElement
      expect(select.value).toBe("SECOND")

      await userEvent.click(
        screen.getByRole("button", { name: "organization.findings.updateFindingBtn" })
      )

      await waitFor(() => expect(mockUpdateFindingById).toHaveBeenCalled())
      const payload = mockUpdateFindingById.mock.calls[0][0].body
      expect(payload.line_of_defense).toBe("SECOND")
    })

    it("does not block editing a pre-#97 Action that has no line_of_defense", async () => {
      mockUpdateFindingById.mockReturnValue({ unwrap: () => Promise.resolve({}) })

      render(
        <CreateNewFindingModal
          open
          onClose={vi.fn()}
          editData={makeEditData({ line_of_defense: null }) as any}
        />
      )

      const select = screen.getByLabelText(
        "organization.findings.lineOfDefenseLabel"
      ) as HTMLSelectElement
      expect(select.value).toBe("")

      await userEvent.click(
        screen.getByRole("button", { name: "organization.findings.updateFindingBtn" })
      )

      await waitFor(() => expect(mockUpdateFindingById).toHaveBeenCalled())
      const payload = mockUpdateFindingById.mock.calls[0][0].body
      expect(payload.line_of_defense).toBeUndefined()
    })
  })
})
