"use client"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useModalA11y } from "@/hooks/useModalA11y"
import { useSectionScroll } from "@/hooks/useSectionScroll"
import { useCreateNewTemplateMutation } from "@/redux/apis/organization/template.api"
import type {
  AnswerType,
  QuestionField,
  TemplateFormValues,
} from "@/types/template"
import { transformValuesToString } from "@/utils/transformValuesToString"
import { Loader2, Plus, Sliders, Upload, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router"
import { toast } from "sonner"
import PageSection from "./PageSection"
import QnASettingsPanel from "../shared/QnASettingsPanel"
import SectionNavigator from "../shared/SectionNavigator"

let _idCounter = 0
const uid = () => `rhf-${++_idCounter}-${Math.random().toString(36).slice(2)}`

const CreateTemplatePage = () => {
  const { t } = useTranslation()
  const [createNewTemplate, { isLoading }] = useCreateNewTemplateMutation()
  const navigate = useNavigate()
  const [addModalTarget, setAddModalTarget] = useState<number | null>(null)
  // aexa-frontend#490 -- role="dialog"/focus-trap/Escape for the "Add New"
  // modal, same pattern KriDashboardPage uses (round 10, #487).
  const addModalRef = useModalA11y(addModalTarget !== null, () =>
    setAddModalTarget(null)
  )
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
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
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl)
    }
  }, [logoPreviewUrl])

  const { control, handleSubmit, getValues, setValue } =
    useForm<TemplateFormValues>({
      defaultValues: {
        templateName: t("organization.templates.create.defaultTemplateName"),
        templateDisc: "",
        pages: [
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
                answerType: { answerType: "input", value: "text" },
              },
            ],
          },
        ],
      },
    })

  const {
    fields: pageFields,
    append: appendPage,
    remove: removePage,
  } = useFieldArray({
    control,
    name: "pages",
  })

  // pageFields' non-key values are frozen at insertion (react-hook-form
  // field-array semantics) — watch the live values so the navigator shows
  // section titles as they're typed, not stale ones from when each section
  // was created.
  const watchedPages = useWatch({ control, name: "pages" })
  const { activeIndex, registerSection, scrollToSection } = useSectionScroll(
    pageFields.map((f) => f.id)
  )

  const handleAddQuestion = () => {
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
  }

  const handleAddSection = () => {
    appendPage({
      id: uid(),
      pageIndex: pageFields.length,
      title: t("organization.templates.create.newSectionTitle", {
        num: pageFields.length + 1,
      }),
      questions: [],
    })
    setAddModalTarget(null)
  }

  const handleSelectAnswerType = (type: string) => {
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
  }

  const onSubmit = async (values: TemplateFormValues) => {
    const formData = new FormData()
    const formattedValues = transformValuesToString(values)

    // make formdata
    formData.append("data", JSON.stringify(formattedValues))

    // logo file
    if (logoFile) {
      formData.append("file", logoFile)
    }
    try {
      const res = await createNewTemplate(formData).unwrap()
      if (res?.success) {
        toast.success(res?.message)
        navigate("/organization/audit/templates")
      } else {
        toast.error(
          res?.message || t("organization.templates.create.createFailed")
        )
      }
    } catch (error: unknown) {
      // No modal to close here (this is a full page, not a dialog) — the
      // form values are untouched since we never reset them, so the user
      // can just fix things and hit Save again.
      const msg = (error as { data?: { message?: string } })?.data?.message
      toast.error(msg || t("organization.templates.create.createFailed"))
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="min-h-screen bg-background"
    >
      {/* Top Bar */}
      <div className="sticky top-0 z-50 border-b bg-card py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <h1 className="sr-only">
              {t("organization.templates.create.pageTitle")}
            </h1>
            <Link
              to="/organization/audit/templates"
              className="text-muted-foreground hover:text-foreground"
            >
              {t("organization.templates.create.back")}
            </Link>
          </div>

          <Button type="submit" size="lg">
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              t("organization.templates.create.saveTemplate")
            )}
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6">
        {/* Template Header */}
        <div className="mx-auto mb-8 max-w-7xl rounded-2xl border bg-card p-6">
          <div className="flex gap-5">
            <div className="h-20 w-20 shrink-0 overflow-hidden">
              <div className="flex items-center gap-4">
                {logoFile ? (
                  <div className="relative h-20 w-20">
                    <img
                      src={logoPreviewUrl ?? undefined}
                      alt={t("organization.templates.create.logoAlt")}
                      className="h-20 w-20 rounded-xl border object-cover"
                    />

                    {/* remove button */}
                    <button
                      type="button"
                      aria-label={t("organization.templates.create.removeLogo")}
                      onClick={() => {
                        setLogoFile(null)
                        setLogoPreviewUrl(null)
                      }}
                      className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-xl border bg-muted hover:bg-muted/70">
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
                          setLogoPreviewUrl(URL.createObjectURL(file))
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
                      className="w-full rounded-md border border-border bg-transparent p-2 text-2xl font-semibold text-foreground focus:ring-0"
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
                    className="resize-none border border-border bg-transparent text-muted-foreground focus:ring-0"
                  />
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
                id: pageField.id,
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
                <div key={pageField.id} ref={registerSection(pIdx)}>
                  <PageSection
                    pageIndex={pIdx}
                    control={control}
                    removePage={removePage}
                    totalPages={pageFields.length}
                    onOpenAddModal={(pi) => setAddModalTarget(pi)}
                    onOpenAnswerPanel={(pi, qi) =>
                      setAnswerPanel({ pageIndex: pi, questionIndex: qi })
                    }
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

      {/* Add New Modal */}
      {addModalTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            ref={addModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-new-modal-title"
            className="w-80 overflow-hidden rounded-2xl bg-card shadow-2xl"
          >
            <div className="bg-primary px-5 py-4 text-white">
              <h3 id="add-new-modal-title" className="font-semibold">
                {t("organization.templates.create.addNew")}
              </h3>
            </div>
            <div className="divide-y divide-border">
              <button
                type="button"
                onClick={handleAddQuestion}
                className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-secondary"
              >
                <Plus className="text-primary" />
                <span className="font-medium">
                  {t("organization.templates.create.createQuestion")}
                </span>
              </button>
              <button
                type="button"
                onClick={handleAddSection}
                className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-secondary"
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

      {/* QnA Settings Panel */}
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

export default CreateTemplatePage
