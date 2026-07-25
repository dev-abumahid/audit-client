import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
} from "lucide-react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

interface Transaction {
  _id: string
  transactionId: string
  organizationId: string
  planName: string
  planType: string
  amount: number
  status: string
  createdAt: string
}

const AdminTransactions: React.FC = () => {
  const { t } = useTranslation()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)

  const limit = 10

  // Dummy Data (Replace with real data from backend later)
  const allTransactions: Transaction[] = [
    {
      _id: "PAY-001",
      transactionId: "TXN-892341",
      organizationId: "TechVision Solutions",
      planName: "Enterprise",
      planType: "Yearly",
      amount: 2999,
      status: "Completed",
      createdAt: "2025-12-15T10:30:00Z",
    },
    {
      _id: "PAY-002",
      transactionId: "TXN-892342",
      organizationId: "GreenField Academy",
      planName: "Premium",
      planType: "Monthly",
      amount: 149,
      status: "Completed",
      createdAt: "2025-12-14T14:20:00Z",
    },
    {
      _id: "PAY-003",
      transactionId: "TXN-892343",
      organizationId: "Nexus Dynamics",
      planName: "Business",
      planType: "Quarterly",
      amount: 899,
      status: "Pending",
      createdAt: "2025-12-13T09:15:00Z",
    },
    {
      _id: "PAY-004",
      transactionId: "TXN-892344",
      organizationId: "Summit Healthcare",
      planName: "Enterprise",
      planType: "Yearly",
      amount: 2999,
      status: "Completed",
      createdAt: "2025-12-12T16:45:00Z",
    },
    {
      _id: "PAY-005",
      transactionId: "TXN-892345",
      organizationId: "Quantum Labs",
      planName: "Starter",
      planType: "Monthly",
      amount: 49,
      status: "Failed",
      createdAt: "2025-12-11T11:20:00Z",
    },
    {
      _id: "PAY-006",
      transactionId: "TXN-892346",
      organizationId: "BrightPath Education",
      planName: "Premium",
      planType: "Yearly",
      amount: 1199,
      status: "Completed",
      createdAt: "2025-12-10T08:55:00Z",
    },
  ]

  // Filter transactions (Frontend filter - you can remove this when backend handles search)
  const filteredTransactions = allTransactions.filter((tx) => {
    const matchesSearch =
      !searchTerm ||
      tx.transactionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.organizationId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.planName.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus =
      statusFilter === "all" ||
      tx.status.toLowerCase() === statusFilter.toLowerCase()

    return matchesSearch && matchesStatus
  })

  const totalItems = filteredTransactions.length
  const totalPages = Math.ceil(totalItems / limit)
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * limit,
    currentPage * limit
  )

  // Unique statuses for dropdown
  const uniqueStatuses = Array.from(
    new Set(allTransactions.map((t) => t.status))
  )

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    setCurrentPage(1) // Reset to first page on search
  }

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value)
    setCurrentPage(1)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatAmount = (amount: number) => `$${amount.toLocaleString()}`

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
      case "pending":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      case "failed":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return t("admin.transactions.status.completed")
      case "pending":
        return t("admin.transactions.status.pending")
      case "failed":
        return t("admin.transactions.status.failed")
      default:
        return status
    }
  }

  return (
    <div className="flex-1 bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">
              {t("admin.transactions.title")}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {t("admin.transactions.subtitle")}
            </p>
          </div>

          {/* Export button - Now calls backend */}
          <button
            onClick={() => alert(t("admin.transactions.exportSent"))}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Download className="h-4 w-4" />
            {t("admin.transactions.exportPdf")}
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {/* Filters */}
          <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder={t("admin.transactions.searchPlaceholder")}
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full rounded-xl border border-input bg-background py-2.5 pr-4 pl-10 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            <div className="relative w-full md:w-64">
              <select
                value={statusFilter}
                onChange={handleStatusChange}
                className="w-full appearance-none rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="all">{t("admin.transactions.allStatus")}</option>
                {uniqueStatuses.map((status) => (
                  <option key={status} value={status}>
                    {getStatusLabel(status)}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                    {t("admin.transactions.colTransactionId")}
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                    {t("admin.transactions.colOrganization")}
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                    {t("admin.transactions.colPlan")}
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                    {t("admin.transactions.colType")}
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-muted-foreground">
                    {t("admin.transactions.colAmount")}
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-muted-foreground">
                    {t("admin.transactions.colStatus")}
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                    {t("admin.transactions.colDate")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedTransactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-12 text-center text-muted-foreground"
                    >
                      {t("admin.transactions.noResults")}
                    </td>
                  </tr>
                ) : (
                  paginatedTransactions.map((tx) => (
                    <tr
                      key={tx._id}
                      className="transition-colors hover:bg-muted/50"
                    >
                      <td className="px-6 py-4 font-mono text-sm text-foreground">
                        {tx.transactionId}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-foreground">
                        {tx.organizationId}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {tx.planName}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {tx.planType}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-foreground">
                        {formatAmount(tx.amount)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(tx.status)}`}
                        >
                          {getStatusLabel(tx.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {formatDate(tx.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-4 p-4 lg:hidden">
            {paginatedTransactions.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                {t("admin.transactions.noResults")}
              </div>
            ) : (
              paginatedTransactions.map((tx) => (
                <div
                  key={tx._id}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <div className="font-medium text-foreground">
                        {tx.organizationId}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {tx.transactionId}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs ${getStatusColor(tx.status)}`}
                    >
                      {getStatusLabel(tx.status)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">{t("admin.transactions.colPlan")}</p>
                      <p className="font-medium">{tx.planName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("admin.transactions.colAmount")}</p>
                      <p className="font-semibold text-foreground">
                        {formatAmount(tx.amount)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-muted-foreground">
                    {tx.planType} • {formatDate(tx.createdAt)}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col items-center justify-between gap-4 border-t border-border px-6 py-4 sm:flex-row">
              <div className="text-sm text-muted-foreground">
                {t("admin.transactions.pagination", {
                  from: (currentPage - 1) * limit + 1,
                  to: Math.min(currentPage * limit, totalItems),
                  total: totalItems,
                })}
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
    </div>
  )
}

export default AdminTransactions
