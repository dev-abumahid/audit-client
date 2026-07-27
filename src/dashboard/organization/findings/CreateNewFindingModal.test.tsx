/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import CreateNewFindingModal from "./CreateNewFindingModal"

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
  (id: string, options?: { skip?: boolean }) => { data: unknown }
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

    await userEvent.click(
      screen.getByRole("button", { name: "organization.findings.createFindingBtn" })
    )

    await waitFor(() => expect(mockCreateNewFinding).toHaveBeenCalled())
    const payload = mockCreateNewFinding.mock.calls[0][0]
    expect(payload.attachments).toContain("https://cdn.example.com/new.png")
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

    const aliceCheckbox = screen
      .getByText("Alice")
      .closest("label")
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
    await userEvent.click(
      screen.getByRole("button", { name: "organization.findings.createFindingBtn" })
    )

    await waitFor(() => expect(mockCreateNewFinding).toHaveBeenCalled())
    const payload = mockCreateNewFinding.mock.calls[0][0]
    expect(payload.assignBy).toEqual(["member-1"])
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
})
