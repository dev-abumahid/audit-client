import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MOCK_RISKS } from "@/dashboard/organization/risk/riskMatrixMockData"
import { canWriteOrgResource } from "@/hooks/useMyOrgRole"
import RoleScopedRegisterWidget from "./RoleScopedRegisterWidget"

// The test environment does not initialize i18n, so t() echoes the raw key
// -- same convention as the other productDemo widget tests. Role/action
// labels are asserted by their raw key, not literal English text.
const EDIT_KEY = "home.productDemo.roleRegister.editButton"
const APPROVE_KEY = "home.productDemo.roleRegister.approveButton"
const REJECT_KEY = "home.productDemo.roleRegister.rejectButton"
const PENDING_BADGE_KEY = "home.productDemo.roleRegister.pendingBadge"
const READ_ONLY_CAPTION_KEY = "home.productDemo.roleRegister.captionReadOnly"
const ADMIN_CAPTION_KEY = "home.productDemo.roleRegister.captionAdmin"
const LEAD_AUDITOR_CAPTION_KEY =
  "home.productDemo.roleRegister.captionLeadAuditor"
// Same row the widget itself flags as pending approval (DEMO_RISKS[1]).
const PENDING_APPROVAL_REF = MOCK_RISKS[1].ref

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

  // CEO feedback: canWriteOrgResource alone made Admin and Lead Auditor
  // render identically -- every row showed the same Edit button either
  // way. Real distinction now: RiskApprovalControls.tsx's own maker-
  // checker gate (isAdmin decides, Lead Auditor only submits) is
  // surfaced on one demo row (PENDING_APPROVAL_REF) so switching between
  // these two roles now visibly changes something, not just a caption.
  describe("Admin vs. Lead Auditor: the real maker-checker distinction", () => {
    it("gives Admin real Approve/Reject controls on the pending row", () => {
      render(<RoleScopedRegisterWidget />)
      expect(
        screen.getByRole("button", { name: APPROVE_KEY })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: REJECT_KEY })
      ).toBeInTheDocument()
      expect(screen.queryByText(PENDING_BADGE_KEY)).not.toBeInTheDocument()
      expect(screen.getByText(ADMIN_CAPTION_KEY)).toBeInTheDocument()
    })

    it("gives Lead Auditor a read-only Pending badge on the same row, no Approve/Reject", async () => {
      const user = userEvent.setup()
      render(<RoleScopedRegisterWidget />)
      await user.click(
        screen.getByRole("radio", {
          name: "home.productDemo.roleRegister.roles.LEAD_AUDITOR",
        })
      )

      expect(screen.getByText(PENDING_BADGE_KEY)).toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: APPROVE_KEY })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: REJECT_KEY })
      ).not.toBeInTheDocument()
      expect(screen.getByText(LEAD_AUDITOR_CAPTION_KEY)).toBeInTheDocument()
    })

    it("still shows the plain Edit button on every non-pending row for both roles", async () => {
      const user = userEvent.setup()
      render(<RoleScopedRegisterWidget />)
      // 5 demo rows, 1 flagged pending -> 4 plain Edit buttons for Admin.
      expect(screen.getAllByText(EDIT_KEY)).toHaveLength(4)

      await user.click(
        screen.getByRole("radio", {
          name: "home.productDemo.roleRegister.roles.LEAD_AUDITOR",
        })
      )
      expect(screen.getAllByText(EDIT_KEY)).toHaveLength(4)
    })

    it("flags a real risk ref, not a fabricated one", () => {
      expect(PENDING_APPROVAL_REF).toBeTruthy()
      render(<RoleScopedRegisterWidget />)
      expect(screen.getByText(PENDING_APPROVAL_REF)).toBeInTheDocument()
    })
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

  // Quality-bar-loop round 1 (mobile + UX judges, independently confirmed):
  // the role-picker pills were 28px tall and the Approve/Reject icon
  // buttons were ~22x22px, both under the 44px touch-target guideline.
  it("gives the role-picker buttons a real 44px touch target", () => {
    render(<RoleScopedRegisterWidget />)
    const admin = screen.getByRole("radio", {
      name: "home.productDemo.roleRegister.roles.ADMIN",
    })
    expect(admin.className).toContain("min-h-11")
  })

  it("gives the Approve/Reject buttons a real 44x44px touch target", () => {
    render(<RoleScopedRegisterWidget />)
    const approve = screen.getByRole("button", { name: APPROVE_KEY })
    const reject = screen.getByRole("button", { name: REJECT_KEY })
    expect(approve.className).toContain("h-11")
    expect(approve.className).toContain("w-11")
    expect(reject.className).toContain("h-11")
    expect(reject.className).toContain("w-11")
  })
})
