import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import OnboardingWizard from "./OnboardingWizard"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
import { toast } from "sonner"
const mockToastError = vi.mocked(toast.error)

const mockIdentify = vi.fn()
const mockGenerate = vi.fn()
const mockCommit = vi.fn()

vi.mock("@/redux/apis/organization/onboarding.api", () => ({
  useIdentifyCompanyMutation: () => [mockIdentify, { isLoading: false }],
  useGenerateOnboardingBaselineMutation: () => [
    mockGenerate,
    { isLoading: false },
  ],
  useCommitOnboardingMutation: () => [mockCommit, { isLoading: false }],
}))

const profile = {
  sector: "Manufacturing",
  sector_source: "is a manufacturer",
  hq_country: "France",
  hq_country_source: "based in Lyon",
  employee_band: "201-1000",
  employee_band_source: "around 500 staff",
  sites: 1,
  country: "France",
  number_of_employe: 500,
  sites_information: [
    {
      site_name: "Lyon Plant",
      site_location: "Lyon",
      site_primary_activity: "Manufacturing",
      site_country: "France",
      source_info: "https://example.com/lyon",
    },
  ],
}

const draft = {
  sites: [
    {
      site_name: "Lyon Plant",
      risks: [
        {
          name: "Supplier concentration",
          description: "Single supplier",
          category: "Supply Chain",
          inherent_score: 14,
          status: "open",
          kris: [
            {
              name: "Supplier On-Time Delivery %",
              unit: "%",
              current_value: 0,
              alert_threshold: 90,
              target_value: 98,
              frequency: "Monthly",
            },
          ],
        },
      ],
    },
  ],
}

const fillEntry = async () => {
  await userEvent.type(
    screen.getByPlaceholderText(
      "admin.onboarding.entry.companyNamePlaceholder"
    ),
    "Acme"
  )
  await userEvent.type(
    screen.getByPlaceholderText("admin.onboarding.entry.adminEmailPlaceholder"),
    "admin@acme.test"
  )
  await userEvent.type(screen.getByPlaceholderText("••••••••"), "supersecret1")
}

const okUnwrap = (data: unknown) => ({
  unwrap: () => Promise.resolve({ data }),
})

describe("OnboardingWizard", () => {
  beforeEach(() => {
    mockIdentify.mockReset()
    mockGenerate.mockReset()
    mockCommit.mockReset()
    mockToastError.mockReset()
  })

  it("renders the entry step first", () => {
    render(<OnboardingWizard onClose={vi.fn()} />)
    expect(
      screen.getByPlaceholderText(
        "admin.onboarding.entry.companyNamePlaceholder"
      )
    ).toBeInTheDocument()
  })

  // Round 9 audit (#474): the new-tenant admin email/password fields had no
  // autoComplete, unlike every other credential field fixed in earlier
  // rounds (#443-448).
  it("sets autoComplete on the admin email and password fields", () => {
    render(<OnboardingWizard onClose={vi.fn()} />)
    expect(
      screen.getByPlaceholderText(
        "admin.onboarding.entry.adminEmailPlaceholder"
      )
    ).toHaveAttribute("autocomplete", "email")
    expect(screen.getByPlaceholderText("••••••••")).toHaveAttribute(
      "autocomplete",
      "new-password"
    )
  })

  it("blocks Analyze and shows a validation error when required fields are empty", async () => {
    render(<OnboardingWizard onClose={vi.fn()} />)
    await userEvent.click(
      screen.getByRole("button", { name: "admin.onboarding.entry.analyze" })
    )
    expect(
      screen.getByText("admin.onboarding.errors.required")
    ).toBeInTheDocument()
    expect(mockIdentify).not.toHaveBeenCalled()
  })

  // Matches the backend's real rule (account.validation.ts's passwordSchema,
  // reused by organization.validation.ts's create_organization schema as of
  // aexa-server#380): 10+ chars, at least one letter, at least one number.
  // The old 8-char-only client check let through passwords the backend
  // would reject.
  it("enforces the 10-char/letter/number password rule before calling identify", async () => {
    render(<OnboardingWizard onClose={vi.fn()} />)
    await userEvent.type(
      screen.getByPlaceholderText(
        "admin.onboarding.entry.companyNamePlaceholder"
      ),
      "Acme"
    )
    await userEvent.type(
      screen.getByPlaceholderText(
        "admin.onboarding.entry.adminEmailPlaceholder"
      ),
      "admin@acme.test"
    )
    await userEvent.type(screen.getByPlaceholderText("••••••••"), "short1")
    await userEvent.click(
      screen.getByRole("button", { name: "admin.onboarding.entry.analyze" })
    )
    expect(
      screen.getByText("auth.resetPassword.newPasswordMinLength")
    ).toBeInTheDocument()
    expect(mockIdentify).not.toHaveBeenCalled()
  })

  it("blocks Analyze when the password has 10+ characters but no number", async () => {
    render(<OnboardingWizard onClose={vi.fn()} />)
    await userEvent.type(
      screen.getByPlaceholderText(
        "admin.onboarding.entry.companyNamePlaceholder"
      ),
      "Acme"
    )
    await userEvent.type(
      screen.getByPlaceholderText(
        "admin.onboarding.entry.adminEmailPlaceholder"
      ),
      "admin@acme.test"
    )
    await userEvent.type(
      screen.getByPlaceholderText("••••••••"),
      "longenoughpassword"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "admin.onboarding.entry.analyze" })
    )
    expect(
      screen.getByText("auth.resetPassword.newPasswordMinLength")
    ).toBeInTheDocument()
    expect(mockIdentify).not.toHaveBeenCalled()
  })

  it("advances to the confirm step and shows discovered sites with their source", async () => {
    mockIdentify.mockReturnValue(okUnwrap(profile))
    render(<OnboardingWizard onClose={vi.fn()} />)
    await fillEntry()
    await userEvent.click(
      screen.getByRole("button", { name: "admin.onboarding.entry.analyze" })
    )
    await waitFor(() =>
      expect(
        screen.getByText("admin.onboarding.confirm.discoveredSites")
      ).toBeInTheDocument()
    )
    expect(screen.getByDisplayValue("Lyon Plant")).toBeInTheDocument()
    // Grounded source snippet is visible so the reviewer can verify.
    expect(screen.getByText(/is a manufacturer/)).toBeInTheDocument()
  })

  // aexa-frontend#501 -- Radix's DialogTitle renders as an h2 (confirmed via
  // @radix-ui/react-dialog source: Primitive.h2). "Discovered sites" was an
  // h4 directly under that h2, skipping h3 -- broken heading order for
  // screen-reader users navigating by heading level.
  it("has no orphaned h4 -- 'Discovered sites' is an h3 directly under the dialog's h2 title", async () => {
    mockIdentify.mockReturnValue(okUnwrap(profile))
    render(<OnboardingWizard onClose={vi.fn()} />)
    await fillEntry()
    await userEvent.click(
      screen.getByRole("button", { name: "admin.onboarding.entry.analyze" })
    )
    await waitFor(() =>
      expect(
        screen.getByText("admin.onboarding.confirm.discoveredSites")
      ).toBeInTheDocument()
    )

    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument()
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "admin.onboarding.confirm.discoveredSites",
      })
    ).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 4 })).not.toBeInTheDocument()
  })

  it("generates and shows an editable, AI-badged review screen", async () => {
    mockIdentify.mockReturnValue(okUnwrap(profile))
    mockGenerate.mockReturnValue(okUnwrap(draft))
    render(<OnboardingWizard onClose={vi.fn()} />)
    await fillEntry()
    await userEvent.click(
      screen.getByRole("button", { name: "admin.onboarding.entry.analyze" })
    )
    await waitFor(() =>
      screen.getByText("admin.onboarding.confirm.discoveredSites")
    )
    await userEvent.click(
      screen.getByRole("button", { name: "admin.onboarding.confirm.continue" })
    )
    await waitFor(() =>
      expect(
        screen.getByDisplayValue("Supplier concentration")
      ).toBeInTheDocument()
    )
    // The mandatory review notice and the AI badge are present.
    expect(
      screen.getByText("admin.onboarding.review.notice")
    ).toBeInTheDocument()
    expect(screen.getByText("admin.onboarding.aiBadge")).toBeInTheDocument()
    // KRI baseline rendered under the risk.
    expect(
      screen.getByDisplayValue("Supplier On-Time Delivery %")
    ).toBeInTheDocument()
  })

  it("blocks Escape from discarding an in-progress AI-generated review", async () => {
    mockIdentify.mockReturnValue(okUnwrap(profile))
    mockGenerate.mockReturnValue(okUnwrap(draft))
    const onClose = vi.fn()
    render(<OnboardingWizard onClose={onClose} />)
    await fillEntry()
    await userEvent.click(
      screen.getByRole("button", { name: "admin.onboarding.entry.analyze" })
    )
    await waitFor(() =>
      screen.getByText("admin.onboarding.confirm.discoveredSites")
    )
    await userEvent.click(
      screen.getByRole("button", { name: "admin.onboarding.confirm.continue" })
    )
    await waitFor(() => screen.getByDisplayValue("Supplier concentration"))

    // On the review step there's a whole AI-generated draft to lose — a
    // stray Escape here must not silently discard it.
    await userEvent.keyboard("{Escape}")
    expect(onClose).not.toHaveBeenCalled()
    expect(
      screen.getByDisplayValue("Supplier concentration")
    ).toBeInTheDocument()
  })

  it("commits only the selected risks/KRIs and lands on the done screen with counts", async () => {
    mockIdentify.mockReturnValue(okUnwrap(profile))
    mockGenerate.mockReturnValue(okUnwrap(draft))
    mockCommit.mockReturnValue(
      okUnwrap({
        account: { id: "acc-1", email: "admin@acme.test" },
        organization: { id: "org-1", name: "Acme" },
        counts: { sites: 1, risks: 1, kris: 1 },
      })
    )
    render(<OnboardingWizard onClose={vi.fn()} />)
    await fillEntry()
    await userEvent.click(
      screen.getByRole("button", { name: "admin.onboarding.entry.analyze" })
    )
    await waitFor(() =>
      screen.getByText("admin.onboarding.confirm.discoveredSites")
    )
    await userEvent.click(
      screen.getByRole("button", { name: "admin.onboarding.confirm.continue" })
    )
    await waitFor(() => screen.getByDisplayValue("Supplier concentration"))

    await userEvent.click(
      screen.getByRole("button", {
        name: "admin.onboarding.review.createOrganization",
      })
    )

    await waitFor(() =>
      expect(
        screen.getByText("admin.onboarding.done.title")
      ).toBeInTheDocument()
    )

    // The committed payload carried the org credentials + one selected risk
    // with its nested KRI, all AI-generated flags handled server-side.
    const payload = mockCommit.mock.calls[0][0]
    expect(payload.organizationName).toBe("Acme")
    expect(payload.email).toBe("admin@acme.test")
    expect(payload.sites[0].risks).toHaveLength(1)
    expect(payload.sites[0].risks[0].kris).toHaveLength(1)
  })

  it("excludes a deselected risk from the commit payload", async () => {
    mockIdentify.mockReturnValue(okUnwrap(profile))
    mockGenerate.mockReturnValue(okUnwrap(draft))
    mockCommit.mockReturnValue(
      okUnwrap({
        account: { id: "acc-1", email: "admin@acme.test" },
        organization: { id: "org-1", name: "Acme" },
        counts: { sites: 1, risks: 0, kris: 0 },
      })
    )
    render(<OnboardingWizard onClose={vi.fn()} />)
    await fillEntry()
    await userEvent.click(
      screen.getByRole("button", { name: "admin.onboarding.entry.analyze" })
    )
    await waitFor(() =>
      screen.getByText("admin.onboarding.confirm.discoveredSites")
    )
    await userEvent.click(
      screen.getByRole("button", { name: "admin.onboarding.confirm.continue" })
    )
    await waitFor(() => screen.getByDisplayValue("Supplier concentration"))

    // Uncheck the single risk.
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "admin.onboarding.review.includeRisk",
      })
    )
    await userEvent.click(
      screen.getByRole("button", {
        name: "admin.onboarding.review.createOrganization",
      })
    )

    await waitFor(() => expect(mockCommit).toHaveBeenCalled())
    const payload = mockCommit.mock.calls[0][0]
    expect(payload.sites[0].risks).toHaveLength(0)
  })

  it("blocks the header X button from discarding an in-progress AI-generated review", async () => {
    mockIdentify.mockReturnValue(okUnwrap(profile))
    mockGenerate.mockReturnValue(okUnwrap(draft))
    const onClose = vi.fn()
    render(<OnboardingWizard onClose={onClose} />)
    await fillEntry()
    await userEvent.click(
      screen.getByRole("button", { name: "admin.onboarding.entry.analyze" })
    )
    await waitFor(() =>
      screen.getByText("admin.onboarding.confirm.discoveredSites")
    )
    await userEvent.click(
      screen.getByRole("button", { name: "admin.onboarding.confirm.continue" })
    )
    await waitFor(() => screen.getByDisplayValue("Supplier concentration"))

    // The visible X in the header must respect the same guard as
    // Escape/outside-click — a single click here must not silently discard
    // the AI-generated draft.
    await userEvent.click(
      screen.getByRole("button", { name: "admin.onboarding.close" })
    )
    expect(onClose).not.toHaveBeenCalled()
    expect(
      screen.getByDisplayValue("Supplier concentration")
    ).toBeInTheDocument()
  })

  it("lets the header X button close the wizard on the entry step, with nothing at risk", async () => {
    const onClose = vi.fn()
    render(<OnboardingWizard onClose={onClose} />)
    await userEvent.click(
      screen.getByRole("button", { name: "admin.onboarding.close" })
    )
    expect(onClose).toHaveBeenCalled()
  })

  it("exposes all five AI-suggested site fields as editable inputs in the confirm step", async () => {
    mockIdentify.mockReturnValue(okUnwrap(profile))
    render(<OnboardingWizard onClose={vi.fn()} />)
    await fillEntry()
    await userEvent.click(
      screen.getByRole("button", { name: "admin.onboarding.entry.analyze" })
    )
    await waitFor(() =>
      screen.getByText("admin.onboarding.confirm.discoveredSites")
    )

    // site_name/site_location were already editable before this fix; the
    // other five AI-suggested fields must now be too.
    const activityInput = screen.getByPlaceholderText(
      "admin.onboarding.confirm.sitePrimaryActivity"
    )
    expect(activityInput).toHaveValue("Manufacturing")
    const countryInput = screen.getByPlaceholderText(
      "admin.onboarding.confirm.siteCountry"
    )
    expect(countryInput).toHaveValue("France")
    expect(
      screen.getByPlaceholderText("admin.onboarding.confirm.siteRevenue")
    ).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText("admin.onboarding.confirm.siteEmployees")
    ).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText("admin.onboarding.confirm.siteType")
    ).toBeInTheDocument()

    // And they're actually wired up, not just rendered.
    await userEvent.clear(countryInput)
    await userEvent.type(countryInput, "Germany")
    expect(countryInput).toHaveValue("Germany")
  })

  it("closes on Escape key press, handled by the underlying Radix Dialog", async () => {
    const onClose = vi.fn()
    render(<OnboardingWizard onClose={onClose} />)

    await userEvent.keyboard("{Escape}")

    expect(onClose).toHaveBeenCalled()
  })

  // Regression: none of this file's raw <button> elements declared
  // type="button", defaulting to the implicit type="submit" -- harmless only
  // because this wizard's markup never sits inside a <form>, but a latent
  // footgun if it ever does. Same convention as InspectionActions.test.tsx's
  // "gives every button an explicit type" test. Each step (entry/confirm/
  // review/done) is mutually exclusive with the others, so this checks
  // every button as it mounts on each step walked through, rather than a
  // single final snapshot.
  it("gives every button on every step an explicit type so none default to implicit submit", async () => {
    mockIdentify.mockReturnValue(okUnwrap(profile))
    mockGenerate.mockReturnValue(okUnwrap(draft))
    mockCommit.mockReturnValue(
      okUnwrap({
        account: { id: "acc-1", email: "admin@acme.test" },
        organization: { id: "org-1", name: "Acme" },
        counts: { sites: 1, risks: 1, kris: 1 },
      })
    )
    render(<OnboardingWizard onClose={vi.fn()} />)

    function expectEveryButtonTyped() {
      const buttons = document.querySelectorAll("button")
      expect(buttons.length).toBeGreaterThan(0)
      buttons.forEach((button) => {
        expect(button.type).toBe("button")
      })
    }

    // Entry step: header close X, Cancel, Analyze.
    expectEveryButtonTyped()
    await fillEntry()
    await userEvent.click(
      screen.getByRole("button", { name: "admin.onboarding.entry.analyze" })
    )
    await waitFor(() =>
      screen.getByText("admin.onboarding.confirm.discoveredSites")
    )

    // Confirm step: header close X, Add site, Back, Continue.
    expectEveryButtonTyped()
    await userEvent.click(
      screen.getByRole("button", { name: "admin.onboarding.confirm.continue" })
    )
    await waitFor(() => screen.getByDisplayValue("Supplier concentration"))

    // Review step: header close X, per-risk exclude (Trash2), Back, commit.
    expectEveryButtonTyped()
    await userEvent.click(
      screen.getByRole("button", {
        name: "admin.onboarding.review.createOrganization",
      })
    )
    await waitFor(() =>
      expect(
        screen.getByText("admin.onboarding.done.title")
      ).toBeInTheDocument()
    )

    // Done step: header close X, close button.
    expectEveryButtonTyped()
  })

  // The client-side check mirrors the backend rule but isn't a substitute for
  // it -- if the backend still rejects the password (e.g. a rule change), the
  // commit's zod failure comes back as a generic top-level "Validation
  // Error" message with the real reason in errorSources[{path: "password"}].
  // That must surface as a specific, actionable error back on the entry
  // step (where the password field lives), not a useless toast.
  it("maps a commit-time password errorSources entry back onto the entry step instead of a generic toast", async () => {
    mockIdentify.mockReturnValue(okUnwrap(profile))
    mockGenerate.mockReturnValue(okUnwrap(draft))
    mockCommit.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          data: {
            message: "Validation Error",
            errorSources: [
              { path: "password", message: "Password must contain at least one number." },
            ],
          },
        }),
    })
    render(<OnboardingWizard onClose={vi.fn()} />)
    await fillEntry()
    await userEvent.click(
      screen.getByRole("button", { name: "admin.onboarding.entry.analyze" })
    )
    await waitFor(() =>
      screen.getByText("admin.onboarding.confirm.discoveredSites")
    )
    await userEvent.click(
      screen.getByRole("button", { name: "admin.onboarding.confirm.continue" })
    )
    await waitFor(() => screen.getByDisplayValue("Supplier concentration"))
    await userEvent.click(
      screen.getByRole("button", {
        name: "admin.onboarding.review.createOrganization",
      })
    )

    await waitFor(() =>
      expect(
        screen.getByText("Password must contain at least one number.")
      ).toBeInTheDocument()
    )
    // Back on the entry step, not a generic toast.
    expect(
      screen.getByPlaceholderText(
        "admin.onboarding.entry.companyNamePlaceholder"
      )
    ).toBeInTheDocument()
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it("shows a toast and stays on entry when identify fails", async () => {
    mockIdentify.mockReturnValue({
      unwrap: () => Promise.reject({ data: { message: "boom" } }),
    })
    render(<OnboardingWizard onClose={vi.fn()} />)
    await fillEntry()
    await userEvent.click(
      screen.getByRole("button", { name: "admin.onboarding.entry.analyze" })
    )
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith("boom"))
    expect(
      screen.getByPlaceholderText(
        "admin.onboarding.entry.companyNamePlaceholder"
      )
    ).toBeInTheDocument()
  })
})
