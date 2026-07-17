import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import PasswordChangeForm from "./PasswordChangeForm"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mockChangePasswordTrigger = vi.fn()
vi.mock("@/redux/apis/auth.api", () => ({
  useChangePasswordMutation: () => [
    mockChangePasswordTrigger,
    { isLoading: false },
  ],
}))

describe("PasswordChangeForm", () => {
  beforeEach(() => {
    mockChangePasswordTrigger.mockReset()
  })

  it("renders all three fields", () => {
    render(<PasswordChangeForm />)
    expect(screen.getByLabelText("Current Password")).toBeInTheDocument()
    expect(screen.getByLabelText("New Password")).toBeInTheDocument()
    expect(screen.getByLabelText("Confirm New Password")).toBeInTheDocument()
  })

  it("submits oldPassword/newPassword (not confirmPassword) on valid input", async () => {
    const user = userEvent.setup()
    mockChangePasswordTrigger.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    render(<PasswordChangeForm />)
    await user.type(screen.getByLabelText("Current Password"), "old-pass")
    await user.type(screen.getByLabelText("New Password"), "new-password-1")
    await user.type(
      screen.getByLabelText("Confirm New Password"),
      "new-password-1"
    )
    await user.click(screen.getByRole("button", { name: "Change Password" }))

    await waitFor(() =>
      expect(mockChangePasswordTrigger).toHaveBeenCalledWith({
        oldPassword: "old-pass",
        newPassword: "new-password-1",
      })
    )
  })

  it("shows a validation error and does not submit when confirmation doesn't match", async () => {
    const user = userEvent.setup()

    render(<PasswordChangeForm />)
    await user.type(screen.getByLabelText("Current Password"), "old-pass")
    await user.type(screen.getByLabelText("New Password"), "new-password-1")
    await user.type(
      screen.getByLabelText("Confirm New Password"),
      "totally-different"
    )
    await user.click(screen.getByRole("button", { name: "Change Password" }))

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument()
    expect(mockChangePasswordTrigger).not.toHaveBeenCalled()
  })

  it("surfaces the backend error message on rejection (e.g. incorrect password)", async () => {
    const user = userEvent.setup()
    const { toast } = await import("sonner")
    mockChangePasswordTrigger.mockReturnValue({
      unwrap: () => Promise.reject({ data: { message: "Incorrect password" } }),
    })

    render(<PasswordChangeForm />)
    await user.type(screen.getByLabelText("Current Password"), "wrong-pass")
    await user.type(screen.getByLabelText("New Password"), "new-password-1")
    await user.type(
      screen.getByLabelText("Confirm New Password"),
      "new-password-1"
    )
    await user.click(screen.getByRole("button", { name: "Change Password" }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Incorrect password")
    )
  })

  it("surfaces the backend's same-password error verbatim (404 from change_password_into_db)", async () => {
    const user = userEvent.setup()
    const { toast } = await import("sonner")
    mockChangePasswordTrigger.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          data: {
            message:
              "Old and new password are same, Please provide different password",
          },
        }),
    })

    render(<PasswordChangeForm />)
    await user.type(screen.getByLabelText("Current Password"), "same-pass")
    await user.type(screen.getByLabelText("New Password"), "same-pass")
    await user.type(screen.getByLabelText("Confirm New Password"), "same-pass")
    await user.click(screen.getByRole("button", { name: "Change Password" }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Old and new password are same, Please provide different password"
      )
    )
  })
})
