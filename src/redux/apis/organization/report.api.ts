import { buildQueryString } from "@/redux/apis/buildQueryString"
import { baseApi } from "@/redux/baseApi"
import type { ApiResponse, PaginatedApiResponse } from "@/types/api"

export type ReportStatus = "GENERATING" | "READY" | "PUBLISHED" | "FAILED"
export type ReportType =
  | "BOARD"
  | "EXEC_COMMITTEE"
  | "AUDIT_OPINION"
  | "MONTE_CARLO"
  | "COMPLIANCE"

// Structured Board Report content returned by aexa-ai and stored on the Report
// row (Prisma Json column). Optional because a GENERATING/FAILED report has no
// content yet.
export interface ReportContent {
  title: string
  subtitle: string
  reference: string
  classification: string
  executive_summary: string
  organization_summary: {
    name: string
    site_count: number
    risk_count: number
    kri_count: number
    open_action_count: number
    narrative: string
  }
  top_risks: Array<{
    ref: string
    title: string
    category: string
    site: string
    inherent_score: number
    residual_score: number
    trend: string
    commentary: string
  }>
  kri_dashboard: Array<{
    name: string
    unit: string
    current_value: number
    target_value: number
    alert_threshold: number
    status: string
    commentary: string
  }>
  open_actions: Array<{
    title: string
    priority: string
    status: string
    due_date: string
    commentary: string
  }>
  outlook: string
}

// Real response shape from aexa-server's /api/report endpoints (Prisma Report
// model). org_account_id (not organization_id), createdAt/updatedAt, ISO date
// strings over JSON. status drives the UI badge + which actions are enabled.
export interface Report {
  id: string
  org_account_id: string
  type: ReportType
  title: string
  reference: string | null
  status: ReportStatus
  content: ReportContent | null
  file_url: string | null
  pages: number | null
  parameters: Record<string, unknown> | null
  version: number
  generated_by: string
  reviewed_by: string | null
  reviewed_at: string | null
  ai_generated: boolean
  error_message: string | null
  createdAt: string
  updatedAt: string
}

interface GetAllReportsArgs {
  page: number
  limit: number
  searchTerm: string
}

const reportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllReports: builder.query<
      PaginatedApiResponse<Report>,
      GetAllReportsArgs
    >({
      query: ({ page, limit, searchTerm }) => ({
        url: `/report?${buildQueryString({ page, limit, searchTerm })}`,
        method: "GET",
      }),
      providesTags: ["REPORT"],
    }),
    getReportById: builder.query<ApiResponse<Report>, string>({
      query: (id) => ({
        url: `/report/${id}`,
        method: "GET",
      }),
      providesTags: ["REPORT"],
    }),
    generateReport: builder.mutation<
      ApiResponse<Report>,
      { type?: ReportType; title?: string }
    >({
      query: (body) => ({
        url: `/report/generate`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["REPORT"],
    }),
    publishReport: builder.mutation<ApiResponse<Report>, string>({
      query: (id) => ({
        url: `/report/${id}/publish`,
        method: "PATCH",
      }),
      invalidatesTags: ["REPORT"],
    }),
    // #222's confidentiality design: the server mints a short-lived signed
    // URL at request time instead of ever handing back the permanent stored
    // file_url. A mutation (not a query) because every call must mint a
    // fresh URL -- caching this under RTK Query's normal query semantics
    // would serve a stale, possibly-expired signed URL from cache instead
    // of hitting the endpoint again.
    downloadReport: builder.mutation<
      ApiResponse<{ file_url: string; expires_in: number }>,
      string
    >({
      query: (id) => ({
        url: `/report/${id}/download`,
        method: "GET",
      }),
    }),
  }),
})

export const {
  useGetAllReportsQuery,
  useGetReportByIdQuery,
  useGenerateReportMutation,
  usePublishReportMutation,
  useDownloadReportMutation,
} = reportApi
