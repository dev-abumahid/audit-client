// EditTemplatePage.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAutoSave } from "@/hooks/useAutoSave"
import { useModalA11y } from "@/hooks/useModalA11y"
import { useSectionScroll } from "@/hooks/useSectionScroll"
import {
  useGetSingleTemplateQuery,
  useGetTemplateCategoriesQuery,
  useUpdateTemplateBasicsMutation,
  useUpdateTemplateStatusMutation,
} from "@/redux/apis/organization/template.api"
import type {
  AnswerType,
  QuestionField,
  TemplateFormValues,
} from "@/types/template"
import { isSystemTemplateName } from "@/utils/isSystemTemplate"
import { transformValuesToString } from "@/utils/transformValuesToString"
import { Loader2, Plus, Sliders, Upload } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router"
import { toast } from "sonner"
import QnASettingsPanel from "../shared/QnASettingsPanel"
import { RemoveIconButton } from "../shared/RemoveIconButton"
import SectionNavigator from "../shared/SectionNavigator"
import EditPageSection from "./EditPagesection"
import { SaveStatusIndicator } from "./SaveStatusIndicator"

let _idCounter = 0
const uid = () => `rhf-${++_idCounter}-${Math.random().toString(36).slice(2)}`

const EditTemplatePage = () => {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const [updateTemplateBasics] = useUpdateTemplateBasicsMutation()
  const [updateTemplateStatus, { isLoading: isTogglingStatus }] =
    useUpdateTemplateStatusMutation()
  const [addModalTarget, setAddModalTarget] = useState<number | null>(null)
  // aexa-frontend#490 -- role="dialog"/focus-trap/Escape for the "Add New"
  // modal, same pattern KriDashboardPage uses (round 10, #487).
  const addModalRef = useModalA11y(addModalTarget !== null, () =>
    setAddModalTarget(null)
  )
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoObjectUrl, setLogoObjectUrl] = useState<string | null>(null)
  const [answerPanel, setAnswerPanel] = useState<{
    pageIndex: number
    questionIndex: number
  } | null>(null)

  // Revoke the previous object URL whenever it's replaced (a new file is
  // chosen, the logo is removed, or the page unmounts) — createObjectURL
  // holds a reference to the File's blob until explicitly revoked,
  // otherwise it leaks memory. Mirrors the pattern in PersonalInfoForm.tsx.
  useEffect(() => {
    return () => {
      if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl)
    }
  }, [logoObjectUrl])

  const initialLoadComplete = useRef(false)
  const { data: templateData, isLoading: isFetchingTemplate } =
    useGetSingleTemplateQuery(id || "", { skip: !id })
  // quality-bar-loop round 4 (industry-standards): same free-text +
  // suggest-from-existing-values pattern as CreateTemplatePage.tsx.
  const { data: categoriesData } = useGetTemplateCategoriesQuery()
  const categorySuggestions = categoriesData?.data ?? []

  const form = useForm<TemplateFormValues>({
    defaultValues: {
      templateName: t("organization.templates.create.defaultTemplateName"),
      templateDisc: "",
      category: "",
      // Overwritten with the loaded template's real status once the fetch
      // resolves (see the load effect below) -- PUBLISHED here is just the
      // pre-load placeholder, matching every existing template's default.
      status: "PUBLISHED",
      pages: [],
    },
    mode: "onChange", // Track changes in real-time
  })

  const { control, handleSubmit, getValues, setValue } = form

  const {
    fields: pageFields,
    append: appendPage,
    remove: removePage,
    replace,
  } = useFieldArray({
    control,
    name: "pages",
    keyName: "fieldId",
  })

  // pageFields' non-key values are frozen at insertion (react-hook-form
  // field-array semantics) — watch the live values so the navigator shows
  // section titles as they're typed, not stale ones from when each section
  // was created or last loaded.
  const watchedPages = useWatch({ control, name: "pages" })
  const { activeIndex, registerSection, scrollToSection } = useSectionScroll(
    pageFields.map((f) => f.fieldId)
  )

  // Save handler for auto-save
  const handleSave = useCallback(
    async (values: TemplateFormValues) => {
      if (!id) return

      try {
        const formData = new FormData()
        const formattedValues = transformValuesToString(values)
        formData.append("data", JSON.stringify(formattedValues))

        if (logoFile) {
          formData.append("file", logoFile)
        }

        const res = await updateTemplateBasics({ data: formData, id }).unwrap()

        if (!res?.success) {
          throw new Error(
            res?.message || t("organization.templates.edit.updateFailed")
          )
        }

        // Clear logo file after successful save
        if (logoFile) {
          setLogoFile(null)
        }
      } catch (error: any) {
        // error?.data?.message checked first for a raw RTK Query rejection
        // (fetchBaseQuery nests the server message under `data`, not
        // `message` directly); error?.message covers the manually-thrown
        // Error above (res?.message not success). Same bug class fixed on
        // TemplatesPage.tsx, PR #675 -- found by that PR's review while
        // auditing this util's other consumer.
        toast.error(
          error?.data?.message ||
            error?.message ||
            t("organization.templates.edit.saveError")
        )
        throw error
      }
    },
    [id, logoFile, updateTemplateBasics, t]
  )

  // Auto-save hook
  const { saveStatus, hasChanges, manualSave, isSaving } = useAutoSave({
    form,
    onSave: handleSave,
    interval: 2000, // Auto-save every 2 seconds
    enabled: !!id && initialLoadComplete.current,
  })
  // Load template data
  useEffect(() => {
    if (templateData?.data && !initialLoadComplete.current) {
      const template = templateData.data

      setValue(
        "templateName",
        template.templateName ||
          t("organization.templates.create.defaultTemplateName")
      )
      setValue("templateDisc", template.templateDisc || "")
      setValue("category", template.category || "")
      setValue("status", template.status || "PUBLISHED")

      if (template.templateLogo) {
        setLogoPreview(template.templateLogo)
      }

      if (template.pages && template.pages.length > 0) {
        const formattedPages = template.pages.map((page: any, idx: number) => ({
          id: page.id,
          pageIndex: idx,
          title: page.title,
          questions: (page.questions || []).map((q: any, qIdx: number) => ({
            id: q.id,
            index: qIdx,
            question: q.question,
            isRequired: q.isRequired,
            answerType: {
              answerType: q.answerType || "input",
              value: q.value || "text",
            },
          })),
        }))

        replace(formattedPages)
      } else {
        replace([
          {
            id: uid(),
            pageIndex: 0,
            title: t("organization.templates.create.defaultSectionTitle"),
            questions: [
              {
                id: uid(),
                index: 0,
                question: t(
                  "organization.templates.create.defaultQuestionTitle"
                ),
                isRequired: true,
                answerType: {
                  answerType: "input",
                  value: "text",
                },
              },
            ],
          },
        ])
      }

      initialLoadComplete.current = true
    }
  }, [templateData, setValue, replace, t])
  const handleAddQuestion = useCallback(() => {
    if (addModalTarget === null) return
    const pIdx = addModalTarget
    const questions = getValues(`pages.${pIdx}.questions`) || []
    const newQ: QuestionField = {
      id: uid(),
      index: questions.length,
      question: "",
      isRequired: false,
      answerType: { answerType: "input", value: "text" },
    }

    setValue(`pages.${pIdx}.questions`, [...questions, newQ], {
      shouldDirty: true,
    })
    setAddModalTarget(null)
  }, [addModalTarget, getValues, setValue])

  const handleAddSection = useCallback(() => {
    appendPage({
      id: uid(),
      pageIndex: pageFields.length,
      title: t("organization.templates.create.newSectionTitle", {
        num: pageFields.length + 1,
      }),
      questions: [],
    })
    setAddModalTarget(null)
  }, [appendPage, pageFields.length, t])

  const handleSelectAnswerType = useCallback(
    (type: string) => {
      if (!answerPanel) return
      const { pageIndex, questionIndex } = answerPanel

      let newAnswerType: AnswerType
      switch (type) {
        case "input":
          newAnswerType = { answerType: "input", value: "text" }
          break
        case "checkbox":
          newAnswerType = { answerType: "checkbox", value: false }
          break
        case "date":
          newAnswerType = { answerType: "date", value: new Date() }
          break
        case "media":
          newAnswerType = { answerType: "media", value: "document" }
          break
        case "slider":
          newAnswerType = { answerType: "slider", value: 0 }
          break
        default:
          newAnswerType = { answerType: "input", value: "text" }
      }

      setValue(
        `pages.${pageIndex}.questions.${questionIndex}.answerType`,
        newAnswerType,
        { shouldDirty: true }
      )
      setAnswerPanel(null)
    },
    [answerPanel, setValue]
  )

  const currentStatus = useWatch({ control, name: "status" })

  const handleToggleStatus = async () => {
    if (!id || isTogglingStatus) return
    const nextStatus = currentStatus === "PUBLISHED" ? "DRAFT" : "PUBLISHED"
    try {
      const res = await updateTemplateStatus({ id, status: nextStatus }).unwrap()
      if (res?.success) {
        setValue("status", nextStatus)
        toast.success(
          nextStatus === "PUBLISHED"
            ? t("organization.templates.edit.publishSuccess")
            : t("organization.templates.edit.unpublishSuccess")
        )
      }
    } catch (error: any) {
      toast.error(
        error?.data?.message || t("organization.templates.edit.statusUpdateFailed")
      )
    }
  }

  const onSubmit = async () => {
    try {
      await manualSave()
      toast.success(t("organization.templates.edit.updateSuccess"))
    } catch (error: any) {
      toast.error(
        error?.data?.message ||
          error?.message ||
          t("organization.templates.edit.updateFailed")
      )
    }
  }

  if (isFetchingTemplate) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">
            {t("organization.templates.edit.loading")}
          </p>
        </div>
      </div>
    )
  }

  // aexa-frontend#377 -- TemplatesPage.tsx already hides the Edit link for
  // the system "AI-Generated Findings" template, but that only removes one
  // entry point. This route (/organization/audit/template/edit/:id) is
  // directly reachable by URL (bookmark, typed URL, restored tab) with no
  // other guard on template identity, and would otherwise let a user submit
  // an update to the system template via the same mutation as any real
  // template. Block the edit form itself, not just the link to it.
  if (isSystemTemplateName(templateData?.data?.templateName)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="mb-2 font-heading text-xl font-semibold text-foreground">
            {t("organization.templates.edit.systemTemplateBlockedTitle")}
          </h1>
          <p className="mb-6 text-muted-foreground">
            {t("organization.templates.edit.systemTemplateBlockedDescription")}
          </p>
          <Link to="/organization/audit/templates">
            <Button variant="outline">
              {t("organization.templates.edit.backToTemplates")}
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="min-h-screen bg-background"
    >
      {/* Top Bar */}
      <div className="sticky top-0 z-50 border-b bg-card py-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6">
          <h1 className="sr-only">
            {t("organization.templates.edit.pageTitle")}
          </h1>
          <Link
            to="/organization/audit/templates"
            className="text-muted-foreground hover:text-foreground"
          >
            {t("organization.templates.create.back")}
          </Link>

          <div className="flex items-center gap-4">
            {/* quality-bar-loop round 5 (industry-standards): draft/
                publish toggle, matching Typeform/Google Forms/
                SafetyCulture's distinction between a half-built template
                and one ready for real use. */}
            <span
              className={
                currentStatus === "PUBLISHED"
                  ? "rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                  : "rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
              }
            >
              {currentStatus === "PUBLISHED"
                ? t("organization.templates.edit.published")
                : t("organization.templates.edit.draft")}
            </span>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleToggleStatus}
              disabled={isTogglingStatus}
            >
              {isTogglingStatus ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : currentStatus === "PUBLISHED" ? (
                t("organization.templates.edit.unpublish")
              ) : (
                t("organization.templates.edit.publish")
              )}
            </Button>

            {/* Save Status Indicator */}
            <SaveStatusIndicator status={saveStatus} hasChanges={hasChanges} />

            {/* Manual Save Button */}
            <Button
              type="submit"
              size="lg"
              disabled={isSaving || saveStatus === "idle"}
              variant={hasChanges ? "default" : "outline"}
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : hasChanges ? (
                t("organization.templates.edit.saveChanges")
              ) : (
                t("organization.templates.edit.saved")
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6">
        {/* Template Header */}
        <div className="mx-auto mb-8 max-w-7xl rounded-2xl border bg-card p-6">
          {/* ... Template header JSX remains the same ... */}
          <div className="flex gap-5">
            <div className="h-20 w-20 shrink-0 overflow-hidden">
              <div className="flex items-center gap-4">
                {logoFile ? (
                  <div className="relative h-20 w-20">
                    <img
                      src={logoObjectUrl ?? undefined}
                      className="h-20 w-20 rounded-xl border object-cover"
                      alt={t("organization.templates.edit.logoAlt")}
                    />
                    <RemoveIconButton
                      onClick={() => {
                        setLogoFile(null)
                        setLogoObjectUrl(null)
                        setLogoPreview(null)
                      }}
                      label={t("organization.templates.create.removeLogo")}
                      className="absolute -top-2 -right-2"
                      icon="x"
                      iconSize={12}
                      size="icon-sm"
                    />
                  </div>
                ) : logoPreview ? (
                  <div className="relative h-20 w-20">
                    <img
                      src={logoPreview}
                      className="h-20 w-20 rounded-xl border object-cover"
                      alt={t("organization.templates.edit.logoAlt")}
                    />
                    <RemoveIconButton
                      onClick={() => setLogoPreview(null)}
                      label={t("organization.templates.create.removeLogo")}
                      className="absolute -top-2 -right-2"
                      icon="x"
                      iconSize={12}
                      size="icon-sm"
                    />
                  </div>
                ) : (
                  <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-xl border bg-muted transition-colors hover:bg-muted/70">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="mt-1 text-xs text-muted-foreground">
                      {t("organization.templates.create.upload")}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setLogoFile(file)
                          setLogoObjectUrl(URL.createObjectURL(file))
                          setLogoPreview(null)
                          // Mark form as dirty to trigger auto-save
                          form.setValue(
                            "templateName",
                            form.getValues("templateName"),
                            { shouldDirty: true }
                          )
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <Controller
                control={control}
                name="templateName"
                rules={{
                  validate: (v) =>
                    (v ?? "").trim().length > 0 ||
                    t("organization.templates.create.nameRequired"),
                }}
                render={({ field, fieldState }) => (
                  <>
                    <input
                      {...field}
                      className="w-full rounded-md border border-border bg-transparent p-2 text-2xl font-semibold text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                      placeholder={t(
                        "organization.templates.create.namePlaceholder"
                      )}
                    />
                    {fieldState.error && (
                      <p className="mt-1 text-xs text-destructive">
                        {fieldState.error.message}
                      </p>
                    )}
                  </>
                )}
              />
              <Controller
                control={control}
                name="templateDisc"
                render={({ field }) => (
                  <Textarea
                    {...field}
                    rows={3}
                    placeholder={t(
                      "organization.templates.create.descPlaceholder"
                    )}
                    className="resize-none border border-border bg-transparent text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                )}
              />
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <>
                    <input
                      {...field}
                      list="edit-template-category-suggestions"
                      placeholder={t(
                        "organization.templates.create.categoryPlaceholder"
                      )}
                      className="w-full rounded-md border border-border bg-transparent p-2 text-sm text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                    <datalist id="edit-template-category-suggestions">
                      {categorySuggestions.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </>
                )}
              />
            </div>
          </div>
        </div>

        {/* Pages Section */}
        {pageFields.length === 0 ? (
          <div className="mx-auto max-w-7xl rounded-2xl border bg-card p-12 text-center">
            <p className="mb-6 text-muted-foreground">
              {t("organization.templates.create.noSections")}
            </p>
            <Button type="button" onClick={handleAddSection}>
              <Plus className="mr-2 h-4 w-4" />{" "}
              {t("organization.templates.create.createFirstSection")}
            </Button>
          </div>
        ) : (
          <div className="flex items-start gap-6">
            <SectionNavigator
              sections={pageFields.map((pageField, idx) => ({
                id: pageField.fieldId,
                title: watchedPages?.[idx]?.title ?? "",
              }))}
              activeIndex={activeIndex}
              onSelect={scrollToSection}
            />
            {/* No mx-auto here deliberately — on wide viewports it would
                absorb the leftover flex space and drift this column away
                from the sidebar instead of staying flush beside it. */}
            <div className="max-w-7xl min-w-0 flex-1">
              {pageFields.map((pageField, pIdx) => (
                <div key={pageField.fieldId} ref={registerSection(pIdx)}>
                  <EditPageSection
                    pageIndex={pIdx}
                    pageId={pageField.id}
                    templateId={id || ""}
                    control={control}
                    removePage={removePage}
                    totalPages={pageFields.length}
                    onOpenAddModal={(pi) => setAddModalTarget(pi)}
                    onOpenAnswerPanel={(pi, qi) =>
                      setAnswerPanel({ pageIndex: pi, questionIndex: qi })
                    }
                    getValues={getValues}
                    setValue={setValue}
                    isEditMode={true}
                    answerPanel={answerPanel}
                  />
                </div>
              ))}

              <div className="mt-10 flex justify-center">
                <Button
                  type="button"
                  onClick={handleAddSection}
                  size="lg"
                  variant="outline"
                >
                  <Plus className="h-4 w-4" />{" "}
                  {t("organization.templates.create.addNewSection")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {addModalTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            ref={addModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-add-new-modal-title"
            className="w-80 overflow-hidden rounded-2xl bg-card shadow-2xl"
          >
            <div className="bg-primary px-5 py-4 text-primary-foreground">
              <h3 id="edit-add-new-modal-title" className="font-semibold">
                {t("organization.templates.create.addNew")}
              </h3>
            </div>
            <div className="divide-y divide-border">
              <button
                type="button"
                onClick={handleAddQuestion}
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-secondary"
              >
                <Plus className="text-primary" />
                <span className="font-medium">
                  {t("organization.templates.create.createQuestion")}
                </span>
              </button>
              <button
                type="button"
                onClick={handleAddSection}
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-secondary"
              >
                <Sliders className="text-primary" />
                <span className="font-medium">
                  {t("organization.templates.create.createSection")}
                </span>
              </button>
            </div>
            <div className="border-t p-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddModalTarget(null)}
                className="w-full"
              >
                {t("organization.templates.create.cancel")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {answerPanel && (
        <QnASettingsPanel
          onClose={() => setAnswerPanel(null)}
          onSelectInput={(type) => handleSelectAnswerType(type)}
          onSelectResponseSet={(options) => {
            if (!answerPanel) return
            setValue(
              `pages.${answerPanel.pageIndex}.questions.${answerPanel.questionIndex}.answerType`,
              { answerType: "multipleSelect", value: options },
              { shouldDirty: true }
            )
            setAnswerPanel(null)
          }}
        />
      )}
    </form>
  )
}

export default EditTemplatePage
