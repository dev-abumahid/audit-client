import { buildQueryString } from "@/redux/apis/buildQueryString"
import { baseApi } from "@/redux/baseApi"
import type { ApiResponse, PaginatedApiResponse } from "@/types/api"
import type { KRI, KriReading, LineOfDefense } from "@/types/organization"

// Mirrors kri.validation.ts's create_kri zod schema on aexa-server exactly
// -- frequency is optional there, and target_value/alert_threshold must
// differ (enforced server-side, not re-validated here).
interface CreateKriPayload {
  risk_id: string
  name: string
  // Free-text owner, mirrors kri.validation.ts's optional `owner` field.
  owner?: string
  unit: string
  current_value: number
  alert_threshold: number
  target_value: number
  frequency?: string
}

// update_kri's zod schema explicitly does not accept current_value, risk_id,
// or org_account_id -- the backend strips them from the body even if sent
// (see kri.service.ts's update_kri_into_db destructuring them out).
// line_of_defense isn't part of CreateKriPayload/kri.validation.ts's create
// schema — it's set separately via update (issue #97, ADMIN/LEAD_AUDITOR
// only server-side).
type UpdateKriPayload = Partial<
  Pick<
    CreateKriPayload,
    "name" | "owner" | "unit" | "alert_threshold" | "target_value" | "frequency"
  >
> & { line_of_defense?: LineOfDefense }

const kriApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllKri: builder.query<PaginatedApiResponse<KRI>, void>({
      // Backend defaults to page=1&limit=10 with no query string — the
      // dashboard has no pagination UI, so an org with more than 10 KRIs
      // would silently see the list (and its status-summary counts) capped
      // with no indication anything's missing. Found by independent review.
      query: () => ({
        url: `/kri?page=1&limit=100`,
        method: "GET",
      }),
      providesTags: ["KRI"],
    }),
    createNewKri: builder.mutation<ApiResponse<KRI>, CreateKriPayload>({
      query: (data) => ({
        url: `/kri`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["KRI"],
    }),
    updateKri: builder.mutation<
      ApiResponse<KRI>,
      { data: UpdateKriPayload; id: string }
    >({
      query: ({ data, id }) => ({
        url: `/kri/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["KRI"],
    }),
    // A new current_value can flip the KRI's computed status into ALERT,
    // which server-side auto-creates an Alert row — invalidate both tags.
    // Returns the full updated KRI (not a bare "value" object) -- can also
    // 409 on an optimistic-concurrency conflict if another request updated
    // the same KRI first (see kri.service.ts's submit_kri_value_into_db).
    submitKriValue: builder.mutation<
      ApiResponse<KRI>,
      { id: string; current_value: number }
    >({
      query: ({ id, current_value }) => ({
        url: `/kri/${id}/value`,
        method: "POST",
        body: { current_value },
      }),
      invalidatesTags: ["KRI", "ALERT"],
    }),
    // The delete path doesn't run with_status(), so unlike every other KRI
    // endpoint this one returns the bare row with no `status` field.
    deleteKri: builder.mutation<ApiResponse<Omit<KRI, "status">>, string>({
      query: (id: string) => ({
        url: `/kri/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["KRI"],
    }),
    // aexa-server#242 / aexa-frontend#211 — the append-only reading history
    // this endpoint exposes existed for a while with no frontend consumer at
    // all. Newest-first from the backend; callers that chart a trend need to
    // reverse it for chronological order.
    getKriReadings: builder.query<
      PaginatedApiResponse<KriReading>,
      { id: string; page: number; limit: number }
    >({
      query: ({ id, page, limit }) => ({
        url: `/kri/${id}/readings?${buildQueryString({ page, limit })}`,
        method: "GET",
      }),
      providesTags: ["KRI"],
    }),
  }),
})

export const {
  useGetAllKriQuery,
  useCreateNewKriMutation,
  useUpdateKriMutation,
  useSubmitKriValueMutation,
  useDeleteKriMutation,
  useGetKriReadingsQuery,
} = kriApi
