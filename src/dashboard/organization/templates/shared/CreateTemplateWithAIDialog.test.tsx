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

  // Phase C (theme-improvement-initiative): the cycling loading message
  // used to cross-fade via framer-motion's AnimatePresence, the library's
  // only usage site in this repo -- swapped for the same CSS-only
  // animate-fade-in entrance class every other reveal-on-mount already
  // uses. Not a framer-motion behavior test (that library is gone now);
  // this proves the replacement actually renders with the class applied,
  // not just that the message text itself still shows.
  it("applies the shared CSS entrance animation class to the loading message", async () => {
    let resolveMutation: (value: unknown) => void = () => {}
    mockGenerateTemplateWithPrompt.mockReturnValue({
      unwrap: () => new Promise((resolve) => (resolveMutation = resolve)),
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

    const loadingMessage = await screen.findByText(
      /organization\.templates\.ai\.loading/i
    )
    expect(loadingMessage.className).toContain("animate-fade-in")

    // Let the pending mutation resolve so the interval/effect it drives
    // doesn't leak into the next test.
    resolveMutation({ success: true })
  })

  // Raw <button>s with no explicit type default to type="submit" per the
  // HTML spec -- a latent bug if this dialog ever ends up inside a <form>.
  // Scoped assertions (not a full sweep) since the dialog footer also
  // renders shadcn <Button>s with no explicit type prop -- a separate,
  // pre-existing gap out of scope for this fix -- so a sweep would either
  // fail on those or silently miss them.
  it("gives the three mode-select cards an explicit type=\"button\"", () => {
    render(<CreateTemplateWithAIDialog open setOpen={vi.fn()} />)

    expect(
      screen
        .getByText("organization.templates.ai.promptOption.title")
        .closest("button")!.type
    ).toBe("button")
    expect(
      screen
        .getByText("organization.templates.ai.fileOption.title")
        .closest("button")!.type
    ).toBe("button")
    expect(
      screen
        .getByText("organization.templates.ai.riskOption.title")
        .closest("button")!.type
    ).toBe("button")
  })
})
