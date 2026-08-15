import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import AdminOverview from "./AdminOverview"

// Controllable `i18n.language` for the locale-formatting test below, same
// technique as FindingDetails.test.tsx/AdminOrganization.test.tsx.
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

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminOverview />
    </MemoryRouter>
  )
}

describe("AdminOverview", () => {
  beforeEach(() => {
    mockLanguage = undefined
  })

  // Issue #365: Quick Actions and "View All" used to link to
  // /admin-dashboard/settings and /admin-dashboard/transaction, routes that
  // don't exist. They now point at the real /admin/settings and
  // /admin/transaction routes.
  it("links Quick Actions and View All to real admin routes, not the nonexistent /admin-dashboard/* paths", () => {
    renderPage()

    const links = screen.getAllByRole("link")
    const hrefs = links.map((link) => link.getAttribute("href"))

    expect(hrefs).toContain("/admin/settings")
    expect(hrefs).toContain("/admin/transaction")
    expect(hrefs.some((href) => href?.startsWith("/admin-dashboard"))).toBe(
      false,
    )
  })

  // Found during an app-wide accessibility audit (focus-visible ring sweep,
  // PR #805) but left out of that PR's scope since it's a different, deeper
  // bug than a missing focus ring: both Quick Action controls used to be a
  // <button> nested inside a <Link>, invalid HTML that made the inner
  // <button> unreachable via Tab (only the outer <a> was focusable), even
  // though it was the button that looked/was styled as the actual control.
  // The styling now lives directly on the <Link>, with no nested button.
  it("renders each Quick Action as a single focusable link, not a button nested inside a link (#805 follow-up)", () => {
    renderPage()

    const managePlansLink = screen.getByRole("link", {
      name: "admin.overview.managePlans",
    })
    const viewTransactionsLink = screen.getByRole("link", {
      name: "admin.overview.viewTransactions",
    })

    expect(managePlansLink).toHaveAttribute("href", "/admin/settings")
    expect(viewTransactionsLink).toHaveAttribute("href", "/admin/transaction")
    expect(managePlansLink.querySelector("button")).toBeNull()
    expect(viewTransactionsLink.querySelector("button")).toBeNull()
  })

  // Round-1 review of this same PR caught the identical pattern two elements
  // away: the Recent Payments card's "View All" control was also a <button>
  // nested inside a <Link>. Same fix, same file.
  it("renders View All as a single focusable link, not a button nested inside a link (#805 follow-up)", () => {
    renderPage()

    const viewAllLink = screen.getByRole("link", {
      name: "admin.overview.viewAll",
    })

    expect(viewAllLink).toHaveAttribute("href", "/admin/transaction")
    expect(viewAllLink.querySelector("button")).toBeNull()
  })

  // Real keyboard Tab-order check, not just DOM structure -- exercises
  // jsdom's actual tab-order algorithm the way a real Tab key press would,
  // the same class of check the bug report asked for. With the old
  // <Link><button>...</button></Link> nesting, only the outer anchor was
  // reachable and the inner button (the element that actually looked/was
  // styled as the control) was skipped entirely by the browser's tab order.
  it("reaches each Quick Action link directly via sequential Tab key presses", async () => {
    const user = userEvent.setup()
    renderPage()

    const managePlansLink = screen.getByRole("link", {
      name: "admin.overview.managePlans",
    })
    const viewTransactionsLink = screen.getByRole("link", {
      name: "admin.overview.viewTransactions",
    })

    managePlansLink.focus()
    expect(managePlansLink).toHaveFocus()

    await user.tab()
    expect(viewTransactionsLink).toHaveFocus()
  })

  // Issue #364: the "Recent Payments" date column used a local, inline
  // toLocaleDateString("en-US", ...) hardcoded in two places (desktop table
  // + mobile cards), ignoring the app's selected language. Both now go
  // through the shared formatLocaleDate helper.
  describe("locale-aware recent-payment date formatting (#364)", () => {
    const dateOptions: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year: "numeric",
    }

    it("formats recent-payment dates using the French locale when i18n.language starts with fr", () => {
      mockLanguage = "fr-FR"
      renderPage()

      const expected = new Date("2025-12-15").toLocaleDateString(
        "fr-FR",
        dateOptions
      )
      // Rendered once in the desktop table and once in the mobile card.
      expect(screen.getAllByText(expected).length).toBeGreaterThan(0)
    })

    it("formats recent-payment dates using the English locale by default", () => {
      renderPage()

      const expected = new Date("2025-12-15").toLocaleDateString(
        "en-US",
        dateOptions
      )
      expect(screen.getAllByText(expected).length).toBeGreaterThan(0)
    })
  })

  // Round 9 audit (#474): stats, revenue chart, and Recent Payments were all
  // hardcoded fixtures rendered with zero indication they weren't real
  // platform data. A disclosure banner now says so explicitly, matching the
  // pattern already used on PricingPlans.tsx.
  it("discloses that the dashboard data is sample content, not live data", () => {
    renderPage()
    expect(
      screen.getByText("admin.overview.notConnectedNotice")
    ).toBeInTheDocument()
  })

  // Round 9 audit (#474): the revenue-period <select> had no value/onChange
  // wiring, so picking "Last 6 Months" silently did nothing since the chart
  // is always the same static 12-month array. Disabling it (with an
  // explanatory tooltip/aria-label) is more honest than a select that looks
  // functional but isn't.
  it("disables the revenue-period selector and gives it an accessible name", () => {
    renderPage()
    const select = screen.getByLabelText("admin.overview.periodSelectorLabel")
    expect(select).toBeDisabled()
    expect(select).toHaveAttribute(
      "title",
      "admin.overview.periodSelectorDisabledHint"
    )
  })

  // Raw <button>s with no explicit type default to type="submit" per the
  // HTML spec -- a latent bug if this page ever ends up inside a <form>.
  // Every button rendered by this page's default fixture is a raw
  // <button> (no shadcn <Button> usage here), and none are gated behind
  // extra interaction/data, so a full sweep covers all of them.
  it("gives every button an explicit type so none default to implicit submit", () => {
    renderPage()

    const buttons = document.querySelectorAll("button")
    expect(buttons.length).toBeGreaterThan(0)
    buttons.forEach((button) => {
      expect(button.type).toBe("button")
    })
  })
})
