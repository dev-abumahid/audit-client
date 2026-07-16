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
vi.mock("@/redux/apis/organization/findings.api", () => ({
  useCreateNewFindingMutation: () => [
    mockCreateNewFinding,
    { isLoading: false },
  ],
  useUpdateFindingByIdMutation: () => [
    mockUpdateFindingById,
    { isLoading: false },
  ],
}))

vi.mock("@/redux/apis/organization/inspection.api", () => ({
  useGetAllInspectionQuery: () => ({
    data: {
      data: [
        {
          _id: "insp-1",
          id: "insp-1",
          template: { templateName: "Daily Safety Checklist" },
        },
      ],
    },
    isLoading: false,
  }),
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
    mediaFiles: ["https://cdn.example.com/existing.png"],
    ...overrides,
  }
}

describe("CreateNewFindingModal", () => {
  beforeEach(() => {
    mockUploadFile.mockReset()
    mockCreateNewFinding.mockReset()
    mockUpdateFindingById.mockReset()
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
      screen.getByPlaceholderText("Enter action title..."),
      "New finding"
    )
    await userEvent.click(
      screen.getByRole("button", { name: /create finding/i })
    )

    await waitFor(() => expect(mockCreateNewFinding).toHaveBeenCalled())
    const payload = mockCreateNewFinding.mock.calls[0][0]
    expect(payload).toHaveProperty("questionId", "question-42")
    expect(payload).not.toHaveProperty("question")
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
      screen.getByPlaceholderText("Enter action title..."),
      "New finding with media"
    )

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    const file = new File(["hello"], "photo.png", { type: "image/png" })
    await userEvent.upload(fileInput, file)

    await waitFor(() => expect(mockUploadFile).toHaveBeenCalled())

    await userEvent.click(
      screen.getByRole("button", { name: /create finding/i })
    )

    await waitFor(() => expect(mockCreateNewFinding).toHaveBeenCalled())
    const payload = mockCreateNewFinding.mock.calls[0][0]
    expect(payload.mediaFiles).toContain("https://cdn.example.com/new.png")
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
      .getByText("Assignees")
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
      screen.getByRole("button", { name: /update finding/i })
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
      screen.getByRole("button", { name: /update finding/i })
    )

    await waitFor(() => expect(mockUpdateFindingById).toHaveBeenCalled())
    const call = mockUpdateFindingById.mock.calls[0][0]
    expect(call.id).toBe("finding-1")
    expect(call.body.mediaFiles).toContain(
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
      .getByText("Assignees")
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
      screen.getByPlaceholderText("Enter action title..."),
      "Finding with real member shape"
    )
    await userEvent.click(
      screen.getByRole("button", { name: /create finding/i })
    )

    await waitFor(() => expect(mockCreateNewFinding).toHaveBeenCalled())
    const payload = mockCreateNewFinding.mock.calls[0][0]
    expect(payload.assignBy).toEqual(["member-1"])
  })
})
