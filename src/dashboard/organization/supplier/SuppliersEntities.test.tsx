import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import SuppliersEntities from "./SuppliersEntities"

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

import { toast } from "sonner"
const mockToastError = vi.mocked(toast.error)
const mockToastSuccess = vi.mocked(toast.success)

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts?.name ? `${key} ${opts.name}` : key,
  }),
}))

let mockRole: string | undefined = "ADMIN"
vi.mock("@/hooks/useMyOrgRole", () => ({
  useMyOrgRole: () => mockRole,
  canWriteOrgResource: (role: string | undefined) =>
    role === "ADMIN" || role === "LEAD_AUDITOR",
}))

const mockUseGetAllSuppliersQuery = vi.fn()
const mockCreateNewSupplier = vi.fn()
const mockUpdateSupplier = vi.fn()
const mockDeleteSupplier = vi.fn()
const mockDiscoverSuppliers = vi.fn()
const mockBulkUpdateStatus = vi.fn()
const mockBulkDeleteSuppliers = vi.fn()

vi.mock("@/redux/apis/organization/supplier.api", () => ({
  useGetAllSuppliersQuery: (...args: unknown[]) => mockUseGetAllSuppliersQuery(...args),
  useCreateNewSupplierMutation: () => [mockCreateNewSupplier, { isLoading: false }],
  useUpdateSupplierMutation: () => [mockUpdateSupplier, { isLoading: false }],
  useDeleteSupplierMutation: () => [mockDeleteSupplier, { isLoading: false }],
  useDiscoverSuppliersMutation: () => [mockDiscoverSuppliers, { isLoading: false }],
  useBulkUpdateSupplierStatusMutation: () => [
    mockBulkUpdateStatus,
    { isLoading: false },
  ],
  useBulkDeleteSuppliersMutation: () => [mockBulkDeleteSuppliers, { isLoading: false }],
}))

const SUPPLIER = {
  id: "s1",
  name: "Acme Steel",
  country: "France",
  notes: null,
  risk_tier: "HIGH",
  next_review_date: null,
  primary_contact_name: null,
  primary_contact_email: null,
  contract_status: null,
  status: "ACTIVE",
  ai_generated: false,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
}

function mockUnwrap(mockFn: ReturnType<typeof vi.fn>, value: unknown) {
  mockFn.mockReturnValue({ unwrap: () => Promise.resolve(value) })
}

function mockUnwrapRejects(mockFn: ReturnType<typeof vi.fn>, error: unknown = new Error("fail")) {
  mockFn.mockReturnValue({ unwrap: () => Promise.reject(error) })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRole = "ADMIN"
  mockUseGetAllSuppliersQuery.mockReturnValue({
    data: { data: [SUPPLIER], meta: { page: 1, limit: 20, total: 1, totalPage: 1 } },
    isLoading: false,
    error: undefined,
  })
})

describe("SuppliersEntities", () => {
  it("renders the supplier list", () => {
    render(<SuppliersEntities />)
    expect(screen.getByText("Acme Steel")).toBeInTheDocument()
    expect(screen.getByText("France")).toBeInTheDocument()
  })

  it("shows the empty state when there are no suppliers", () => {
    mockUseGetAllSuppliersQuery.mockReturnValue({
      data: { data: [], meta: { page: 1, limit: 20, total: 0, totalPage: 0 } },
      isLoading: false,
      error: undefined,
    })
    render(<SuppliersEntities />)
    expect(screen.getByText("organization.suppliers.empty")).toBeInTheDocument()
  })

  it("shows a distinct 'no matches' state when a filter narrows the list to zero, instead of the true-empty-org copy", async () => {
    const user = userEvent.setup()
    mockUseGetAllSuppliersQuery.mockReturnValue({
      data: { data: [], meta: { page: 1, limit: 20, total: 0, totalPage: 0 } },
      isLoading: false,
      error: undefined,
    })
    render(<SuppliersEntities />)

    await user.selectOptions(
      screen.getByLabelText("organization.suppliers.statusFilterLabel"),
      "INACTIVE"
    )

    expect(
      screen.getByText("organization.suppliers.noMatches")
    ).toBeInTheDocument()
    expect(
      screen.queryByText("organization.suppliers.empty")
    ).not.toBeInTheDocument()
  })

  it("shows a load error", () => {
    mockUseGetAllSuppliersQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 500 },
    })
    render(<SuppliersEntities />)
    expect(screen.getByRole("alert")).toHaveTextContent(
      "organization.suppliers.loadError"
    )
  })

  it("flags AI-discovered suppliers distinctly from manually entered ones", () => {
    mockUseGetAllSuppliersQuery.mockReturnValue({
      data: {
        data: [{ ...SUPPLIER, ai_generated: true }],
        meta: { page: 1, limit: 20, total: 1, totalPage: 1 },
      },
      isLoading: false,
      error: undefined,
    })
    render(<SuppliersEntities />)
    expect(screen.getByText("organization.suppliers.aiDiscovered")).toBeInTheDocument()
  })

  it("creates a supplier through the form modal", async () => {
    const user = userEvent.setup()
    mockUnwrap(mockCreateNewSupplier, { data: SUPPLIER })
    render(<SuppliersEntities />)

    await user.click(screen.getByRole("button", { name: "organization.suppliers.addSupplier" }))
    await user.type(screen.getByLabelText("organization.suppliers.form.name *"), "New Co")
    await user.click(screen.getByRole("button", { name: "organization.suppliers.form.save" }))

    await waitFor(() => {
      expect(mockCreateNewSupplier).toHaveBeenCalledWith(
        expect.objectContaining({ name: "New Co" })
      )
    })
    expect(mockToastSuccess).toHaveBeenCalledWith("organization.suppliers.createSuccess")
  })

  it("shows an error toast when create fails", async () => {
    const user = userEvent.setup()
    mockUnwrapRejects(mockCreateNewSupplier)
    render(<SuppliersEntities />)

    await user.click(screen.getByRole("button", { name: "organization.suppliers.addSupplier" }))
    await user.type(screen.getByLabelText("organization.suppliers.form.name *"), "New Co")
    await user.click(screen.getByRole("button", { name: "organization.suppliers.form.save" }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("organization.suppliers.createFailed")
    })
  })

  it("shows a distinct duplicate-name toast when create hits the backend's 409", async () => {
    const user = userEvent.setup()
    mockUnwrapRejects(mockCreateNewSupplier, { status: 409 })
    render(<SuppliersEntities />)

    await user.click(screen.getByRole("button", { name: "organization.suppliers.addSupplier" }))
    await user.type(screen.getByLabelText("organization.suppliers.form.name *"), "Acme Steel")
    await user.click(screen.getByRole("button", { name: "organization.suppliers.form.save" }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("organization.suppliers.createDuplicate")
    })
  })

  it("pre-fills the edit form with the existing supplier's data", async () => {
    const user = userEvent.setup()
    render(<SuppliersEntities />)

    await user.click(
      screen.getByRole("button", { name: "organization.suppliers.editFor Acme Steel" })
    )

    expect(screen.getByLabelText("organization.suppliers.form.name *")).toHaveValue(
      "Acme Steel"
    )
    expect(screen.getByLabelText("organization.suppliers.form.country")).toHaveValue(
      "France"
    )
  })

  it("deletes a supplier after confirming", async () => {
    const user = userEvent.setup()
    mockUnwrap(mockDeleteSupplier, { data: SUPPLIER })
    render(<SuppliersEntities />)

    await user.click(
      screen.getByRole("button", { name: "organization.suppliers.deleteFor Acme Steel" })
    )
    await user.click(
      screen.getByRole("button", { name: "common.deleteAlertModal.delete" })
    )

    await waitFor(() => {
      expect(mockDeleteSupplier).toHaveBeenCalledWith("s1")
    })
  })

  it("hides write actions for a read-only role", () => {
    mockRole = "VIEWER"
    render(<SuppliersEntities />)
    expect(
      screen.queryByRole("button", { name: "organization.suppliers.addSupplier" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "organization.suppliers.editFor Acme Steel" })
    ).not.toBeInTheDocument()
  })

  it("hides the AI discovery panel for a read-only role", () => {
    mockRole = "VIEWER"
    render(<SuppliersEntities />)
    expect(
      screen.queryByText("organization.suppliers.discovery.title")
    ).not.toBeInTheDocument()
  })

  it("shows the risk tier badge for a supplier that has one", () => {
    render(<SuppliersEntities />)
    // The same label also appears as a <option> in the risk-tier filter
    // select, so this can't be a single-match getByText.
    expect(
      screen.getAllByText("organization.suppliers.riskHigh").length
    ).toBeGreaterThan(1)
  })

  it("re-queries with the status filter when changed", async () => {
    const user = userEvent.setup()
    render(<SuppliersEntities />)
    mockUseGetAllSuppliersQuery.mockClear()

    await user.selectOptions(
      screen.getByLabelText("organization.suppliers.statusFilterLabel"),
      "UNDER_REVIEW"
    )

    await waitFor(() => {
      expect(mockUseGetAllSuppliersQuery).toHaveBeenCalledWith(
        expect.objectContaining({ status: "UNDER_REVIEW", page: 1 })
      )
    })
  })

  it("re-queries with the risk tier filter when changed", async () => {
    const user = userEvent.setup()
    render(<SuppliersEntities />)
    mockUseGetAllSuppliersQuery.mockClear()

    await user.selectOptions(
      screen.getByLabelText("organization.suppliers.riskTierFilterLabel"),
      "LOW"
    )

    await waitFor(() => {
      expect(mockUseGetAllSuppliersQuery).toHaveBeenCalledWith(
        expect.objectContaining({ risk_tier: "LOW", page: 1 })
      )
    })
  })

  it("re-queries with the chosen sort when changed", async () => {
    const user = userEvent.setup()
    render(<SuppliersEntities />)
    mockUseGetAllSuppliersQuery.mockClear()

    await user.selectOptions(
      screen.getByLabelText("organization.suppliers.sortLabel"),
      "name:asc"
    )

    await waitFor(() => {
      expect(mockUseGetAllSuppliersQuery).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: "name", sortOrder: "asc" })
      )
    })
  })

  describe("bulk actions", () => {
    it("shows the bulk toolbar once a row is selected, and hides it again once cleared", async () => {
      const user = userEvent.setup()
      render(<SuppliersEntities />)
      expect(
        screen.queryByText("organization.suppliers.selectedCount")
      ).not.toBeInTheDocument()

      await user.click(
        screen.getByLabelText("organization.suppliers.selectFor Acme Steel")
      )
      expect(
        screen.getByText("organization.suppliers.selectedCount")
      ).toBeInTheDocument()

      await user.click(
        screen.getByRole("button", { name: "organization.suppliers.clearSelection" })
      )
      expect(
        screen.queryByText("organization.suppliers.selectedCount")
      ).not.toBeInTheDocument()
    })

    it("bulk-updates the status of every selected supplier", async () => {
      const user = userEvent.setup()
      mockUnwrap(mockBulkUpdateStatus, { data: { updated: 1, skipped: 0 } })
      render(<SuppliersEntities />)

      await user.click(
        screen.getByLabelText("organization.suppliers.selectFor Acme Steel")
      )
      await user.selectOptions(
        screen.getByLabelText("organization.suppliers.bulkChangeStatusLabel"),
        "INACTIVE"
      )

      await waitFor(() => {
        expect(mockBulkUpdateStatus).toHaveBeenCalledWith({
          supplierIds: ["s1"],
          status: "INACTIVE",
        })
      })
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "organization.suppliers.bulkStatusSuccess"
      )
    })

    it("bulk-deletes every selected supplier after confirming", async () => {
      const user = userEvent.setup()
      mockUnwrap(mockBulkDeleteSuppliers, { data: { updated: 1, skipped: 0 } })
      render(<SuppliersEntities />)

      await user.click(
        screen.getByLabelText("organization.suppliers.selectFor Acme Steel")
      )
      await user.click(
        screen.getByRole("button", {
          name: "organization.suppliers.bulkDeleteSelected",
        })
      )
      await user.click(
        screen.getByRole("button", { name: "common.deleteAlertModal.delete" })
      )

      await waitFor(() => {
        expect(mockBulkDeleteSuppliers).toHaveBeenCalledWith(["s1"])
      })
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "organization.suppliers.bulkDeleteSuccess"
      )
    })

    it("shows an error toast when the bulk status change fails", async () => {
      const user = userEvent.setup()
      mockUnwrapRejects(mockBulkUpdateStatus)
      render(<SuppliersEntities />)

      await user.click(
        screen.getByLabelText("organization.suppliers.selectFor Acme Steel")
      )
      await user.selectOptions(
        screen.getByLabelText("organization.suppliers.bulkChangeStatusLabel"),
        "INACTIVE"
      )

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          "organization.suppliers.bulkStatusFailed"
        )
      })
    })
  })

  describe("AI discovery panel", () => {
    it("runs discovery and lists candidates", async () => {
      const user = userEvent.setup()
      mockUnwrap(mockDiscoverSuppliers, {
        data: {
          suppliers_information: [
            {
              supplier_name: "Discovered Co",
              supplier_country: "Germany",
              relationship: "raw materials",
              source_url: "https://example.com/about",
            },
          ],
        },
      })
      render(<SuppliersEntities />)

      await user.click(
        screen.getByRole("button", { name: "organization.suppliers.discovery.checkButton" })
      )

      expect(await screen.findByText("Discovered Co")).toBeInTheDocument()
      expect(screen.getByText("Germany")).toBeInTheDocument()
    })

    it("accepting a candidate persists it as ai_generated with its source", async () => {
      const user = userEvent.setup()
      mockUnwrap(mockDiscoverSuppliers, {
        data: {
          suppliers_information: [
            {
              supplier_name: "Discovered Co",
              supplier_country: "Germany",
              relationship: "raw materials",
              source_url: "https://example.com/about",
            },
          ],
        },
      })
      mockUnwrap(mockCreateNewSupplier, { data: SUPPLIER })
      render(<SuppliersEntities />)

      await user.click(
        screen.getByRole("button", { name: "organization.suppliers.discovery.checkButton" })
      )
      await screen.findByText("Discovered Co")
      await user.click(
        screen.getByRole("button", {
          name: "organization.suppliers.discovery.addFor Discovered Co",
        })
      )

      await waitFor(() => {
        expect(mockCreateNewSupplier).toHaveBeenCalledWith({
          name: "Discovered Co",
          country: "Germany",
          notes: "raw materials",
          ai_generated: true,
          source_info: "https://example.com/about",
        })
      })
    })

    it("treats a candidate matching an existing supplier's name as already added, case-insensitively", async () => {
      const user = userEvent.setup()
      // SUPPLIER.name is "Acme Steel" (the default mockUseGetAllSuppliersQuery
      // fixture, shared by both SuppliersEntities' own list query and this
      // panel's own dedup query) -- a differently-cased candidate name must
      // still be recognized as the same real supplier.
      mockUnwrap(mockDiscoverSuppliers, {
        data: {
          suppliers_information: [
            {
              supplier_name: "acme steel",
              supplier_country: "France",
              relationship: null,
              source_url: null,
            },
          ],
        },
      })
      render(<SuppliersEntities />)

      await user.click(
        screen.getByRole("button", { name: "organization.suppliers.discovery.checkButton" })
      )
      await screen.findByText("acme steel")

      const addButton = screen.getByRole("button", {
        name: "organization.suppliers.discovery.addedFor acme steel",
      })
      expect(addButton).toBeDisabled()

      await user.click(addButton)
      expect(mockCreateNewSupplier).not.toHaveBeenCalled()
    })

    it("marks a candidate added (not failed) when the backend rejects it as a 409 race", async () => {
      // The client-side existingNames check can miss a genuine race (dedup
      // query not yet refetched, a second tab) -- the backend's own
      // uniqueness constraint is the real backstop, and the UI should
      // treat that the same as an already-known duplicate rather than a
      // generic failure that invites a doomed retry.
      const user = userEvent.setup()
      mockUnwrap(mockDiscoverSuppliers, {
        data: {
          suppliers_information: [
            {
              supplier_name: "Raced Co",
              supplier_country: null,
              relationship: null,
              source_url: null,
            },
          ],
        },
      })
      mockUnwrapRejects(mockCreateNewSupplier, { status: 409 })
      render(<SuppliersEntities />)

      await user.click(
        screen.getByRole("button", { name: "organization.suppliers.discovery.checkButton" })
      )
      await screen.findByText("Raced Co")
      await user.click(
        screen.getByRole("button", {
          name: "organization.suppliers.discovery.addFor Raced Co",
        })
      )

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          "organization.suppliers.discovery.addDuplicate"
        )
      })
      expect(
        screen.getByRole("button", { name: "organization.suppliers.discovery.addedFor Raced Co" })
      ).toBeDisabled()
    })

    it("dismissing a candidate removes it from view without persisting anything", async () => {
      const user = userEvent.setup()
      mockUnwrap(mockDiscoverSuppliers, {
        data: {
          suppliers_information: [
            { supplier_name: "Discovered Co", supplier_country: null, relationship: null, source_url: null },
          ],
        },
      })
      render(<SuppliersEntities />)

      await user.click(
        screen.getByRole("button", { name: "organization.suppliers.discovery.checkButton" })
      )
      await screen.findByText("Discovered Co")
      await user.click(
        screen.getByRole("button", {
          name: "organization.suppliers.discovery.dismissFor Discovered Co",
        })
      )

      expect(screen.queryByText("Discovered Co")).not.toBeInTheDocument()
      expect(mockCreateNewSupplier).not.toHaveBeenCalled()
    })

    it("skips a candidate with no supplier_name entirely", async () => {
      const user = userEvent.setup()
      mockUnwrap(mockDiscoverSuppliers, {
        data: {
          suppliers_information: [
            { supplier_name: null, supplier_country: "Germany", relationship: null, source_url: null },
          ],
        },
      })
      render(<SuppliersEntities />)

      await user.click(
        screen.getByRole("button", { name: "organization.suppliers.discovery.checkButton" })
      )

      await waitFor(() => {
        expect(mockDiscoverSuppliers).toHaveBeenCalled()
      })
      // Never rendered as an actionable row -- filtered out by the
      // supplier_name guard before it ever reaches "usable" candidates, so
      // the empty state reads as "nothing found," not "you dismissed
      // everything" (nothing was ever shown to dismiss).
      expect(screen.queryByText("Germany")).not.toBeInTheDocument()
      expect(
        screen.getByText("organization.suppliers.discovery.noneFound")
      ).toBeInTheDocument()
    })

    it("dismissing every visible candidate shows the all-dismissed state, distinct from none-found", async () => {
      const user = userEvent.setup()
      mockUnwrap(mockDiscoverSuppliers, {
        data: {
          suppliers_information: [
            { supplier_name: "Discovered Co", supplier_country: null, relationship: null, source_url: null },
          ],
        },
      })
      render(<SuppliersEntities />)

      await user.click(
        screen.getByRole("button", { name: "organization.suppliers.discovery.checkButton" })
      )
      await screen.findByText("Discovered Co")
      await user.click(
        screen.getByRole("button", {
          name: "organization.suppliers.discovery.dismissFor Discovered Co",
        })
      )

      expect(
        screen.getByText("organization.suppliers.discovery.allDismissed")
      ).toBeInTheDocument()
    })

    it("shows a failure toast when discovery itself fails", async () => {
      const user = userEvent.setup()
      mockUnwrapRejects(mockDiscoverSuppliers)
      render(<SuppliersEntities />)

      await user.click(
        screen.getByRole("button", { name: "organization.suppliers.discovery.checkButton" })
      )

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("organization.suppliers.discovery.failed")
      })
    })

    it("shows a distinct toast when discovery times out (504)", async () => {
      const user = userEvent.setup()
      mockUnwrapRejects(mockDiscoverSuppliers, { status: 504 })
      render(<SuppliersEntities />)

      await user.click(
        screen.getByRole("button", { name: "organization.suppliers.discovery.checkButton" })
      )

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("organization.suppliers.discovery.timedOut")
      })
    })

    it("shows a distinct toast when the org has no company name to search (400)", async () => {
      const user = userEvent.setup()
      mockUnwrapRejects(mockDiscoverSuppliers, { status: 400 })
      render(<SuppliersEntities />)

      await user.click(
        screen.getByRole("button", { name: "organization.suppliers.discovery.checkButton" })
      )

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          "organization.suppliers.discovery.missingCompanyName"
        )
      })
    })

    it("bulk-accepts every selected candidate", async () => {
      const user = userEvent.setup()
      mockUnwrap(mockDiscoverSuppliers, {
        data: {
          suppliers_information: [
            {
              supplier_name: "Discovered Co",
              supplier_country: "Germany",
              relationship: null,
              source_url: null,
            },
            {
              supplier_name: "Second Co",
              supplier_country: null,
              relationship: null,
              source_url: null,
            },
          ],
        },
      })
      mockUnwrap(mockCreateNewSupplier, { data: SUPPLIER })
      render(<SuppliersEntities />)

      await user.click(
        screen.getByRole("button", { name: "organization.suppliers.discovery.checkButton" })
      )
      await screen.findByText("Discovered Co")

      await user.click(
        screen.getByLabelText("organization.suppliers.discovery.selectFor Discovered Co")
      )
      await user.click(
        screen.getByLabelText("organization.suppliers.discovery.selectFor Second Co")
      )
      await user.click(
        screen.getByRole("button", {
          name: "organization.suppliers.discovery.bulkAcceptLabel",
        })
      )

      await waitFor(() => {
        expect(mockCreateNewSupplier).toHaveBeenCalledTimes(2)
      })
      expect(mockCreateNewSupplier).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Discovered Co" })
      )
      expect(mockCreateNewSupplier).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Second Co" })
      )
      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          "organization.suppliers.discovery.bulkAcceptSuccess"
        )
      })
    })

    it("does not offer a bulk-select checkbox for a candidate already added", async () => {
      const user = userEvent.setup()
      mockUnwrap(mockDiscoverSuppliers, {
        data: {
          suppliers_information: [
            {
              supplier_name: "Acme Steel",
              supplier_country: "France",
              relationship: null,
              source_url: null,
            },
          ],
        },
      })
      render(<SuppliersEntities />)

      await user.click(
        screen.getByRole("button", { name: "organization.suppliers.discovery.checkButton" })
      )
      await screen.findAllByText("Acme Steel")

      expect(
        screen.queryByLabelText("organization.suppliers.discovery.selectFor Acme Steel")
      ).not.toBeInTheDocument()
    })
  })
})
