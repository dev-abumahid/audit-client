import { Button } from "@/components/ui/button"
import {
  Calendar,
  CheckSquare,
  GripVertical,
  Image,
  Plus,
  Sliders,
  Trash2,
  X,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

interface QnASettingsPanelProps {
  onClose: () => void
  onSelectInput: (type: string) => void
  onSelectResponseSet: (options: string[]) => void
}

const ANSWER_TYPES = [
  { value: "input", label: "Input", icon: CheckSquare },
  { value: "checkbox", label: "Check Box", icon: CheckSquare },
  { value: "date", label: "Date", icon: Calendar },
  { value: "media", label: "Media", icon: Image },
  { value: "slider", label: "Slider", icon: Sliders },
] as const

interface ResponseSet {
  id: number
  options: ResponseOption[]
}

interface ResponseOption {
  id: number
  text: string
  // True only for options seeded from DEFAULT_RESPONSE_SETS and never
  // edited by the user. Translation (see optionLabel below) is gated on
  // this flag rather than on matching `text` against a canonical word list,
  // so a user who types "Yes" or "N/A" as their own custom option text
  // never gets it silently swapped for a translated label. Editing a
  // default option's text clears this flag (see the edit input's onChange).
  isDefault?: boolean
}

const DEFAULT_RESPONSE_SETS: ResponseSet[] = [
  {
    id: 1,
    options: [
      { id: 1, text: "good", isDefault: true },
      { id: 2, text: "poor", isDefault: true },
      { id: 3, text: "fair", isDefault: true },
      { id: 4, text: "n/a", isDefault: true },
    ],
  },
  {
    id: 2,
    options: [
      { id: 1, text: "pass", isDefault: true },
      { id: 2, text: "fail", isDefault: true },
      { id: 3, text: "n/a", isDefault: true },
    ],
  },
  {
    id: 3,
    options: [
      { id: 1, text: "yes", isDefault: true },
      { id: 2, text: "no", isDefault: true },
      { id: 3, text: "n/a", isDefault: true },
    ],
  },
]

const OPTION_CHIP_COLORS: Record<string, string> = {
  good: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400",
  pass: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400",
  yes: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400",
  compliant:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400",
  poor: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-400",
  fail: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-400",
  no: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-400",
  "not-compliant":
    "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-400",
  fair: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-400",
  "n/a":
    "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400",
}

function chipColor(text: string) {
  return (
    OPTION_CHIP_COLORS[text.toLowerCase()] ??
    "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400"
  )
}

// Maps the canonical (English) default option text to its i18n key suffix.
// The underlying `text` stays in its canonical English form so chip colors
// and stored answer-set values remain stable across locales.
const DEFAULT_OPTION_LABEL_KEYS: Record<string, string> = {
  good: "good",
  poor: "poor",
  fair: "fair",
  "n/a": "na",
  pass: "pass",
  fail: "fail",
  yes: "yes",
  no: "no",
}

// Only translates text for options that came from DEFAULT_RESPONSE_SETS
// (opt.isDefault) and haven't been edited since. Gating on the isDefault
// flag -- rather than matching `opt.text` against the canonical word list
// -- means a user who types their own custom option "Yes" or "N/A" always
// sees exactly what they typed, never a translated label.
function optionLabel(t: (key: string) => string, opt: ResponseOption) {
  if (!opt.isDefault) return opt.text
  const key = DEFAULT_OPTION_LABEL_KEYS[opt.text.toLowerCase()]
  return key ? t(`organization.templates.qna.options.${key}`) : opt.text
}

function QnASettingsPanel({
  onClose,
  onSelectInput,
  onSelectResponseSet,
}: QnASettingsPanelProps) {
  const { t } = useTranslation()
  const [responseSets, setResponseSets] = useState<ResponseSet[]>(
    DEFAULT_RESPONSE_SETS
  )
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editOptions, setEditOptions] = useState<ResponseOption[]>([])

  const startEdit = (set: ResponseSet) => {
    setEditingId(set.id)
    setEditOptions([...set.options.map((o) => ({ ...o }))])
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditOptions([])
  }

  const saveEdit = () => {
    setResponseSets((prev) =>
      prev.map((s) => (s.id === editingId ? { ...s, options: editOptions } : s))
    )
    setEditingId(null)
  }

  const addNewResponseSet = () => {
    const newId = Math.max(...responseSets.map((s) => s.id), 0) + 1
    const newSet: ResponseSet = {
      id: newId,
      options: [
        { id: 1, text: t("organization.templates.qna.newOptionSeed", { number: 1 }) },
        { id: 2, text: t("organization.templates.qna.newOptionSeed", { number: 2 }) },
      ],
    }
    setResponseSets((prev) => [...prev, newSet])
    startEdit(newSet)
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 z-50 flex h-full w-full flex-col border-l border-border bg-card shadow-2xl sm:w-105">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">
            {t("organization.templates.qna.title")}
          </h2>
          <button
            type="button"
            aria-label={t("organization.templates.qna.closePanel")}
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors hover:bg-muted"
          >
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-8 overflow-y-auto p-5">
          {/* Multiple Choice Responses */}
          <div>
            <h3 className="mb-1 text-sm font-semibold text-foreground">
              {t("organization.templates.qna.multipleChoice")}
            </h3>
            <p className="mb-4 text-xs text-muted-foreground">
              {t("organization.templates.qna.multipleChoiceDesc")}
            </p>

            <div className="space-y-4">
              {responseSets.map((set, setIndex) => (
                <div key={set.id}>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-1 flex-wrap gap-1.5">
                      {set.options.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            onSelectResponseSet(set.options.map((o) => o.text))
                          }
                          className={`rounded-md border px-3 py-1 text-xs font-medium transition-all hover:opacity-90 ${chipColor(opt.text)}`}
                        >
                          {optionLabel(t, opt)}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      aria-label={t(
                        "organization.templates.qna.editResponseSet",
                        { number: setIndex + 1 }
                      )}
                      onClick={() => startEdit(set)}
                      className="rounded-lg p-2 transition-colors hover:bg-muted"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-muted-foreground"
                      >
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      </svg>
                    </button>
                  </div>

                  {/* Inline Edit Mode */}
                  {editingId === set.id && (
                    <div className="mt-3 space-y-3 rounded-xl border border-border bg-muted/50 p-4">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("organization.templates.qna.editOptions")}
                      </p>

                      {editOptions.map((opt, idx) => (
                        <div key={opt.id} className="flex items-center gap-2">
                          <GripVertical
                            size={16}
                            className="text-muted-foreground"
                          />
                          <input
                            type="text"
                            value={optionLabel(t, opt)}
                            onChange={(e) =>
                              setEditOptions((prev) =>
                                prev.map((o) =>
                                  o.id === opt.id
                                    ? {
                                        ...o,
                                        text: e.target.value,
                                        isDefault: false,
                                      }
                                    : o
                                )
                              )
                            }
                            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-green-500"
                            placeholder={t("organization.templates.qna.optionPlaceholder", {
                              number: idx + 1,
                            })}
                          />
                          <button
                            type="button"
                            aria-label={t(
                              "organization.templates.qna.removeOption",
                              { number: idx + 1 }
                            )}
                            onClick={() =>
                              setEditOptions((prev) =>
                                prev.filter((o) => o.id !== opt.id)
                              )
                            }
                            className="rounded-lg p-1.5 transition-colors hover:bg-destructive/10"
                          >
                            <Trash2 size={14} className="text-destructive" />
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => {
                          const newId =
                            Math.max(...editOptions.map((o) => o.id), 0) + 1
                          setEditOptions((prev) => [
                            ...prev,
                            { id: newId, text: "" },
                          ])
                        }}
                        className="mt-2 flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700"
                      >
                        <Plus size={14} /> {t("organization.templates.qna.addOption")}
                      </button>

                      <div className="flex gap-2 pt-2">
                        <Button size="sm" onClick={saveEdit}>
                          {t("organization.templates.edit.saveChanges")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={cancelEdit}
                        >
                          {t("organization.templates.create.cancel")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Button
              onClick={addNewResponseSet}
              variant="default"
              className="mt-6 w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("organization.templates.qna.addResponseSet")}
            </Button>
          </div>

          <div className="border-t border-border" />

          {/* Input Types */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              {t("organization.templates.qna.inputTypes")}
            </h3>
            <div className="space-y-1">
              {ANSWER_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => onSelectInput(type.value)}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition-colors hover:bg-accent"
                >
                  <type.icon size={18} className="text-muted-foreground" />
                  <span className="font-medium">
                    {t(`organization.templates.builder.answerTypes.${type.value}`, {
                      defaultValue: type.label,
                    })}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-muted/50 px-5 py-4">
          <Button onClick={onClose} className="w-full">
            {t("organization.templates.qna.close")}
          </Button>
        </div>
      </div>
    </>
  )
}

export default QnASettingsPanel
