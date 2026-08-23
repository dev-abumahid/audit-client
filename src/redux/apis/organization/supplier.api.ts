import { buildQueryString } from "@/redux/apis/buildQueryString"
import { baseApi } from "@/redux/baseApi"
import type { ApiResponse, PaginatedApiResponse } from "@/types/api"
import type { Supplier } from "@/types/organization"

interface GetAllSuppliersArgs {
  page: number
  limit: number
  searchTerm: string
}

// create/update payloads mirror supplier.validation.ts's create_supplier/
// update_supplier zod schemas on aexa-server -- name is the only required
// field, everything else is genuinely optional there.
interface SupplierFormPayload {
  name: string
  country?: string
  notes?: string
  ai_generated?: boolean
  source_info?: string
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
      query: ({ page, limit, searchTerm }) => ({
        url: `/supplier?${buildQueryString({ page, limit, searchTerm })}`,
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
  }),
})

export const {
  useGetAllSuppliersQuery,
  useCreateNewSupplierMutation,
  useUpdateSupplierMutation,
  useDeleteSupplierMutation,
  useDiscoverSuppliersMutation,
} = supplierApi
