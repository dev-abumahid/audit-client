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

vi.mock("@/redux/apis/organization/supplier.api", () => ({
  useGetAllSuppliersQuery: (...args: unknown[]) => mockUseGetAllSuppliersQuery(...args),
  useCreateNewSupplierMutation: () => [mockCreateNewSupplier, { isLoading: false }],
  useUpdateSupplierMutation: () => [mockUpdateSupplier, { isLoading: false }],
  useDeleteSupplierMutation: () => [mockDeleteSupplier, { isLoading: false }],
  useDiscoverSuppliersMutation: () => [mockDiscoverSuppliers, { isLoading: false }],
}))

const SUPPLIER = {
  id: "s1",
  name: "Acme Steel",
  country: "France",
  notes: null,
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
  })
})
