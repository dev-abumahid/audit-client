import type { QuestionAnswer, QuestionDef } from "@/types/inspection"
import { useTranslation } from "react-i18next"

interface Props {
  question: QuestionDef
  answer: QuestionAnswer | undefined
  onChange: (qaId: string, answer: unknown, note?: string) => void
  disabled?: boolean
}

export function QuestionInput({ question, answer, onChange, disabled }: Props) {
  const { t } = useTranslation()
  const current = answer?.answer
  const qaId = answer?.id ?? ""

  function emit(value: unknown) {
    if (qaId) onChange(qaId, value)
  }

  const type = question.answerType?.toUpperCase() ?? "TEXT"

  if (type === "CHECKBOX" || type === "MULTI_CHOICE") {
    const options = Array.isArray(question.value)
      ? (question.value as string[])
      : []
    const selected: string[] = Array.isArray(current)
      ? (current as string[])
      : []

    return (
      <div className="flex flex-col gap-2">
        {options.map((opt) => (
          <label key={opt} className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              disabled={disabled}
              checked={selected.includes(opt)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...selected, opt]
                  : selected.filter((s) => s !== opt)
                emit(next)
              }}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm text-foreground">{opt}</span>
          </label>
        ))}
      </div>
    )
  }

  if (type === "RADIO" || type === "SINGLE_CHOICE") {
    const options = Array.isArray(question.value)
      ? (question.value as string[])
      : []

    return (
      <div className="flex flex-col gap-2">
        {options.map((opt) => (
          <label key={opt} className="flex cursor-pointer items-center gap-2.5">
            <input
              type="radio"
              disabled={disabled}
              checked={current === opt}
              onChange={() => emit(opt)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-sm text-foreground">{opt}</span>
          </label>
        ))}
      </div>
    )
  }

  if (type === "RATING" || type === "SCALE" || type === "SLIDER") {
    const cfg = (question.value as { min?: number; max?: number } | null) ?? {}
    const min = cfg.min ?? 1
    const max = cfg.max ?? 10
    const val = typeof current === "number" ? current : min

    return (
      <div className="flex items-center gap-3">
        <span className="w-6 text-right text-xs text-muted-foreground">
          {min}
        </span>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={val}
          disabled={disabled}
          onChange={(e) => emit(Number(e.target.value))}
          className="flex-1"
        />
        <span className="w-6 text-xs text-muted-foreground">{max}</span>
        <span className="w-8 text-right text-sm font-medium text-foreground">
          {val}
        </span>
      </div>
    )
  }

  if (type === "DATE") {
    const dateVal = typeof current === "string" ? current.slice(0, 10) : ""
    return (
      <input
        type="date"
        disabled={disabled}
        defaultValue={dateVal}
        onBlur={(e) => emit(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
      />
    )
  }

  if (type === "PARAGRAPH" || type === "TEXTAREA") {
    return (
      <textarea
        disabled={disabled}
        defaultValue={typeof current === "string" ? current : ""}
        onBlur={(e) => emit(e.target.value)}
        rows={4}
        placeholder={t("pages.inspection.questionInput.placeholder")}
        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
      />
    )
  }

  // Default: TEXT
  return (
    <input
      type="text"
      disabled={disabled}
      defaultValue={typeof current === "string" ? current : ""}
      onBlur={(e) => emit(e.target.value)}
      placeholder={t("pages.inspection.questionInput.placeholder")}
      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
    />
  )
}
