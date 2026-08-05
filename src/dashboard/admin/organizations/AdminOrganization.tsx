import { Loader, Search, Sparkles } from "lucide-react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import Pagination from "@/components/shared/Pagination"
import {
  useGetAdminOrganizationsQuery,
  type AdminOrganizationListItem,
} from "@/redux/apis/organization/onboarding.api"
import { formatLocaleDate } from "@/utils/formatDate"
import { severityBadgeClasses } from "@/utils/severityStyles"
import OnboardingWizard from "./OnboardingWizard"

const AdminOrganization: React.FC = () => {
  const { t, i18n } = useTranslation()
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

  // Issue #364: was hardcoded toLocaleDateString("en-US", ...), which
  // silently ignored the app's selected language. Uses the shared
  // formatLocaleDate helper (same pattern as FindingDetails.tsx/
  // InspectionReport.tsx) instead of a local en-US-only formatter.
  const formatDate = (dateString: string) => {
    return formatLocaleDate(dateString, i18n.language, {
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
    text: isVerified
      ? t("admin.organizations.statusActive")
      : t("admin.organizations.statusPending"),
    color: severityBadgeClasses(isVerified ? "low" : "medium"),
  })

  const getRegionLabel = (org: AdminOrganizationListItem) =>
    [org.sector, org.country].filter(Boolean).join(" · ") || "—"

  return (
    <div className="flex-1 bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              {t("admin.organizations.title")}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {t("admin.organizations.subtitle")}
            </p>
          </div>

          <button
            onClick={() => setIsWizardOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Sparkles className="h-4 w-4" />
            {t("admin.organizations.addOrganization")}
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {/* Search Bar */}
          <div className="border-b border-border p-4">
            <div className="relative max-w-md">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder={t("admin.organizations.searchPlaceholder")}
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
                    {t("admin.organizations.colOrganization")}
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                    {t("admin.organizations.colStatus")}
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                    {t("admin.organizations.colSectorRegion")}
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                    {t("admin.organizations.colCreatedDate")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center">
                      <Loader className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    </td>
                  </tr>
                ) : organizations.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-12 text-center text-muted-foreground"
                    >
                      {t("admin.organizations.noResults")}
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
                        <td className="font-mono-data px-6 py-4 text-sm text-muted-foreground">
                          {formatDate(org.createdAt)}
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
                {t("admin.organizations.noResults")}
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
                          <div className="font-mono-data text-xs text-muted-foreground">
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
            <div className="border-t border-border px-6 py-4">
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                prevAriaLabel={t("admin.organizations.paginationPrevious")}
                nextAriaLabel={t("admin.organizations.paginationNext")}
                label={
                  <>
                    {t("admin.organizations.pagination", {
                      count: totalItems,
                      from: (currentPage - 1) * limit + 1,
                      to: Math.min(currentPage * limit, totalItems),
                      total: totalItems,
                    })}
                    {isFetching && (
                      <Loader className="ml-2 inline h-3 w-3 animate-spin" />
                    )}
                  </>
                }
              />
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
