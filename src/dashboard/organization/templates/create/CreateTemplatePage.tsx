"use client"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useCreateNewTemplateMutation } from "@/redux/apis/organization/template.api"
import type {
  AnswerType,
  QuestionField,
  TemplateFormValues,
} from "@/types/template"
import { transformValuesToString } from "@/utils/transformValuesToString"
import { Loader2, Plus, Sliders, Upload, X } from "lucide-react"
import { useState } from "react"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { Link, useNavigate } from "react-router"
import { toast } from "sonner"
import PageSection from "./PageSection"
import QnASettingsPanel from "../shared/QnASettingsPanel"

let _idCounter = 0
const uid = () => `rhf-${++_idCounter}-${Math.random().toString(36).slice(2)}`

const CreateTemplatePage = () => {
  const [createNewTemplate, { isLoading }] = useCreateNewTemplateMutation()
  const navigate = useNavigate()
  const [addModalTarget, setAddModalTarget] = useState<number | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [answerPanel, setAnswerPanel] = useState<{
    pageIndex: number
    questionIndex: number
  } | null>(null)

  const { control, register, handleSubmit, getValues, setValue } =
    useForm<TemplateFormValues>({
      defaultValues: {
        templateName: "Untitled Template",
        templateDisc: "",
        pages: [
          {
            id: uid(),
            pageIndex: 0,
            title: "General Information",
            questions: [
              {
                id: uid(),
                index: 0,
                question: "Site Conducted",
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
      title: `New Section ${pageFields.length + 1}`,
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
    const res = await createNewTemplate(formData).unwrap()
    if (res?.success) {
      toast.success(res?.message)
      navigate("/organization/audit/templates")
    } else {
      toast.error(res?.message || "Failed to create template")
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
            <Link
              to="/organization/audit/templates"
              className="text-muted-foreground hover:text-foreground"
            >
              ← Back
            </Link>
          </div>

          <Button type="submit" size="lg">
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              "Save Template"
            )}
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Template Header */}
        <div className="mb-8 rounded-2xl border bg-card p-6">
          <div className="flex gap-5">
            <div className="h-20 w-20 shrink-0 overflow-hidden">
              <div className="flex items-center gap-4">
                {logoFile ? (
                  <div className="relative h-20 w-20">
                    <img
                      src={URL.createObjectURL(logoFile)}
                      className="h-20 w-20 rounded-xl border object-cover"
                    />

                    {/* remove button */}
                    <button
                      type="button"
                      onClick={() => setLogoFile(null)}
                      className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-xl border bg-muted hover:bg-muted/70">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="mt-1 text-xs text-muted-foreground">
                      Upload
                    </span>

                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) setLogoFile(file)
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
                render={({ field }) => (
                  <input
                    {...field}
                    className="w-full rounded-md border border-border bg-transparent p-2 text-2xl font-semibold text-foreground focus:ring-0"
                    placeholder="Template Name"
                  />
                )}
              />
              <Controller
                control={control}
                name="templateDisc"
                render={({ field }) => (
                  <Textarea
                    {...field}
                    rows={3}
                    placeholder="Add a description for this template..."
                    className="resize-none border border-border bg-transparent text-muted-foreground focus:ring-0"
                  />
                )}
              />
            </div>
          </div>
        </div>

        {/* Pages Section */}
        {pageFields.length === 0 ? (
          <div className="rounded-2xl border bg-card p-12 text-center">
            <p className="mb-6 text-muted-foreground">No sections yet.</p>
            <Button type="button" onClick={handleAddSection}>
              <Plus className="mr-2 h-4 w-4" /> Create First Section
            </Button>
          </div>
        ) : (
          pageFields.map((pageField, pIdx) => (
            <PageSection
              key={pageField.id}
              pageIndex={pIdx}
              control={control}
              register={register}
              removePage={removePage}
              totalPages={pageFields.length}
              onOpenAddModal={(pi) => setAddModalTarget(pi)}
              onOpenAnswerPanel={(pi, qi) =>
                setAnswerPanel({ pageIndex: pi, questionIndex: qi })
              }
              getValues={getValues}
              setValue={setValue}
            />
          ))
        )}

        {pageFields.length > 0 && (
          <div className="mt-10 flex justify-center">
            <Button
              type="button"
              onClick={handleAddSection}
              size="lg"
              variant="outline"
            >
              <Plus className="h-4 w-4" /> Add New Section
            </Button>
          </div>
        )}
      </div>

      {/* Add New Modal */}
      {addModalTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-80 overflow-hidden rounded-2xl bg-card shadow-2xl">
            <div className="bg-primary px-5 py-4 text-white">
              <h3 className="font-semibold">Add New</h3>
            </div>
            <div className="divide-y divide-border">
              <button
                type="button"
                onClick={handleAddQuestion}
                className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-secondary"
              >
                <Plus className="text-primary" />
                <span className="font-medium">Create Question</span>
              </button>
              <button
                type="button"
                onClick={handleAddSection}
                className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-secondary"
              >
                <Sliders className="text-primary" />
                <span className="font-medium">Create Section</span>
              </button>
            </div>
            <div className="border-t p-4">
              <Button
                variant="outline"
                onClick={() => setAddModalTarget(null)}
                className="w-full"
              >
                Cancel
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
