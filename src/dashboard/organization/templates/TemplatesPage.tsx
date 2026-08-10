/* eslint-disable @typescript-eslint/no-explicit-any */
import DeleteAlertModal from "@/components/shared/DeleteAlertModal"
import Pagination from "@/components/shared/Pagination"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useClampPageToTotal } from "@/hooks/useClampPageToTotal"
import { useDebouncedValue } from "@/hooks/Usedebouncedvalue"
import { canWriteOrgResource, useMyOrgRole } from "@/hooks/useMyOrgRole"
import {
  useDeleteTemplateMutation,
  useDuplicateTemplateMutation,
  useGetAllTemplatesQuery,
  useGetTemplateCategoriesQuery,
} from "@/redux/apis/organization/template.api"
import type { TemplateSummary } from "@/types/template"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Brain, Copy, Edit, Plus, Search, Trash2 } from "lucide-react"
import { isSystemTemplateName } from "@/utils/isSystemTemplate"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { toast } from "sonner"
import CreateTemplateWithAIDialog from "./shared/CreateTemplateWithAIDialog"

// aexa-frontend#377 -- see src/utils/isSystemTemplate.ts for why this is a
// name-substring stopgap rather than a real isSystem flag. Shared with
// EditTemplatePage.tsx so the edit *route* (directly reachable by URL) is
// gated the same way as this list page's Edit/Delete buttons.
const isSystemTemplate = (template: TemplateSummary) =>
  isSystemTemplateName(template.templateName)

// -------- Skeleton --------
function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            </div>
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          </TableCell>
          <TableCell className="hidden sm:table-cell">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </TableCell>
          <TableCell className="text-right">
            <div className="flex justify-end gap-1">
              <div className="h-8 w-8 animate-pulse rounded bg-muted" />
              <div className="h-8 w-8 animate-pulse rounded bg-muted" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

export default function TemplatesPage() {
  const { t, i18n } = useTranslation()
  // date-fns's format() defaults to English month names regardless of the
  // app's selected language -- pass the French locale explicitly under a
  // French UI, same "i18n.language?.startsWith('fr')" convention as
  // formatLocaleDate/TeamMembersTab.tsx (round 3, aexa-frontend#336).
  const dateFnsLocale = i18n.language?.startsWith("fr") ? fr : undefined
  const role = useMyOrgRole()
  const canWrite = canWriteOrgResource(role)
  const [deleteTemplate, { isLoading: isTemplateDeleting }] =
    useDeleteTemplateMutation()
  const [duplicateTemplate] = useDuplicateTemplateMutation()
  // Tracks which specific row is duplicating, so each row's button disables
  // independently -- the mutation hook's own isLoading is shared across ALL
  // rows and would either over-disable every row or (compared against
  // per-id, see handleDuplicateClick) silently no-op a second row's click.
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [page, setPage] = useState(1)
  // quality-bar-loop round 4 (industry-standards): filter dropdown lists
  // the org's own already-used categories -- an unfiltered free-text field
  // here would let a typo silently return zero results with no feedback.
  const { data: categoriesData } = useGetTemplateCategoriesQuery()
  const categoryOptions = categoriesData?.data ?? []
  const [createTemplateModalOpen, setCreateTemplateModalOpen] =
    useState<boolean>(false)

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  )

  const limit = 10

  //search Input optimized
  const debouncedSearchTerm = useDebouncedValue(searchInput, 300)

  const { data, isLoading } = useGetAllTemplatesQuery({
    page,
    limit,
    searchTerm: debouncedSearchTerm,
    category: categoryFilter || undefined,
  })

  const templates: TemplateSummary[] = data?.data || []
  const total = data?.meta?.total || 0
  const totalPages = Math.ceil(total / limit)

  // aexa-frontend#265: a delete that removes the last item on the last page
  // shrinks totalPages without any filter change to trigger the existing
  // setPage(1) resets above, stranding the user on an out-of-range empty
  // page. Safety net, complementary to (not a replacement for) those resets.
  useClampPageToTotal(page, totalPages, setPage)

  // -------- Handlers --------
  const handleDeleteClick = (id: string) => {
    setSelectedTemplateId(id)
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    // Same discarded-isLoading double-submission bug fixed for
    // RiskRegisterPage/aexa-frontend#620 -- the disabled button prop is the
    // primary guard, but a defensive check inside the handler closes the
    // theoretical window where a second call could land before a re-render
    // commits the disabled state.
    if (!selectedTemplateId || isTemplateDeleting) return

    try {
      const res = await deleteTemplate(selectedTemplateId).unwrap()

      if (res?.success) {
        toast.success(res?.message)
        setDeleteModalOpen(false)
        setSelectedTemplateId(null)
      }
    } catch (err: any) {
      // RTK Query's fetchBaseQuery rejection shape nests the server message
      // under `data`, not `message` directly -- the established convention
      // on AlertsPage/FindingDetails/KriDashboardPage/RiskRegisterPage/
      // InspectionTable. `err?.message` here never matched a real rejection,
      // so every delete failure silently fell through to the generic
      // fallback. Found by review (PR #675) while adding the sibling
      // duplicate handler below.
      toast.error(
        err?.data?.message || t("organization.templates.list.deleteFailed")
      )
    }
  }

  const handleDuplicateClick = async (id: string) => {
    // Compare against THIS row's id, not the shared mutation hook's
    // isLoading -- that flag is true while ANY row is duplicating, so using
    // it as a guard here would silently no-op a click on a second row while
    // a first row's duplicate is still in flight (no toast, no call), even
    // though that row's own button isn't visually disabled. Found by review
    // (PR #675).
    if (duplicatingId === id) return
    setDuplicatingId(id)
    try {
      const res = await duplicateTemplate(id).unwrap()
      if (res?.success) {
        toast.success(res?.message)
      }
    } catch (err: any) {
      toast.error(
        err?.data?.message || t("organization.templates.list.duplicateFailed")
      )
    } finally {
      setDuplicatingId(null)
    }
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* -------- Header -------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            {t("organization.templates.list.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("organization.templates.list.description")}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          {/* quality-bar-loop round 2 (mobile, round-1 finding): the
              shared Input/Button components default to h-7 (Input) and
              h-7 (Button, "default" size) -- both well under the 44px
              touch-target guideline, same bug class fixed on 9+ pages
              this session. `h-11` overrides the component defaults via
              tailwind-merge, same pattern used everywhere else. */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("organization.templates.list.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value)
                setPage(1)
              }}
              className="h-11 pl-10"
            />
          </div>

          {categoryOptions.length > 0 && (
            <select
              aria-label={t("organization.templates.list.categoryFilterLabel")}
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value)
                setPage(1)
              }}
              className="h-11 rounded-md border border-input bg-input/20 px-2 text-sm dark:bg-input/30"
            >
              <option value="">
                {t("organization.templates.list.allCategories")}
              </option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          {canWrite && (
            <Button
              onClick={() => setCreateTemplateModalOpen(true)}
              className="h-11"
            >
              <Brain className="mr-2 h-4 w-4" />
              {t("organization.templates.list.generateTemplate")}
            </Button>
          )}

          {canWrite && (
            <Link to="/organization/audit/template/create">
              <Button className="h-11">
                <Plus className="mr-2 h-4 w-4" />
                {t("organization.templates.list.createTemplate")}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* -------- Table -------- */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                {t("organization.templates.list.colTemplate")}
              </TableHead>
              <TableHead className="hidden md:table-cell">
                {t("organization.templates.list.colDescription")}
              </TableHead>
              <TableHead className="hidden sm:table-cell">
                {t("organization.templates.list.colCreated")}
              </TableHead>
              <TableHead className="hidden md:table-cell">
                {t("organization.templates.list.colUpdated")}
              </TableHead>
              <TableHead className="text-right">
                {t("organization.templates.list.colActions")}
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableSkeleton />
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  {t("organization.templates.list.noTemplates")}
                </TableCell>
              </TableRow>
            ) : (
              templates.map((template) => {
                const isSystem = isSystemTemplate(template)
                return (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {template.templateLogo && (
                          <img
                            src={template.templateLogo}
                            alt={template.templateName}
                            className="h-8 w-8 rounded-md object-cover"
                          />
                        )}
                        <div>
                          <div className="line-clamp-1 font-medium">
                            <Link
                              to={`/organization/audit/template/report/${template.id}`}
                            >
                              {template.templateName}
                            </Link>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {/* quality-bar-loop round 5 (industry-
                                standards): only drafts get a badge here
                                -- a published template (the common case)
                                keeps today's row layout unchanged. */}
                            {template.status === "DRAFT" && (
                              <span className="inline-block rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                                {t("organization.templates.list.draftBadge")}
                              </span>
                            )}
                            {template.category && (
                              <span className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                                {template.category}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {template.templateDisc
                        ? template.templateDisc.length > 50
                          ? `${template.templateDisc.slice(0, 50)} ...`
                          : template.templateDisc
                        : t("organization.templates.list.noDescription")}
                    </TableCell>

                    <TableCell className="hidden sm:table-cell">
                      {format(new Date(template.createdAt), "dd MMM yyyy", {
                        locale: dateFnsLocale,
                      })}
                    </TableCell>

                    <TableCell className="hidden md:table-cell">
                      {format(new Date(template.updatedAt), "dd MMM yyyy", {
                        locale: dateFnsLocale,
                      })}
                    </TableCell>

                    <TableCell className="text-right">
                      {/* quality-bar-loop round 2 (mobile, round-1
                          finding): `size="sm"` resolves to `h-6` (24px
                          tall), well under the 44px touch-target
                          guideline -- same bug class fixed on 9+ pages
                          this session. `h-11 w-11` overrides via
                          tailwind-merge, matching every other page's
                          icon-only-button fix pattern. */}
                      <div className="flex justify-end gap-1">
                        {canWrite && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicateClick(template.id)}
                            disabled={duplicatingId === template.id}
                            aria-label={t(
                              "organization.templates.list.duplicateButtonLabel",
                              { name: template.templateName }
                            )}
                            className="h-11 w-11"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                        {canWrite &&
                          (isSystem ? (
                            <span
                              title={t(
                                "organization.templates.list.systemTemplateTooltip"
                              )}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled
                                aria-label={t(
                                  "organization.templates.list.editButtonLabel",
                                  { name: template.templateName }
                                )}
                                className="h-11 w-11 cursor-not-allowed opacity-40"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled
                                aria-label={t(
                                  "organization.templates.list.deleteButtonLabel",
                                  { name: template.templateName }
                                )}
                                className="h-11 w-11 cursor-not-allowed text-destructive opacity-40"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </span>
                          ) : (
                            <>
                              <Link
                                to={`/organization/audit/template/edit/${template.id}`}
                              >
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  aria-label={t(
                                    "organization.templates.list.editButtonLabel",
                                    { name: template.templateName }
                                  )}
                                  className="h-11 w-11"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </Link>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(template.id)}
                                aria-label={t(
                                  "organization.templates.list.deleteButtonLabel",
                                  { name: template.templateName }
                                )}
                                className="h-11 w-11 text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ))}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        label={t("organization.templates.list.pagination", {
          from: (page - 1) * limit + 1,
          to: Math.min(page * limit, total),
          total,
        })}
        prevAriaLabel={t("organization.templates.list.prevPage")}
        nextAriaLabel={t("organization.templates.list.nextPage")}
      />

      {/* -------- Delete Modal -------- */}
      <DeleteAlertModal
        open={deleteModalOpen}
        setOpen={setDeleteModalOpen}
        title={t("organization.templates.list.deleteTitle")}
        description={t("organization.templates.list.deleteDescription")}
        onConfirm={handleConfirmDelete}
        loading={isTemplateDeleting}
      />
      <CreateTemplateWithAIDialog
        open={createTemplateModalOpen}
        setOpen={setCreateTemplateModalOpen}
      />
    </div>
  )
}
