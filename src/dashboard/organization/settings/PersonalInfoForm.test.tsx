import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import PersonalInfoForm from "./PersonalInfoForm"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mockUpdateProfileTrigger = vi.fn()
let mockIsLoading = false
vi.mock("@/redux/apis/profile.api", () => ({
  useUpdateProfileMutation: () => [
    mockUpdateProfileTrigger,
    { get isLoading() {
      return mockIsLoading
    } },
  ],
}))

describe("PersonalInfoForm", () => {
  beforeEach(() => {
    mockUpdateProfileTrigger.mockReset()
    mockIsLoading = false
  })

  it("pre-fills the full name field from initialFullName", () => {
    render(<PersonalInfoForm initialFullName="Jane Doe" />)
    expect(screen.getByLabelText("organization.personalInfo.fullName")).toHaveValue("Jane Doe")
  })

  it("shows initials when no profilePhoto is provided", () => {
    render(<PersonalInfoForm initialFullName="Jane Doe" />)
    expect(screen.getByText("J")).toBeInTheDocument()
  })

  it("submits FormData with a JSON-encoded data field on save", async () => {
    const user = userEvent.setup()
    mockUpdateProfileTrigger.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    render(<PersonalInfoForm initialFullName="Jane Doe" />)
    const input = screen.getByLabelText("organization.personalInfo.fullName")
    await user.clear(input)
    await user.type(input, "Jane Smith")
    await user.click(screen.getByRole("button", { name: "organization.personalInfo.saveChanges" }))

    await waitFor(() => expect(mockUpdateProfileTrigger).toHaveBeenCalled())
    const submittedFormData = mockUpdateProfileTrigger.mock.calls[0][0] as FormData
    expect(submittedFormData.get("data")).toBe(
      JSON.stringify({ fullName: "Jane Smith" })
    )
    // No file was chosen — the file field must not be present at all,
    // matching profile.service.ts's `if (file)` guard on the server.
    expect(submittedFormData.get("file")).toBeNull()
  })

  it("disables the save button when nothing has changed", () => {
    render(<PersonalInfoForm initialFullName="Jane Doe" />)
    expect(screen.getByRole("button", { name: "organization.personalInfo.saveChanges" })).toBeDisabled()
  })

  it("surfaces the backend error message on rejection", async () => {
    const user = userEvent.setup()
    const { toast } = await import("sonner")
    mockUpdateProfileTrigger.mockReturnValue({
      unwrap: () => Promise.reject({ data: { message: "Upload failed" } }),
    })

    render(<PersonalInfoForm initialFullName="Jane Doe" />)
    const input = screen.getByLabelText("organization.personalInfo.fullName")
    await user.clear(input)
    await user.type(input, "Jane Smith")
    await user.click(screen.getByRole("button", { name: "organization.personalInfo.saveChanges" }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Upload failed")
    )
  })

  it("includes the selected file in the submitted FormData", async () => {
    const user = userEvent.setup()
    mockUpdateProfileTrigger.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })
    const file = new File(["fake-image-bytes"], "avatar.png", {
      type: "image/png",
    })

    render(<PersonalInfoForm initialFullName="Jane Doe" />)
    await user.upload(screen.getByLabelText("organization.personalInfo.uploadPhoto"), file)
    await user.click(screen.getByRole("button", { name: "organization.personalInfo.saveChanges" }))

    await waitFor(() => expect(mockUpdateProfileTrigger).toHaveBeenCalled())
    const submittedFormData = mockUpdateProfileTrigger.mock.calls[0][0] as FormData
    expect(submittedFormData.get("file")).toBe(file)
  })

  it("re-disables Save Changes after a successful save (isDirty re-baselined)", async () => {
    const user = userEvent.setup()
    mockUpdateProfileTrigger.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    render(<PersonalInfoForm initialFullName="Jane Doe" />)
    const input = screen.getByLabelText("organization.personalInfo.fullName")
    await user.clear(input)
    await user.type(input, "Jane Smith")
    const saveButton = screen.getByRole("button", { name: "organization.personalInfo.saveChanges" })
    expect(saveButton).toBeEnabled()

    await user.click(saveButton)

    await waitFor(() => expect(saveButton).toBeDisabled())
  })

  it("disables the avatar upload button and file input while mounted with a save already in flight", () => {
    mockIsLoading = true
    render(<PersonalInfoForm initialFullName="Jane Doe" />)

    expect(
      screen.getByRole("button", { name: "organization.personalInfo.changePhoto" })
    ).toBeDisabled()
    expect(screen.getByLabelText("organization.personalInfo.uploadPhoto")).toBeDisabled()
  })

  it("disables the avatar controls when isLoading transitions to true mid-lifecycle", () => {
    // The static case above (mounted with isLoading already true) doesn't
    // prove the fix handles the real scenario: a user has the form open,
    // clicks Save, and isLoading flips true *while already mounted*. Force
    // that transition with rerender rather than a fresh mount. Found by
    // independent review — round 1's test only covered the static case.
    const { rerender } = render(<PersonalInfoForm initialFullName="Jane Doe" />)
    expect(
      screen.getByRole("button", { name: "organization.personalInfo.changePhoto" })
    ).toBeEnabled()

    mockIsLoading = true
    rerender(<PersonalInfoForm initialFullName="Jane Doe" />)

    expect(
      screen.getByRole("button", { name: "organization.personalInfo.changePhoto" })
    ).toBeDisabled()
    expect(screen.getByLabelText("organization.personalInfo.uploadPhoto")).toBeDisabled()
  })
})
