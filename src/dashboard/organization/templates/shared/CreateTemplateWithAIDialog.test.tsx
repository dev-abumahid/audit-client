import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import CreateTemplateWithAIDialog from "./CreateTemplateWithAIDialog"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mockNavigate = vi.fn()
vi.mock("react-router", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router")>()
  return { ...mod, useNavigate: () => mockNavigate }
})

const mockGenerateTemplateWithPrompt = vi.fn()
vi.mock("@/redux/apis/organization/ai.api", () => ({
  useGenerateTemplateWithPromptMutation: () => [
    mockGenerateTemplateWithPrompt,
  ],
  useGenerateTemplateWithPdfMutation: () => [vi.fn()],
  useGenerateTemplateWithRiskMutation: () => [vi.fn()],
}))

vi.mock("@/redux/apis/organization/risk.api", () => ({
  useGetAllRisksQuery: () => ({ data: { data: [] } }),
}))

import { toast } from "sonner"
const mockToastError = vi.mocked(toast.error)

describe("CreateTemplateWithAIDialog", () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockGenerateTemplateWithPrompt.mockReset()
    mockToastError.mockReset()
  })

  it('shows the server error message when the mutation rejects with error.data.message', async () => {
    mockGenerateTemplateWithPrompt.mockReturnValue({
      unwrap: () =>
        Promise.reject({ data: { message: "Risk score is missing" } }),
    })

    render(<CreateTemplateWithAIDialog open setOpen={vi.fn()} />)

    await userEvent.click(screen.getByText("organization.templates.ai.promptOption.title"))
    await userEvent.type(
      screen.getByPlaceholderText("organization.templates.ai.promptPlaceholder"),
      "A safety checklist"
    )
    await userEvent.click(
      screen.getByRole("button", { name: /organization\.templates\.ai\.generateTemplate/i })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Risk score is missing")
    )
  })

  it("falls back to the generic message when there is no error.data.message", async () => {
    mockGenerateTemplateWithPrompt.mockReturnValue({
      unwrap: () => Promise.reject(new Error("Network error")),
    })

    render(<CreateTemplateWithAIDialog open setOpen={vi.fn()} />)

    await userEvent.click(screen.getByText("organization.templates.ai.promptOption.title"))
    await userEvent.type(
      screen.getByPlaceholderText("organization.templates.ai.promptPlaceholder"),
      "A safety checklist"
    )
    await userEvent.click(
      screen.getByRole("button", { name: /organization\.templates\.ai\.generateTemplate/i })
    )

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("organization.templates.ai.createFailed")
    )
  })
})
