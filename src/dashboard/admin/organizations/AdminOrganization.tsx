import {
  ChevronLeft,
  ChevronRight,
  Loader,
  MoreHorizontal,
  Search,
  Sparkles,
} from "lucide-react"
import React, { useState } from "react"

import {
  useGetAdminOrganizationsQuery,
  type AdminOrganizationListItem,
} from "@/redux/apis/organization/onboarding.api"
import OnboardingWizard from "./OnboardingWizard"

const AdminOrganization: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [isWizardOpen, setIsWizardOpen] = useState(false)

  const limit = 10

  // Real, server-paginated org list (#162) — replaces the former hardcoded
  // dummy array so a freshly-onboarded org actually appears here. Search and
  // pagination are handled server-side; creating an org via the wizard
  // invalidates the ORGANIZATION cache tag so this list refetches on its own.
  const { data, isLoading, isFetching } = useGetAdminOrganizationsQuery({
    page: currentPage,
    limit,
    searchTerm,
  })

  const organizations: AdminOrganizationListItem[] = data?.data ?? []
  const totalItems = data?.meta?.total ?? 0
  const totalPages = data?.meta?.totalPage ?? 0

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    setCurrentPage(1)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  // No subscription concept exists in the schema, so the badge reflects the
  // real, meaningful signal we do have: whether the org account is verified
  // (and therefore usable). Admin-provisioned orgs are created verified.
  const getStatusInfo = (isVerified: boolean) => ({
    text: isVerified ? "Active" : "Pending",
    color: isVerified
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  })

  const getRegionLabel = (org: AdminOrganizationListItem) =>
    [org.sector, org.country].filter(Boolean).join(" · ") || "—"

  return (
    <div className="flex-1 bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">
              Organizations
            </h1>
            <p className="mt-1 text-muted-foreground">
              Manage all organizations and their subscriptions
            </p>
          </div>

          <button
            onClick={() => setIsWizardOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Sparkles className="h-4 w-4" />
            Add Organization
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {/* Search Bar */}
          <div className="border-b border-border p-4">
            <div className="relative max-w-md">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search organizations..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full rounded-xl border border-input bg-background py-2.5 pr-4 pl-10 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                    Organization
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                    Sector / Region
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                    Created Date
                  </th>
                  <th className="w-12 px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <Loader className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    </td>
                  </tr>
                ) : organizations.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-12 text-center text-muted-foreground"
                    >
                      No organizations found
                    </td>
                  </tr>
                ) : (
                  organizations.map((org) => {
                    const statusInfo = getStatusInfo(org.isAccountVerified)
                    const initials = getInitials(org.organizationName)

                    return (
                      <tr
                        key={org.id}
                        className="transition-colors hover:bg-muted/50"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 font-medium text-primary">
                              {initials}
                            </div>
                            <div>
                              <div className="font-medium text-foreground">
                                {org.organizationName}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {org.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusInfo.color}`}
                          >
                            {statusInfo.text}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {getRegionLabel(org)}
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {formatDate(org.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-muted-foreground hover:text-foreground">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-3 p-4 lg:hidden">
            {isLoading ? (
              <div className="py-12 text-center">
                <Loader className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : organizations.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No organizations found
              </div>
            ) : (
              organizations.map((org) => {
                const statusInfo = getStatusInfo(org.isAccountVerified)
                const initials = getInitials(org.organizationName)

                return (
                  <div
                    key={org.id}
                    className="rounded-xl border border-border bg-card p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-medium text-primary">
                          {initials}
                        </div>
                        <div>
                          <div className="font-medium text-foreground">
                            {org.organizationName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(org.createdAt)}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusInfo.color}`}
                      >
                        {statusInfo.text}
                      </span>
                    </div>

                    <div className="mt-4 text-sm text-muted-foreground">
                      {getRegionLabel(org)}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col items-center justify-between gap-4 border-t border-border px-6 py-4 sm:flex-row">
              <div className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * limit + 1} to{" "}
                {Math.min(currentPage * limit, totalItems)} of {totalItems}{" "}
                organizations
                {isFetching && (
                  <Loader className="ml-2 inline h-3 w-3 animate-spin" />
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="rounded-lg border p-2 hover:bg-muted disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`rounded-lg px-3 py-1 text-sm ${
                        currentPage === page
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="rounded-lg border p-2 hover:bg-muted disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Zero-input onboarding wizard (#96) — replaces the former fake modal */}
      {isWizardOpen && (
        <OnboardingWizard onClose={() => setIsWizardOpen(false)} />
      )}
    </div>
  )
}

export default AdminOrganization
