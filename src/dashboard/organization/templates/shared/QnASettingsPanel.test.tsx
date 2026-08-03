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
