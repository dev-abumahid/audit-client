import { buildQueryString } from "@/redux/apis/buildQueryString"
import { baseApi } from "@/redux/baseApi"
import type { ApiResponse, PaginatedApiResponse } from "@/types/api"
import type { Site, SiteSummary } from "@/types/organization"

interface GetAllSitesArgs {
  page: number
  limit: number
  searchTerm: string
}

// create/update payloads mirror site.validation.ts's create_site/update_site
// zod schemas on aexa-server -- lat/lng and the optional string fields are
// genuinely optional there.
interface SiteFormPayload {
  name: string
  location?: string
  country?: string
  activity?: string
  revenue: number
  employees_count: number
  site_type: string
  lat?: number
  lng?: number
}

const sitesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllSites: builder.query<
      PaginatedApiResponse<SiteSummary>,
      GetAllSitesArgs
    >({
      query: ({ page, limit, searchTerm }) => ({
        url: `/site?${buildQueryString({ page, limit, searchTerm })}`,
        method: "GET",
      }),
      providesTags: ["SITE"],
    }),
    createNewSite: builder.mutation<ApiResponse<Site>, SiteFormPayload>({
      query: (data) => ({
        url: `/site`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["SITE"],
    }),
    updateSite: builder.mutation<
      ApiResponse<Site>,
      { data: Partial<SiteFormPayload>; id: string }
    >({
      query: ({ data, id }) => ({
        url: `/site/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["SITE"],
    }),
    deleteSite: builder.mutation<ApiResponse<Site>, string>({
      query: (id) => ({
        url: `/site/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["SITE"],
    }),
  }),
})

export const {
  useGetAllSitesQuery,
  useCreateNewSiteMutation,
  useUpdateSiteMutation,
  useDeleteSiteMutation,
} = sitesApi
