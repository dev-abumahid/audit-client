import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import FindingDetails from "./FindingDetails"

// Controllable `i18n.language` for the locale-formatting test below, while
// every other test in this file keeps relying on the real (uninitialized)
// react-i18next t(), which just echoes the raw key back -- same technique
// as TeamMembersTab.test.tsx.
let mockLanguage: string | undefined = undefined
vi.mock("react-i18next", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-i18next")>()
  return {
    ...mod,
    useTranslation: () => {
      const real = mod.useTranslation()
      return { ...real, i18n: { ...real.i18n, language: mockLanguage } }
    },
  }
})

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

// aexa-frontend#217 -- role hook mocked per-test via this mutable holder,
// same convention as RiskApprovalControls.test.tsx.
let mockRole: string | undefined = "ADMIN"
vi.mock("@/hooks/useMyOrgRole", () => ({
  useMyOrgRole: () => mockRole,
  canWriteOrgResource: (role: string | undefined) =>
    role === "ADMIN" || role === "LEAD_AUDITOR",
}))

// aexa-frontend#270 -- mutable holder, same convention as mockRole above.
let mockAssignedInspectionIds: Set<string> | undefined = new Set()
vi.mock("@/hooks/useMyAssignments", () => ({
  useMyAssignedInspectionIds: () => mockAssignedInspectionIds,
  useMyActiveFindingAssignmentIds: () => new Set(),
}))

const mockNavigate = vi.fn()
vi.mock("react-router", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router")>()
  return {
    ...mod,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: "finding-1" }),
  }
})

const mockUseGetFindingByIdQuery = vi.fn()
const mockDeleteFinding = vi.fn()
const mockUpdateFinding = vi.fn()
const mockUploadAttachment = vi.fn()
const mockAddFindingMessage = vi.fn()

vi.mock("@/redux/apis/organization/findings.api", () => ({
  useGetFindingByIdQuery: (...args: unknown[]) =>
    mockUseGetFindingByIdQuery(...args),
  useDeleteFindingByIdMutation: () => [
    mockDeleteFinding,
    { isLoading: false },
  ],
  useUpdateFindingByIdMutation: () => [mockUpdateFinding, { isLoading: false }],
  useUploadFindingAttachmentMutation: () => [
    mockUploadAttachment,
    { isLoading: false },
  ],
  useAddFindingMessageMutation: () => [
    mockAddFindingMessage,
    { isLoading: false },
  ],
}))

vi.mock("./CreateNewFindingModal", () => ({
  default: ({
    open,
    editData,
  }: {
    open: boolean
    editData?: { actionTitle: string } | null
  }) =>
    open ? (
      <div data-testid="edit-finding-modal">
        {editData ? `Editing: ${editData.actionTitle}` : "No data"}
      </div>
    ) : null,
}))

// aexa-frontend#214 -- has its own dedicated RTK Query hooks (useMyOrgRole,
// useGetFindingClosureStateQuery) and test file (FindingClosureControls.test.tsx);
// mocked as a black box here, same pattern as CreateNewFindingModal above, so
// this suite's assertions aren't coupled to it and don't need a Redux Provider.
vi.mock("./FindingClosureControls", () => ({
  default: () => <div data-testid="finding-closure-controls" />,
}))

vi.mock("@/components/shared/DeleteAlertModal", () => ({
  default: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? <button onClick={onConfirm}>Confirm delete</button> : null,
}))

import { toast } from "sonner"
const mockToastError = vi.mocked(toast.error)
const mockToastSuccess = vi.mocked(toast.success)

function makeAction(overrides = {}) {
  return {
    id: "finding-1",
    orgAccountId: "org-1",
    inspectionId: "insp-1",
    siteId: "site-1",
    questionId: null,
    actionTitle: "Fix broken railing",
    actionDisc: "Railing on level 2 is loose.",
    priority: "High",
    dueDate: "2099-07-01T00:00:00.000Z",
    status: "TO_DO",
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
    messages: [],
    site: { id: "site-1", name: "HQ Casablanca" },
    attachments: [],
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <FindingDetails />
    </MemoryRouter>
  )
}

describe("FindingDetails", () => {
  beforeEach(() => {
    mockLanguage = undefined
    mockRole = "ADMIN"
    mockAssignedInspectionIds = new Set()
    mockNavigate.mockReset()
    mockUseGetFindingByIdQuery.mockReset()
    mockDeleteFinding.mockReset()
    mockUpdateFinding.mockReset()
    mockUploadAttachment.mockReset()
    mockAddFindingMessage.mockReset()
    mockToastError.mockReset()
    mockToastSuccess.mockReset()
    mockUseGetFindingByIdQuery.mockReturnValue({
      data: { data: makeAction() },
      isLoading: false,
    })
  })

  it("shows Edit and Delete for an ADMIN", () => {
    mockRole = "ADMIN"
    renderPage()

    expect(
      screen.getByRole("button", { name: "organization.findings.edit" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "organization.findings.delete" })
    ).toBeInTheDocument()
  })

  // Regression: the priority badge used to concatenate two separately-
  // translated fragments (t(priorityHigh) + " " + t("...priority")), which
  // reads backwards in French ("Élevée Priorité" instead of "Priorité
  // Élevée"). It's now a single interpolated key so each locale controls its
  // own word order. i18next isn't initialized with resources in this test
  // file, so t() returns the raw key -- this asserts the new single-key
  // interpolation call is what's rendered, not the old two-fragment shape.
  it("renders the priority badge as a single interpolated label, not two concatenated fragments", () => {
    renderPage()

    expect(
      screen.getByText("organization.findings.priorityLabel")
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/organization\.findings\.priority$/)
    ).not.toBeInTheDocument()
  })

  it("hides Edit and Delete for a VIEWER", () => {
    mockRole = "VIEWER"
    renderPage()

    expect(
      screen.queryByRole("button", { name: "organization.findings.edit" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "organization.findings.delete" })
    ).not.toBeInTheDocument()
  })

  it("hides Edit and Delete for a LIGHT_USER", () => {
    mockRole = "LIGHT_USER"
    renderPage()

    expect(
      screen.queryByRole("button", { name: "organization.findings.edit" })
    ).not.toBeInTheDocument()
  })

  // aexa-frontend#270: LEAD_AUDITOR's Edit/Delete is additionally narrowed
  // by real assignment on the finding's parent inspection ("insp-1", per
  // makeAction's default), mirroring org_scope.ts's assertCanWriteToAction.
  it("hides Edit and Delete for an unassigned LEAD_AUDITOR", () => {
    mockRole = "LEAD_AUDITOR"
    mockAssignedInspectionIds = new Set()
    renderPage()

    expect(
      screen.queryByRole("button", { name: "organization.findings.edit" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "organization.findings.delete" })
    ).not.toBeInTheDocument()
  })

  it("shows Edit and Delete for a LEAD_AUDITOR assigned to the finding's parent inspection", () => {
    mockRole = "LEAD_AUDITOR"
    mockAssignedInspectionIds = new Set(["insp-1"])
    renderPage()

    expect(
      screen.getByRole("button", { name: "organization.findings.edit" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "organization.findings.delete" })
    ).toBeInTheDocument()
  })

  it("degrades a LEAD_AUDITOR back to allowed when assignment data is unavailable", () => {
    mockRole = "LEAD_AUDITOR"
    mockAssignedInspectionIds = undefined
    renderPage()

    expect(
      screen.getByRole("button", { name: "organization.findings.edit" })
    ).toBeInTheDocument()
  })

  it("Edit button opens the modal pre-filled with the finding", async () => {
    renderPage()

    await userEvent.click(screen.getByRole("button", { name: "organization.findings.edit" }))

    expect(screen.getByTestId("edit-finding-modal")).toHaveTextContent(
      "Editing: Fix broken railing"
    )
  })

  // aexa-frontend#339: the Timeline dates (due/created/updated) used a local
  // formatDate() hardcoded to toLocaleDateString("en-US", ...), ignoring the
  // app's selected language. Now goes through the shared formatLocaleDate
  // helper (round 3, aexa-frontend#339's original fix for other call sites).
  describe("locale-aware Timeline date formatting (#339)", () => {
    const dateOptions: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }

    it("formats the due date using the French locale when i18n.language starts with fr", () => {
      mockLanguage = "fr-FR"
      renderPage()

      const expected = new Date("2099-07-01T00:00:00.000Z").toLocaleDateString(
        "fr-FR",
        dateOptions
      )
      expect(screen.getByText(expected)).toBeInTheDocument()
    })

    it("formats the due date using the English locale by default", () => {
      renderPage()

      const expected = new Date("2099-07-01T00:00:00.000Z").toLocaleDateString(
        "en-US",
        dateOptions
      )
      expect(screen.getByText(expected)).toBeInTheDocument()
    })
  })

  it("renders actionDisc as literal text and does not execute injected HTML (XSS regression, #107)", async () => {
    const payload = "<img src=x onerror=alert(1)>"
    mockUseGetFindingByIdQuery.mockReturnValue({
      data: { data: makeAction({ actionDisc: payload }) },
      isLoading: false,
    })

    const { container } = renderPage()

    expect(container.querySelector("img")).toBeNull()
    expect(screen.getByText(payload)).toBeInTheDocument()
  })

  // #170/#215: this compose box didn't exist at all before -- the Messages
  // tab only ever displayed existing messages.
  describe("sending a message (#215)", () => {
    it("sends a trimmed message via addFindingMessage and clears the input on success", async () => {
      mockAddFindingMessage.mockReturnValue({ unwrap: () => Promise.resolve({}) })
      renderPage()

      await userEvent.click(
        screen.getByRole("button", { name: /tabMessages/ })
      )
      const input = screen.getByPlaceholderText(
        "organization.findings.addUpdatePlaceholder"
      )
      await userEvent.type(input, "  Looks fixed now  ")
      await userEvent.click(screen.getByRole("button", { name: "organization.findings.sendMessage" }))

      await waitFor(() =>
        expect(mockAddFindingMessage).toHaveBeenCalledWith({
          id: "finding-1",
          message: "Looks fixed now",
        })
      )
      await waitFor(() => expect(input).toHaveValue(""))
    })

    it("does not call addFindingMessage for a blank/whitespace-only message", async () => {
      renderPage()

      await userEvent.click(
        screen.getByRole("button", { name: /tabMessages/ })
      )
      await userEvent.type(
        screen.getByPlaceholderText("organization.findings.addUpdatePlaceholder"),
        "   "
      )
      await userEvent.click(screen.getByRole("button", { name: "organization.findings.sendMessage" }))

      expect(mockAddFindingMessage).not.toHaveBeenCalled()
    })

    it("shows an error toast and keeps the input text when sending fails", async () => {
      mockAddFindingMessage.mockReturnValue({
        unwrap: () => Promise.reject({ data: { message: "Server exploded" } }),
      })
      renderPage()

      await userEvent.click(
        screen.getByRole("button", { name: /tabMessages/ })
      )
      const input = screen.getByPlaceholderText(
        "organization.findings.addUpdatePlaceholder"
      )
      await userEvent.type(input, "Trying again")
      await userEvent.click(screen.getByRole("button", { name: "organization.findings.sendMessage" }))

      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith("Server exploded")
      )
      expect(input).toHaveValue("Trying again")
    })
  })

  // #215: this panel previously always rendered the empty state, never
  // reading action.assignBy at all.
  describe("Assigned Users panel (#215)", () => {
    it("renders each assigned user's name when assignBy is populated", async () => {
      mockUseGetFindingByIdQuery.mockReturnValue({
        data: {
          data: makeAction({
            assignBy: [
              { id: "user-1", name: "Auditor One" },
              { id: "user-2", name: "Auditor Two" },
            ],
          }),
        },
        isLoading: false,
      })
      renderPage()

      expect(await screen.findByText("Auditor One")).toBeInTheDocument()
      expect(screen.getByText("Auditor Two")).toBeInTheDocument()
      expect(
        screen.queryByText("organization.findings.noUsersAssigned")
      ).not.toBeInTheDocument()
    })

    it("still shows the empty state when assignBy is empty", async () => {
      renderPage()

      expect(
        await screen.findByText("organization.findings.noUsersAssigned")
      ).toBeInTheDocument()
    })
  })

  // aexa-server#244 / aexa-frontend#213
  it("does not render the Five Cs section when none of criteria/condition/cause/effect are set", async () => {
    renderPage()

    await screen.findByText("Fix broken railing")
    expect(
      screen.queryByText("organization.findings.fiveCsSectionTitle")
    ).not.toBeInTheDocument()
  })

  it("renders only the Five Cs fields that are actually set", async () => {
    mockUseGetFindingByIdQuery.mockReturnValue({
      data: {
        data: makeAction({
          criteria: "OSHA walking-working surfaces standard",
          condition: null,
          cause: null,
          effect: "Increased fall risk",
        }),
      },
      isLoading: false,
    })
    renderPage()

    await screen.findByText("organization.findings.fiveCsSectionTitle")
    expect(
      screen.getByText("OSHA walking-working surfaces standard")
    ).toBeInTheDocument()
    expect(screen.getByText("Increased fall risk")).toBeInTheDocument()
    expect(
      screen.queryByText("organization.findings.conditionLabel")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText("organization.findings.causeLabel")
    ).not.toBeInTheDocument()
  })

  it("Delete button opens the confirm modal", async () => {
    renderPage()

    await userEvent.click(screen.getByRole("button", { name: "organization.findings.delete" }))

    expect(
      screen.getByRole("button", { name: /confirm delete/i })
    ).toBeInTheDocument()
  })

  it("confirming delete calls the delete mutation and navigates away on success", async () => {
    mockDeleteFinding.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    })
    renderPage()

    await userEvent.click(screen.getByRole("button", { name: "organization.findings.delete" }))
    await userEvent.click(
      screen.getByRole("button", { name: /confirm delete/i })
    )

    await waitFor(() =>
      expect(mockDeleteFinding).toHaveBeenCalledWith("finding-1")
    )
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(-1))
    expect(mockToastSuccess).toHaveBeenCalled()
  })

  it("shows an error toast and does not navigate when delete fails", async () => {
    mockDeleteFinding.mockReturnValue({
      unwrap: () =>
        Promise.reject({ data: { message: "Cannot delete finding" } }),
    })
    renderPage()

    await userEvent.click(screen.getByRole("button", { name: "organization.findings.delete" }))
    await userEvent.click(
      screen.getByRole("button", { name: /confirm delete/i })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Cannot delete finding")
    )
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  describe("attachments", () => {
    async function openFilesTab() {
      await userEvent.click(
        screen.getByRole("button", { name: /tabAttachments/ })
      )
    }

    it("shows the empty state when there are no attachments", async () => {
      renderPage()
      await openFilesTab()

      expect(screen.getByText("organization.findings.noAttachments")).toBeInTheDocument()
    })

    it("renders existing attachments split into images and files", async () => {
      mockUseGetFindingByIdQuery.mockReturnValue({
        data: {
          data: makeAction({
            attachments: [
              "https://cdn.example.com/photo.png",
              "https://cdn.example.com/report.pdf",
            ],
          }),
        },
        isLoading: false,
      })
      renderPage()
      await openFilesTab()

      expect(screen.getByText("report.pdf")).toBeInTheDocument()
      expect(screen.getByAltText("attachment-0")).toBeInTheDocument()
    })

    it("uploads a file, persists the URL onto the finding, and shows a success toast", async () => {
      mockUploadAttachment.mockReturnValue({
        unwrap: () =>
          Promise.resolve({ data: { url: "https://cdn.example.com/new.png" } }),
      })
      mockUpdateFinding.mockReturnValue({
        unwrap: () => Promise.resolve({}),
      })
      renderPage()
      await openFilesTab()

      const file = new File(["x"], "new.png", { type: "image/png" })
      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement
      await userEvent.upload(input, file)

      await waitFor(() => expect(mockUploadAttachment).toHaveBeenCalled())
      await waitFor(() =>
        expect(mockUpdateFinding).toHaveBeenCalledWith({
          id: "finding-1",
          body: { attachments: ["https://cdn.example.com/new.png"] },
        })
      )
      expect(mockToastSuccess).toHaveBeenCalledWith("organization.findings.attachmentUploaded")
    })

    it("appends the new URL to existing attachments rather than replacing them", async () => {
      mockUseGetFindingByIdQuery.mockReturnValue({
        data: {
          data: makeAction({
            attachments: ["https://cdn.example.com/existing.png"],
          }),
        },
        isLoading: false,
      })
      mockUploadAttachment.mockReturnValue({
        unwrap: () =>
          Promise.resolve({ data: { url: "https://cdn.example.com/new.png" } }),
      })
      mockUpdateFinding.mockReturnValue({ unwrap: () => Promise.resolve({}) })
      renderPage()
      await openFilesTab()

      const file = new File(["x"], "new.png", { type: "image/png" })
      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement
      await userEvent.upload(input, file)

      await waitFor(() =>
        expect(mockUpdateFinding).toHaveBeenCalledWith({
          id: "finding-1",
          body: {
            attachments: [
              "https://cdn.example.com/existing.png",
              "https://cdn.example.com/new.png",
            ],
          },
        })
      )
    })

    it("shows an error toast when the upload itself fails", async () => {
      mockUploadAttachment.mockReturnValue({
        unwrap: () =>
          Promise.reject({ data: { message: "File too large" } }),
      })
      renderPage()
      await openFilesTab()

      const file = new File(["x"], "new.png", { type: "image/png" })
      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement
      await userEvent.upload(input, file)

      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith("File too large")
      )
      expect(mockUpdateFinding).not.toHaveBeenCalled()
    })

    it("shows an error toast and does not lose the attachment when persisting the URL fails", async () => {
      mockUploadAttachment.mockReturnValue({
        unwrap: () =>
          Promise.resolve({ data: { url: "https://cdn.example.com/new.png" } }),
      })
      mockUpdateFinding.mockReturnValue({
        unwrap: () => Promise.reject({ data: { message: "Save failed" } }),
      })
      renderPage()
      await openFilesTab()

      const file = new File(["x"], "new.png", { type: "image/png" })
      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement
      await userEvent.upload(input, file)

      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith("Save failed")
      )
    })

    it("shows a partial-success message (not the generic upload-failed toast) when the file uploads but persisting it to the finding then fails (#123)", async () => {
      mockUploadAttachment.mockReturnValue({
        unwrap: () =>
          Promise.resolve({ data: { url: "https://cdn.example.com/new.png" } }),
      })
      mockUpdateFinding.mockReturnValue({
        unwrap: () => Promise.reject({ data: {} }),
      })
      renderPage()
      await openFilesTab()

      const file = new File(["x"], "new.png", { type: "image/png" })
      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement
      await userEvent.upload(input, file)

      await waitFor(() => expect(mockUpdateFinding).toHaveBeenCalled())
      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith(
          "organization.findings.attachFailed"
        )
      )
      // The file itself genuinely uploaded -- the generic "Failed to upload
      // attachment" full-failure message must not fire, and neither must the
      // success toast (only attaching the URL to the finding failed).
      expect(mockToastError).not.toHaveBeenCalledWith(
        "organization.findings.uploadAttachmentFailed"
      )
      expect(mockToastSuccess).not.toHaveBeenCalled()
    })

    it("removes an attachment by filtering it out of the array", async () => {
      mockUseGetFindingByIdQuery.mockReturnValue({
        data: {
          data: makeAction({
            attachments: [
              "https://cdn.example.com/keep.png",
              "https://cdn.example.com/remove.png",
            ],
          }),
        },
        isLoading: false,
      })
      mockUpdateFinding.mockReturnValue({ unwrap: () => Promise.resolve({}) })
      renderPage()
      await openFilesTab()

      const removeButtons = screen.getAllByTitle("organization.findings.remove")
      await userEvent.click(removeButtons[0])

      await waitFor(() =>
        expect(mockUpdateFinding).toHaveBeenCalledWith({
          id: "finding-1",
          body: { attachments: ["https://cdn.example.com/remove.png"] },
        })
      )
      expect(mockToastSuccess).toHaveBeenCalledWith("organization.findings.attachmentRemoved")
    })

    it("blocks a second remove while one is still in flight, preventing a lost-update race", async () => {
      mockUseGetFindingByIdQuery.mockReturnValue({
        data: {
          data: makeAction({
            attachments: [
              "https://cdn.example.com/a.png",
              "https://cdn.example.com/b.png",
            ],
          }),
        },
        isLoading: false,
      })
      let resolveFirstRemove: (value: unknown) => void = () => {}
      const firstRemovePromise = new Promise((resolve) => {
        resolveFirstRemove = resolve
      })
      mockUpdateFinding.mockReturnValueOnce({
        unwrap: () => firstRemovePromise,
      })
      renderPage()
      await openFilesTab()

      const removeButtons = screen.getAllByTitle("organization.findings.remove")
      await userEvent.click(removeButtons[0])

      // Second attachment's remove button must be disabled while the first
      // removal is still pending — both handlers build their PATCH body
      // from the same render's `action.attachments` closure, so allowing a
      // second remove to start here would race and could silently undo the
      // first removal (whichever PATCH resolves last wins).
      expect(screen.getAllByTitle("organization.findings.remove")[1]).toBeDisabled()
      await userEvent.click(screen.getAllByTitle("organization.findings.remove")[1])
      expect(mockUpdateFinding).toHaveBeenCalledTimes(1)

      resolveFirstRemove({})
      await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled())
    })
  })
})
