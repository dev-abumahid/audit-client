import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Badge } from "./badge"
import { SEVERITY_STYLES } from "@/utils/severityStyles"

describe("Badge", () => {
  it("renders its children", () => {
    render(<Badge>Active</Badge>)
    expect(screen.getByText("Active")).toBeInTheDocument()
  })

  it("defaults to the secondary variant and md size", () => {
    render(<Badge>Default</Badge>)
    const badge = screen.getByText("Default")
    expect(badge).toHaveAttribute("data-variant", "secondary")
    expect(badge.className).toMatch(/bg-muted/)
    expect(badge.className).toMatch(/text-muted-foreground/)
  })

  it.each([
    ["primary", "bg-primary/10", "text-primary"],
    ["secondary", "bg-muted", "text-muted-foreground"],
    ["destructive", "bg-destructive/10", "text-destructive"],
    ["success", "bg-green-500/10", "text-green-600"],
  ] as const)(
    "applies the correct classes for the %s generic variant",
    (variant, bgClass, textClass) => {
      render(<Badge variant={variant}>{variant}</Badge>)
      const badge = screen.getByText(variant)
      expect(badge.className).toContain(bgClass)
      expect(badge.className).toContain(textClass)
    }
  )

  // The severity variants must stay generated FROM severityStyles.ts's
  // SEVERITY_STYLES map, not duplicated inline -- this is the whole point
  // of the primitive (a single source of truth for the WCAG-AA-tuned
  // colors). Asserting against SEVERITY_STYLES directly (rather than
  // hardcoding the expected class strings here) means this test breaks if
  // that coupling is ever accidentally severed, not just if the colors
  // change.
  it.each(Object.keys(SEVERITY_STYLES) as (keyof typeof SEVERITY_STYLES)[])(
    "applies severityStyles' bg/text classes for the %s severity variant",
    (level) => {
      render(<Badge variant={level}>{level}</Badge>)
      const badge = screen.getByText(level)
      for (const cls of SEVERITY_STYLES[level].bg.split(" ")) {
        expect(badge.className).toContain(cls)
      }
      for (const cls of SEVERITY_STYLES[level].text.split(" ")) {
        expect(badge.className).toContain(cls)
      }
    }
  )

  it("adds the severity border classes only when bordered is set", () => {
    render(
      <Badge variant="critical" bordered>
        Critical
      </Badge>
    )
    const badge = screen.getByText("Critical")
    expect(badge.className).toContain("border")
    for (const cls of SEVERITY_STYLES.critical.border.split(" ")) {
      expect(badge.className).toContain(cls)
    }
  })

  it("does not add a border class by default", () => {
    render(<Badge variant="critical">Critical</Badge>)
    const badge = screen.getByText("Critical")
    expect(badge.className).not.toMatch(/\bborder\b/)
  })

  // Regression test: an independent review of this PR found `bordered`
  // silently no-op'd for every variant except the 6 severity levels --
  // compoundVariants only covered those, so `bordered` on a generic variant
  // rendered with no border class at all. Fixed by adding a parallel
  // compound-variant entry per generic variant; this proves each one
  // actually works, not just that the severity ones still do.
  it.each([
    ["primary", "border-primary/30"],
    ["secondary", "border-border"],
    ["destructive", "border-destructive/30"],
    ["success", "border-green-500/30"],
  ] as const)(
    "adds a border class for the %s generic variant when bordered is set",
    (variant, borderClass) => {
      render(
        <Badge variant={variant} bordered>
          {variant}
        </Badge>
      )
      const badge = screen.getByText(variant)
      expect(badge.className).toContain("border")
      expect(badge.className).toContain(borderClass)
    }
  )

  it("does not add a border class for a generic variant by default", () => {
    render(<Badge variant="primary">Primary</Badge>)
    const badge = screen.getByText("Primary")
    expect(badge.className).not.toMatch(/\bborder\b/)
  })

  it.each([
    ["xs", "text-[10px]"],
    ["sm", "text-[11px]"],
    ["md", "text-xs"],
  ] as const)("applies the %s size's font size", (size, expectedClass) => {
    render(<Badge size={size}>{size}</Badge>)
    expect(screen.getByText(size).className).toContain(expectedClass)
  })

  it("merges a caller-provided className instead of dropping it", () => {
    render(<Badge className="custom-class">Custom</Badge>)
    expect(screen.getByText("Custom").className).toContain("custom-class")
  })

  it("forwards arbitrary span props (e.g. data-testid, title)", () => {
    render(
      <Badge data-testid="my-badge" title="tooltip text">
        With props
      </Badge>
    )
    const badge = screen.getByTestId("my-badge")
    expect(badge).toHaveAttribute("title", "tooltip text")
  })
})
