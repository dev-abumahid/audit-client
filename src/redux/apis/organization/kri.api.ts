import { baseApi } from "@/redux/baseApi"

const kriApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllKri: builder.query({
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
    createNewKri: builder.mutation({
      query: (data) => ({
        url: `/kri`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["KRI"],
    }),
    updateKri: builder.mutation({
      query: ({ data, id }) => ({
        url: `/kri/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["KRI"],
    }),
    // A new current_value can flip the KRI's computed status into ALERT,
    // which server-side auto-creates an Alert row — invalidate both tags.
    submitKriValue: builder.mutation({
      query: ({ id, current_value }) => ({
        url: `/kri/${id}/value`,
        method: "POST",
        body: { current_value },
      }),
      invalidatesTags: ["KRI", "ALERT"],
    }),
    deleteKri: builder.mutation({
      query: (id: string) => ({
        url: `/kri/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["KRI"],
    }),
  }),
})

export const {
  useGetAllKriQuery,
  useCreateNewKriMutation,
  useUpdateKriMutation,
  useSubmitKriValueMutation,
  useDeleteKriMutation,
} = kriApi
