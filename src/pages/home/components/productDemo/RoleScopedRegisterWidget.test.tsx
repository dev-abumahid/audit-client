import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { canWriteOrgResource } from "@/hooks/useMyOrgRole"
import RoleScopedRegisterWidget from "./RoleScopedRegisterWidget"

// The test environment does not initialize i18n, so t() echoes the raw key
// -- same convention as the other productDemo widget tests. Role/action
// labels are asserted by their raw key, not literal English text.
const EDIT_KEY = "home.productDemo.roleRegister.editButton"
const READ_ONLY_CAPTION_KEY = "home.productDemo.roleRegister.captionReadOnly"
const SAME_GATE_CAPTION_KEY = "home.productDemo.roleRegister.captionSameGate"

describe("RoleScopedRegisterWidget", () => {
  it("defaults to Admin with the Action column visible", () => {
    render(<RoleScopedRegisterWidget />)
    expect(
      screen.getByRole("radio", {
        name: "home.productDemo.roleRegister.roles.ADMIN",
        checked: true,
      })
    ).toBeInTheDocument()
    expect(screen.getAllByText(EDIT_KEY).length).toBeGreaterThan(0)
  })

  it("shows the Action column for Lead Auditor, matching the real canWriteOrgResource gate", async () => {
    const user = userEvent.setup()
    render(<RoleScopedRegisterWidget />)
    await user.click(
      screen.getByRole("radio", {
        name: "home.productDemo.roleRegister.roles.LEAD_AUDITOR",
      })
    )

    // Real function, not a hand-copied gate -- confirms the widget's
    // observed behavior actually matches what canWriteOrgResource returns
    // for this role, not a coincidentally-similar local rule.
    expect(canWriteOrgResource("LEAD_AUDITOR")).toBe(true)
    expect(screen.getAllByText(EDIT_KEY).length).toBeGreaterThan(0)
  })

  it("hides the Action column for Light User, matching the real gate", async () => {
    const user = userEvent.setup()
    render(<RoleScopedRegisterWidget />)
    await user.click(
      screen.getByRole("radio", {
        name: "home.productDemo.roleRegister.roles.LIGHT_USER",
      })
    )

    expect(canWriteOrgResource("LIGHT_USER")).toBe(false)
    expect(screen.queryByText(EDIT_KEY)).not.toBeInTheDocument()
    expect(screen.getByText(READ_ONLY_CAPTION_KEY)).toBeInTheDocument()
  })

  it("discloses that Admin and Lead Auditor share this gate today", async () => {
    const user = userEvent.setup()
    render(<RoleScopedRegisterWidget />)
    expect(screen.getByText(SAME_GATE_CAPTION_KEY)).toBeInTheDocument()

    await user.click(
      screen.getByRole("radio", {
        name: "home.productDemo.roleRegister.roles.LEAD_AUDITOR",
      })
    )
    expect(screen.getByText(SAME_GATE_CAPTION_KEY)).toBeInTheDocument()
  })

  // Review finding on PR #1017: role="radiogroup"/role="radio" implies the
  // same ARIA APG arrow-key navigation + roving tabindex pattern DemoTabs
  // already got fixed for in the prior PR -- verify this widget's
  // radiogroup got the same fix, not just a click handler.
  it("supports arrow-key navigation with roving tabindex", async () => {
    const user = userEvent.setup()
    render(<RoleScopedRegisterWidget />)
    const admin = screen.getByRole("radio", {
      name: "home.productDemo.roleRegister.roles.ADMIN",
    })
    const leadAuditor = screen.getByRole("radio", {
      name: "home.productDemo.roleRegister.roles.LEAD_AUDITOR",
    })
    const lightUser = screen.getByRole("radio", {
      name: "home.productDemo.roleRegister.roles.LIGHT_USER",
    })

    expect(admin).toHaveAttribute("tabindex", "0")
    expect(leadAuditor).toHaveAttribute("tabindex", "-1")

    admin.focus()
    await user.keyboard("{ArrowRight}")
    expect(leadAuditor).toHaveAttribute("aria-checked", "true")
    expect(leadAuditor).toHaveAttribute("tabindex", "0")
    expect(admin).toHaveAttribute("tabindex", "-1")
    expect(leadAuditor).toHaveFocus()

    await user.keyboard("{End}")
    expect(lightUser).toHaveAttribute("aria-checked", "true")
    expect(lightUser).toHaveFocus()

    await user.keyboard("{Home}")
    expect(admin).toHaveAttribute("aria-checked", "true")
    expect(admin).toHaveFocus()
  })

  it("renders real risk refs from the shared mock fixture, not fabricated rows", () => {
    render(<RoleScopedRegisterWidget />)
    expect(screen.getByText("CYB-014")).toBeInTheDocument()
    expect(screen.getByText("SUP-007")).toBeInTheDocument()
    expect(
      screen.getByText("Ransomware exposure via unpatched VPN gateway")
    ).toBeInTheDocument()
  })
})
