import { baseApi } from "@/redux/baseApi"

const alertApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllAlerts: builder.query({
      // Same reasoning as kri.api.ts's getAllKri — backend defaults to
      // page=1&limit=10 with no query string, silently truncating the list
      // and its severity counts with no pagination UI to reveal the gap.
      // Found by independent review.
      query: () => ({
        url: `/alert?page=1&limit=100`,
        method: "GET",
      }),
      providesTags: ["ALERT"],
    }),
    markAlertRead: builder.mutation({
      query: (id: string) => ({
        url: `/alert/${id}/read`,
        method: "PATCH",
        body: { is_read: true },
      }),
      invalidatesTags: ["ALERT"],
    }),
    deleteAlert: builder.mutation({
      query: (id: string) => ({
        url: `/alert/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["ALERT"],
    }),
  }),
})

export const {
  useGetAllAlertsQuery,
  useMarkAlertReadMutation,
  useDeleteAlertMutation,
} = alertApi
