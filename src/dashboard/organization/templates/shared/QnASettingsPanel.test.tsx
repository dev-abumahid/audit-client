import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import QnASettingsPanel from "./QnASettingsPanel"

// Regression (issue #429): the default response-set chip labels
// (good/poor/fair/n-a/pass/fail/yes/no), the new-response-set seed text,
// and the chip render itself were plain English string literals never
// passed through t(). They're now routed through i18n keys under
// organization.templates.qna.options / organization.templates.qna.newOptionSeed.
// The uninitialized test i18n instance echoes the raw key back (see
// SectionNavigator.test.tsx), which is enough to prove t() is actually
// being called for these strings; real translation resolution is covered
// by src/i18n/pluralization.test.ts.
// aexa-frontend#468: the close button, the per-response-set edit (pencil)
// button, and each option's delete (Trash2) button in edit mode were
// icon-only with no aria-label / accessible name.
describe("QnASettingsPanel accessible names (#468)", () => {
  it("gives the panel close button an accessible name", () => {
    render(
      <QnASettingsPanel
        onClose={vi.fn()}
        onSelectInput={vi.fn()}
        onSelectResponseSet={vi.fn()}
      />
    )

    expect(
      screen.getByRole("button", {
        name: "organization.templates.qna.closePanel",
      })
    ).toBeInTheDocument()
  })

  it("gives each response set's edit (pencil) button an accessible name", () => {
    render(
      <QnASettingsPanel
        onClose={vi.fn()}
        onSelectInput={vi.fn()}
        onSelectResponseSet={vi.fn()}
      />
    )

    expect(
      screen.getAllByRole("button", {
        name: "organization.templates.qna.editResponseSet",
      }).length
    ).toBeGreaterThan(0)
  })

  it("gives each option's delete button an accessible name in edit mode", async () => {
    render(
      <QnASettingsPanel
        onClose={vi.fn()}
        onSelectInput={vi.fn()}
        onSelectResponseSet={vi.fn()}
      />
    )

    await userEvent.click(
      screen.getAllByRole("button", {
        name: "organization.templates.qna.editResponseSet",
      })[0]
    )

    expect(
      screen.getAllByRole("button", {
        name: "organization.templates.qna.removeOption",
      }).length
    ).toBeGreaterThan(0)
  })
})

// Round 14 (#516) -- each option row rendered a GripVertical "drag handle"
// icon with zero drag-and-drop wiring (no dnd-kit, no onDragEnd), unlike
// the real question rows elsewhere in this codebase where the same icon is
// a working useSortable handle. Reordering options by drag isn't wired up
// anywhere in this component (no DndContext/SortableContext), so the
// misleading, non-functional icon was removed rather than fully
// implementing drag-and-drop for options (documented in the PR body).
describe("QnASettingsPanel option rows have no misleading drag handle (#516)", () => {
  it("does not render a decorative grip/drag-handle icon on option rows in edit mode", async () => {
    render(
      <QnASettingsPanel
        onClose={vi.fn()}
        onSelectInput={vi.fn()}
        onSelectResponseSet={vi.fn()}
      />
    )

    await userEvent.click(
      screen.getAllByRole("button", {
        name: "organization.templates.qna.editResponseSet",
      })[0]
    )

    expect(
      document.querySelector("svg.lucide-grip-vertical")
    ).not.toBeInTheDocument()
  })
})

// aexa-frontend#499 -- the backdrop + side panel is functionally a modal
// (blocks interaction with the rest of the page) but had no role="dialog",
// no aria-modal, no focus trap, and no Escape-to-close. Migrated onto the
// same useModalA11y hook KriDashboardPage's modals use under #490 --
// same pattern KriDashboardPage.test.tsx asserts for its own modals.
describe("QnASettingsPanel modal accessibility (#499)", () => {
  it("marks the panel as a labeled dialog and closes it on Escape", async () => {
    const onClose = vi.fn()
    render(
      <QnASettingsPanel
        onClose={onClose}
        onSelectInput={vi.fn()}
        onSelectResponseSet={vi.fn()}
      />
    )

    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(dialog).toHaveAccessibleName("organization.templates.qna.title")

    await userEvent.keyboard("{Escape}")
    expect(onClose).toHaveBeenCalled()
  })

  it("traps Tab focus inside the panel", async () => {
    render(
      <QnASettingsPanel
        onClose={vi.fn()}
        onSelectInput={vi.fn()}
        onSelectResponseSet={vi.fn()}
      />
    )

    const dialog = screen.getByRole("dialog")
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    expect(focusable.length).toBeGreaterThan(0)
    expect(focusable[0]).toHaveFocus()
  })
})

describe("QnASettingsPanel (issue #429)", () => {
  it("renders default response-set chip labels through i18n keys, not raw English text", () => {
    render(
      <QnASettingsPanel
        onClose={vi.fn()}
        onSelectInput={vi.fn()}
        onSelectResponseSet={vi.fn()}
      />
    )

    expect(
      screen.getByText("organization.templates.qna.options.good")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.templates.qna.options.poor")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.templates.qna.options.fair")
    ).toBeInTheDocument()
    expect(
      screen.getAllByText("organization.templates.qna.options.na").length
    ).toBeGreaterThan(0)
    expect(
      screen.getByText("organization.templates.qna.options.pass")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.templates.qna.options.fail")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.templates.qna.options.yes")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.templates.qna.options.no")
    ).toBeInTheDocument()

    // None of the raw English default labels should leak through directly.
    expect(screen.queryByText("good")).not.toBeInTheDocument()
    expect(screen.queryByText("poor")).not.toBeInTheDocument()
  })

  it("seeds a newly added response set's options through the newOptionSeed i18n key", async () => {
    render(
      <QnASettingsPanel
        onClose={vi.fn()}
        onSelectInput={vi.fn()}
        onSelectResponseSet={vi.fn()}
      />
    )

    await userEvent.click(
      screen.getByText("organization.templates.qna.addResponseSet")
    )

    // Newly added set opens directly in edit mode; its seeded option text
    // shows up in the editable inputs.
    const inputs = screen.getAllByDisplayValue(
      "organization.templates.qna.newOptionSeed"
    )
    expect(inputs.length).toBe(2)
  })

  it("still allows typing arbitrary custom text for a new option, unaffected by default-label translation", async () => {
    render(
      <QnASettingsPanel
        onClose={vi.fn()}
        onSelectInput={vi.fn()}
        onSelectResponseSet={vi.fn()}
      />
    )

    await userEvent.click(
      screen.getByText("organization.templates.qna.addResponseSet")
    )

    const inputs = screen.getAllByDisplayValue(
      "organization.templates.qna.newOptionSeed"
    )
    await userEvent.clear(inputs[0])
    await userEvent.type(inputs[0], "Excellent")

    expect(screen.getByDisplayValue("Excellent")).toBeInTheDocument()
  })

  // Regression (review finding on issue #429): translation must be gated on
  // provenance (opt.isDefault), not on matching the option's text against
  // the canonical default word list. Otherwise a user who happens to type
  // one of the 8 canonical words ("Yes", "No", "N/A", ...) as their own
  // custom option text would have it silently swapped for a translated
  // label they never opted into.
  it("does not translate a custom option whose typed text happens to collide with a canonical default word", async () => {
    render(
      <QnASettingsPanel
        onClose={vi.fn()}
        onSelectInput={vi.fn()}
        onSelectResponseSet={vi.fn()}
      />
    )

    // A newly added response set's options are user-authored (isDefault
    // false), even though the seed placeholder text isn't a canonical word.
    await userEvent.click(
      screen.getByText("organization.templates.qna.addResponseSet")
    )
    const seedInputs = screen.getAllByDisplayValue(
      "organization.templates.qna.newOptionSeed"
    )
    await userEvent.clear(seedInputs[0])
    await userEvent.type(seedInputs[0], "Yes")
    await userEvent.click(
      screen.getByText("organization.templates.edit.saveChanges")
    )

    // Outside edit mode, the new chip must render exactly what the user
    // typed ("Yes", capitalized), not the translated
    // "organization.templates.qna.options.yes" key. Note the page also has
    // a genuinely-default "yes" chip from the pre-seeded response set 3
    // (lowercase, isDefault: true), which legitimately renders the
    // translated key literal via the test's echo-mock -- so this asserts
    // exactly one match for the translated key (that pre-existing default
    // chip), not zero, to prove the new chip isn't a second one.
    expect(screen.getByText("Yes")).toBeInTheDocument()
    expect(
      screen.getAllByText("organization.templates.qna.options.yes")
    ).toHaveLength(1)
  })

  // Regression (review finding on issue #429): editing a default option's
  // text must clear its isDefault flag, so retyping even the exact same
  // canonical word doesn't get re-translated -- proving translation is
  // keyed on provenance, not on a live string match.
  it("stops translating a default option once its text has been edited, even if retyped to match a canonical word", async () => {
    render(
      <QnASettingsPanel
        onClose={vi.fn()}
        onSelectInput={vi.fn()}
        onSelectResponseSet={vi.fn()}
      />
    )

    // Open the first default response set (good/poor/fair/n-a) for editing
    // via its pencil "edit" button -- the row's last button, right after
    // the chip buttons.
    const goodChip = screen.getByText(
      "organization.templates.qna.options.good"
    )
    const chipRow = goodChip.closest("div")?.parentElement
    const rowButtons = chipRow?.querySelectorAll("button")
    const editButton = rowButtons?.[rowButtons.length - 1] ?? null
    expect(editButton).toBeTruthy()
    await userEvent.click(editButton!)

    const goodInput = screen.getByDisplayValue(
      "organization.templates.qna.options.good"
    )
    await userEvent.clear(goodInput)
    await userEvent.type(goodInput, "good")
    await userEvent.click(
      screen.getByText("organization.templates.edit.saveChanges")
    )

    // Now shows the raw retyped text, not the translated key -- proving
    // the edit cleared isDefault rather than the translation being
    // re-triggered by the text happening to match "good" again.
    expect(screen.getByText("good")).toBeInTheDocument()
    expect(
      screen.queryByText("organization.templates.qna.options.good")
    ).not.toBeInTheDocument()
  })
})

// Regression (aexa-frontend#491): saveEdit() previously committed
// editOptions straight to state with zero validation -- a user could delete
// every option down to zero, or leave an option's text empty, and Save
// Changes would silently succeed either way.
describe("QnASettingsPanel edit validation (#491)", () => {
  async function openFirstSetForEdit() {
    render(
      <QnASettingsPanel
        onClose={vi.fn()}
        onSelectInput={vi.fn()}
        onSelectResponseSet={vi.fn()}
      />
    )

    await userEvent.click(
      screen.getAllByRole("button", {
        name: "organization.templates.qna.editResponseSet",
      })[0]
    )
  }

  it("disables Save Changes and shows an inline error once every option is deleted", async () => {
    await openFirstSetForEdit()

    const removeButtons = screen.getAllByRole("button", {
      name: "organization.templates.qna.removeOption",
    })
    for (const button of removeButtons) {
      await userEvent.click(button)
    }

    expect(
      screen.getByText("organization.templates.qna.noOptionsError")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.templates.edit.saveChanges")
    ).toBeDisabled()
  })

  it("disables Save Changes and shows an inline error when an option's text is cleared to empty", async () => {
    await openFirstSetForEdit()

    const goodInput = screen.getByDisplayValue(
      "organization.templates.qna.options.good"
    )
    await userEvent.clear(goodInput)

    expect(
      screen.getByText("organization.templates.qna.emptyOptionTextError")
    ).toBeInTheDocument()
    expect(
      screen.getByText("organization.templates.edit.saveChanges")
    ).toBeDisabled()
  })

  it("also treats whitespace-only option text as invalid", async () => {
    await openFirstSetForEdit()

    const goodInput = screen.getByDisplayValue(
      "organization.templates.qna.options.good"
    )
    await userEvent.clear(goodInput)
    await userEvent.type(goodInput, "   ")

    expect(
      screen.getByText("organization.templates.edit.saveChanges")
    ).toBeDisabled()
  })

  it("re-enables Save Changes and clears the error once the text is filled back in", async () => {
    await openFirstSetForEdit()

    const goodInput = screen.getByDisplayValue(
      "organization.templates.qna.options.good"
    )
    await userEvent.clear(goodInput)
    expect(
      screen.getByText("organization.templates.edit.saveChanges")
    ).toBeDisabled()

    await userEvent.type(goodInput, "excellent")

    expect(
      screen.queryByText("organization.templates.qna.emptyOptionTextError")
    ).not.toBeInTheDocument()
    expect(
      screen.getByText("organization.templates.edit.saveChanges")
    ).not.toBeDisabled()
  })

  it("does not commit an invalid edit when Save Changes is clicked while disabled", async () => {
    await openFirstSetForEdit()

    const removeButtons = screen.getAllByRole("button", {
      name: "organization.templates.qna.removeOption",
    })
    for (const button of removeButtons) {
      await userEvent.click(button)
    }

    await userEvent.click(
      screen.getByText("organization.templates.edit.saveChanges")
    )

    // Still in edit mode (Save Changes still rendered) -- the invalid edit
    // was not committed and the panel did not exit edit mode.
    expect(
      screen.getByText("organization.templates.edit.saveChanges")
    ).toBeInTheDocument()
  })
})

// Regression (aexa-frontend#485): QnASettingsPanel is rendered directly
// inside CreateTemplatePage's/EditTemplatePage's top-level
// <form onSubmit={...}>. The shared Button component renders a bare
// <button> with no default `type`, so any button here missing an explicit
// type="button" defaults to native type="submit" and would submit/save
// the whole template form instead of just performing its own action.
// This wraps the panel in a real <form> with a spy onSubmit -- exactly the
// real-world nesting -- and asserts every one of its four buttons leaves
// the form unsubmitted.
describe("QnASettingsPanel buttons do not submit an enclosing form (#485)", () => {
  function renderInForm(onSubmit: () => void) {
    return render(
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
      >
        <QnASettingsPanel
          onClose={vi.fn()}
          onSelectInput={vi.fn()}
          onSelectResponseSet={vi.fn()}
        />
      </form>
    )
  }

  it("does not submit the form when the footer Close button is clicked", async () => {
    const onSubmit = vi.fn()
    renderInForm(onSubmit)

    await userEvent.click(
      screen.getByRole("button", {
        name: "organization.templates.qna.closePanel",
      })
    )

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("does not submit the form when Add Response Set is clicked", async () => {
    const onSubmit = vi.fn()
    renderInForm(onSubmit)

    await userEvent.click(
      screen.getByText("organization.templates.qna.addResponseSet")
    )

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("does not submit the form when the inline edit Save Changes / Cancel buttons are clicked", async () => {
    const onSubmit = vi.fn()
    renderInForm(onSubmit)

    // Enter edit mode via the first response set's pencil edit button.
    const goodChip = screen.getByText(
      "organization.templates.qna.options.good"
    )
    const chipRow = goodChip.closest("div")?.parentElement
    const rowButtons = chipRow?.querySelectorAll("button")
    const editButton = rowButtons?.[rowButtons.length - 1] ?? null
    expect(editButton).toBeTruthy()
    await userEvent.click(editButton!)

    await userEvent.click(
      screen.getByText("organization.templates.edit.saveChanges")
    )
    expect(onSubmit).not.toHaveBeenCalled()

    await userEvent.click(editButton!)
    await userEvent.click(
      screen.getByText("organization.templates.create.cancel")
    )
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
