import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useForm } from "react-hook-form"
import type { TemplateFormValues } from "@/types/template"
import { useAutoSave } from "./useAutoSave"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function baseValues(): TemplateFormValues {
  return {
    templateName: "Fire Safety Checklist",
    templateDisc: "",
    category: "",
    status: "DRAFT",
    pages: [],
  }
}

// EditTemplatePage.test.tsx's own "does not trigger a redundant full-form
// auto-save" test already found that react-hook-form's setValue() doesn't
// populate watch()'s `type` as "change" the way a real DOM input event
// does -- so useAutoSave's watch handler only ever fires from real
// registered-input events, not programmatic setValue calls. A real
// &lt;input {...register(...)}&gt; plus fireEvent.change is the only way to
// actually exercise that path.
function Harness({
  onSave,
  interval = 50,
}: {
  onSave: (data: TemplateFormValues) => Promise<void>
  interval?: number
}) {
  const form = useForm<TemplateFormValues>({ defaultValues: baseValues() })
  const { hasChanges } = useAutoSave({ form, onSave, interval })
  return (
    <div>
      <input
        aria-label="template name"
        {...form.register("templateName")}
      />
      <span data-testid="has-changes">{String(hasChanges)}</span>
    </div>
  )
}

describe("useAutoSave", () => {
  // quality-bar-loop round (Templates efficiency, fresh-panel finding):
  // the deep-equality "is this actually a no-op edit" check used to run on
  // every keystroke; it now runs once per attemptSave instead. This proves
  // the behavior it protects (skip a genuinely no-op save) still holds
  // after moving where the check runs.
  it("skips the save when the value is reverted back to the last-saved snapshot before the interval fires", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<Harness onSave={onSave} interval={50} />)
    const input = screen.getByLabelText("template name")

    fireEvent.change(input, {
      target: { value: "Fire Safety Checklist v2" },
    })
    fireEvent.change(input, { target: { value: "Fire Safety Checklist" } })

    // The equality check that decides "this is actually a no-op" now runs
    // at save time, not inline in the watch() handler -- hasChanges stays
    // true right after the revert (unlike the old per-keystroke check,
    // which would have already flipped it back to false here).
    expect(screen.getByTestId("has-changes")).toHaveTextContent("true")

    await new Promise((resolve) => setTimeout(resolve, 150))

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByTestId("has-changes")).toHaveTextContent("false")
  })

  it("saves a real change once the interval fires", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<Harness onSave={onSave} interval={50} />)
    const input = screen.getByLabelText("template name")

    fireEvent.change(input, {
      target: { value: "Fire Safety Checklist v2" },
    })

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0].templateName).toBe(
      "Fire Safety Checklist v2"
    )
  })

  // The watch() handler now flags dirty synchronously on any "change" event
  // rather than deep-comparing against the last-saved snapshot inline --
  // hasChanges should flip true immediately, not only after the interval.
  it("marks hasChanges true synchronously on a change event, before the interval fires", () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<Harness onSave={onSave} interval={50} />)
    const input = screen.getByLabelText("template name")

    expect(screen.getByTestId("has-changes")).toHaveTextContent("false")

    fireEvent.change(input, {
      target: { value: "Fire Safety Checklist v2" },
    })

    expect(screen.getByTestId("has-changes")).toHaveTextContent("true")
    expect(onSave).not.toHaveBeenCalled()
  })
})
