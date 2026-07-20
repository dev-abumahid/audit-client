import { useGetAllFindingsQuery } from "@/redux/apis/organization/findings.api"

// Shared by RunInspection and InspectionActions so the inspectionId-scoped
// findings fetch lives in exactly one place.
export function useFindingsForInspection<T extends { inspectionId: string }>(
  inspectionId: string | undefined
) {
  const {
    data: findingsResponse,
    isLoading,
    isFetching,
    isError,
  } = useGetAllFindingsQuery(
    { page: 1, limit: 100, searchTerm: "", siteId: "", inspectionId },
    { skip: !inspectionId }
  )

  const findings = (findingsResponse?.data ?? []) as unknown as T[]

  return { findings, isLoading, isFetching, isError }
}
