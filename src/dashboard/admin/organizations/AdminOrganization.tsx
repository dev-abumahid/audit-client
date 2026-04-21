import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Search,
  X,
} from "lucide-react"
import React, { useState } from "react"

interface Organization {
  _id: string
  org_name: string
  isSubscriptionActive: boolean
  createdAt: string
}

const AdminOrganization: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    org_name: "",
    userName: "",
    email: "",
    password: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const limit = 10

  // Dummy Organizations Data
  const allOrganizations: Organization[] = [
    {
      _id: "ORG-001",
      org_name: "TechVision Solutions",
      isSubscriptionActive: true,
      createdAt: "2025-11-15T10:30:00Z",
    },
    {
      _id: "ORG-002",
      org_name: "GreenField Academy",
      isSubscriptionActive: true,
      createdAt: "2025-11-20T14:20:00Z",
    },
    {
      _id: "ORG-003",
      org_name: "Nexus Dynamics",
      isSubscriptionActive: false,
      createdAt: "2025-11-25T09:15:00Z",
    },
    {
      _id: "ORG-004",
      org_name: "Summit Healthcare",
      isSubscriptionActive: true,
      createdAt: "2025-12-01T16:45:00Z",
    },
    {
      _id: "ORG-005",
      org_name: "Quantum Labs",
      isSubscriptionActive: false,
      createdAt: "2025-12-05T11:20:00Z",
    },
    {
      _id: "ORG-006",
      org_name: "BrightPath Education",
      isSubscriptionActive: true,
      createdAt: "2025-12-08T08:55:00Z",
    },
  ]

  // Filter organizations
  const filteredOrganizations = allOrganizations.filter((org) =>
    org.org_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalItems = filteredOrganizations.length
  const totalPages = Math.ceil(totalItems / limit)
  const paginatedOrganizations = filteredOrganizations.slice(
    (currentPage - 1) * limit,
    currentPage * limit
  )

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    setCurrentPage(1)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleOpenModal = () => {
    setFormData({ org_name: "", userName: "", email: "", password: "" })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setFormData({ org_name: "", userName: "", email: "", password: "" })
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleCreateOrganization = async () => {
    if (
      !formData.org_name.trim() ||
      !formData.userName.trim() ||
      !formData.email.trim() ||
      !formData.password.trim()
    ) {
      alert("Please fill all required fields")
      return
    }

    if (formData.password.length < 6) {
      alert("Password must be at least 6 characters long")
      return
    }

    setIsSubmitting(true)

    // Simulate API call
    setTimeout(() => {
      alert(`Organization "${formData.org_name}" created successfully!`)
      handleCloseModal()
      setIsSubmitting(false)
      // In real app, you would refetch data here
    }, 800)
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

  const getStatusInfo = (isActive: boolean) => ({
    text: isActive ? "Active" : "Inactive",
    color: isActive
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  })

  const getPlanName = (isActive: boolean) =>
    isActive ? "Active Plan" : "No Active Plan"

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
            onClick={handleOpenModal}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            + Add Organization
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
                    Plan Status
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                    Subscription
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                    Created Date
                  </th>
                  <th className="w-12 px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedOrganizations.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-12 text-center text-muted-foreground"
                    >
                      No organizations found
                    </td>
                  </tr>
                ) : (
                  paginatedOrganizations.map((org) => {
                    const statusInfo = getStatusInfo(org.isSubscriptionActive)
                    const initials = getInitials(org.org_name)

                    return (
                      <tr
                        key={org._id}
                        className="transition-colors hover:bg-muted/50"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 font-medium text-primary">
                              {initials}
                            </div>
                            <div>
                              <div className="font-medium text-foreground">
                                {org.org_name}
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
                          {getPlanName(org.isSubscriptionActive)}
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
            {paginatedOrganizations.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No organizations found
              </div>
            ) : (
              paginatedOrganizations.map((org) => {
                const statusInfo = getStatusInfo(org.isSubscriptionActive)
                const initials = getInitials(org.org_name)

                return (
                  <div
                    key={org._id}
                    className="rounded-xl border border-border bg-card p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-medium text-primary">
                          {initials}
                        </div>
                        <div>
                          <div className="font-medium text-foreground">
                            {org.org_name}
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
                      Plan: {getPlanName(org.isSubscriptionActive)}
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

      {/* Create Organization Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-foreground">
                Create New Organization
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                  Organization Name
                </label>
                <input
                  name="org_name"
                  type="text"
                  value={formData.org_name}
                  onChange={handleInputChange}
                  placeholder="Enter organization name"
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                  Username
                </label>
                <input
                  name="userName"
                  type="text"
                  value={formData.userName}
                  onChange={handleInputChange}
                  placeholder="Enter username"
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter email address"
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                  Password
                </label>
                <input
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter password"
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={handleCloseModal}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrganization}
                disabled={
                  isSubmitting ||
                  !formData.org_name ||
                  !formData.userName ||
                  !formData.email ||
                  !formData.password
                }
                className="flex-1 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {isSubmitting ? "Creating..." : "Create Organization"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminOrganization
