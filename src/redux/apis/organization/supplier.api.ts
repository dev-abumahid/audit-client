import { buildQueryString } from "@/redux/apis/buildQueryString"
import { baseApi } from "@/redux/baseApi"
import type { ApiResponse, PaginatedApiResponse } from "@/types/api"
import type {
  Supplier,
  SupplierContractStatus,
  SupplierRiskTier,
  SupplierStatus,
} from "@/types/organization"

// sortBy is allow-listed server-side (supplier.service.ts's
// SUPPLIER_SORTABLE_FIELDS) -- kept as a matching literal union here so an
// invalid value is a compile-time error, not a silent server-side fallback
// discovered at runtime.
export type SupplierSortableField = "name" | "risk_tier" | "next_review_date" | "createdAt"

interface GetAllSuppliersArgs {
  page: number
  limit: number
  searchTerm: string
  status?: SupplierStatus
  risk_tier?: SupplierRiskTier
  sortBy?: SupplierSortableField
  sortOrder?: "asc" | "desc"
}

// create/update payloads mirror supplier.validation.ts's create_supplier/
// update_supplier zod schemas on aexa-server -- name is the only required
// field, everything else is genuinely optional there.
interface SupplierFormPayload {
  name: string
  country?: string
  notes?: string
  risk_tier?: SupplierRiskTier
  next_review_date?: string
  primary_contact_name?: string
  primary_contact_email?: string
  contract_status?: SupplierContractStatus
  status?: SupplierStatus
  ai_generated?: boolean
  source_info?: string
}

interface BulkSupplierOutcome {
  updated: number
  skipped: number
}

// A candidate proposed by aexa-ai's /company-suppliers (via aexa-server's
// POST /supplier/discover passthrough) -- draft-then-commit, same shape as
// onboarding's draft-sites-then-commit_onboarding (see supplier.service.ts's
// discover_suppliers_for_org comment). Nothing here is persisted until the
// user accepts a candidate, which POSTs it to createNewSupplier with
// ai_generated: true and source_info set to its source_url.
//
// "No guesses" grounding (aexa-ai#227): source_url is only ever populated
// when the model's claim was independently verified server-side against
// real search-result data -- a candidate with no source_url is a
// server-side rejection artifact reaching this far only if every claim for
// it failed grounding, so it should never actually appear here in
// practice, but the type stays optional to match aexa-ai's schema exactly
// rather than assuming that invariant client-side.
export interface SuggestedSupplier {
  supplier_name: string | null
  supplier_country: string | null
  relationship: string | null
  source_url: string | null
}

const supplierApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllSuppliers: builder.query<
      PaginatedApiResponse<Supplier>,
      GetAllSuppliersArgs
    >({
      query: ({ page, limit, searchTerm, status, risk_tier, sortBy, sortOrder }) => ({
        url: `/supplier?${buildQueryString({
          page,
          limit,
          searchTerm,
          status,
          risk_tier,
          sortBy,
          sortOrder,
        })}`,
        method: "GET",
      }),
      providesTags: ["SUPPLIER"],
    }),
    createNewSupplier: builder.mutation<ApiResponse<Supplier>, SupplierFormPayload>({
      query: (data) => ({
        url: `/supplier`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["SUPPLIER"],
    }),
    updateSupplier: builder.mutation<
      ApiResponse<Supplier>,
      { data: Partial<SupplierFormPayload>; id: string }
    >({
      query: ({ data, id }) => ({
        url: `/supplier/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["SUPPLIER"],
    }),
    deleteSupplier: builder.mutation<ApiResponse<Supplier>, string>({
      query: (id) => ({
        url: `/supplier/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["SUPPLIER"],
    }),
    // No persistence -- pure proxy, same "review and selectively import"
    // shape as suggestRegulatorySources. Not tagged with SUPPLIER since it
    // creates nothing itself; accepting a candidate goes through the
    // normal createNewSupplier mutation instead.
    discoverSuppliers: builder.mutation<
      ApiResponse<{ suppliers_information: SuggestedSupplier[] }>,
      { company_name?: string } | void
    >({
      query: (body) => ({
        url: `/supplier/discover`,
        method: "POST",
        body: body ?? {},
      }),
    }),
    bulkUpdateSupplierStatus: builder.mutation<
      ApiResponse<BulkSupplierOutcome>,
      { supplierIds: string[]; status: SupplierStatus }
    >({
      query: (body) => ({
        url: `/supplier/bulk-status`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["SUPPLIER"],
    }),
    bulkDeleteSuppliers: builder.mutation<ApiResponse<BulkSupplierOutcome>, string[]>({
      query: (supplierIds) => ({
        url: `/supplier/bulk-delete`,
        method: "POST",
        body: { supplierIds },
      }),
      invalidatesTags: ["SUPPLIER"],
    }),
  }),
})

export const {
  useGetAllSuppliersQuery,
  useCreateNewSupplierMutation,
  useUpdateSupplierMutation,
  useDeleteSupplierMutation,
  useDiscoverSuppliersMutation,
  useBulkUpdateSupplierStatusMutation,
  useBulkDeleteSuppliersMutation,
} = supplierApi
