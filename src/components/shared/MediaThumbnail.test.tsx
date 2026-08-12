/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import MediaThumbnail from "./MediaThumbnail"

// Real t() implementations aren't initialized in this test environment;
// echoing the key back (same convention used throughout this feature's
// other test files) is enough to assert the right string was passed.
const t = ((key: string) => key) as any

describe("MediaThumbnail", () => {
  it("renders a video/mp4 URL as a <video>, not an <img>, in answer variant", () => {
    const { container } = render(
      <MediaThumbnail
        url="https://cdn.example.com/clip.mp4"
        variant="answer"
        onDelete={vi.fn()}
        deleteLabel="Delete media"
        t={t}
      />
    )

    expect(container.querySelector("video source")).toHaveAttribute(
      "src",
      "https://cdn.example.com/clip.mp4"
    )
    expect(container.querySelector("img")).not.toBeInTheDocument()
  })

  it("renders a video/mp4 URL as a <video>, not an <img>, in thumbnail variant", () => {
    const { container } = render(
      <MediaThumbnail
        url="https://cdn.example.com/clip.mp4"
        variant="thumbnail"
        onDelete={vi.fn()}
        deleteLabel="Remove"
        t={t}
      />
    )

    expect(container.querySelector("video source")).toHaveAttribute(
      "src",
      "https://cdn.example.com/clip.mp4"
    )
    expect(container.querySelector("img")).not.toBeInTheDocument()
  })

  it("renders a PDF URL as a document link with the real filename, in answer variant", () => {
    render(
      <MediaThumbnail
        url="https://cdn.example.com/inspection-report.pdf"
        variant="answer"
        onDelete={vi.fn()}
        deleteLabel="Delete media"
        t={t}
      />
    )

    const link = screen.getByRole("link", {
      name: /inspection-report\.pdf/,
    })
    expect(link).toHaveAttribute("href", "https://cdn.example.com/inspection-report.pdf")
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("renders a plain image URL as an <img>", () => {
    render(
      <MediaThumbnail
        url="https://cdn.example.com/photo.jpg"
        variant="answer"
        onDelete={vi.fn()}
        deleteLabel="Delete media"
        t={t}
      />
    )

    expect(screen.getByAltText("organization.inspection.uploadedMediaAlt")).toHaveAttribute(
      "src",
      "https://cdn.example.com/photo.jpg"
    )
  })

  // quality-bar-loop (Inspections, round 3, security finding): the guard
  // this component ports from all four original copies.
  it("refuses to render a non-http(s) URL in any sink, for either variant", () => {
    const { container: answerContainer } = render(
      <MediaThumbnail
        url="javascript:alert(1)"
        variant="answer"
        onDelete={vi.fn()}
        deleteLabel="Delete media"
        t={t}
      />
    )
    expect(
      screen.getByText("organization.inspection.unsafeAttachment")
    ).toBeInTheDocument()
    expect(answerContainer.querySelector("img,video,a")).not.toBeInTheDocument()

    const { container: thumbContainer } = render(
      <MediaThumbnail
        url="data:text/html,<script>alert(1)</script>"
        variant="thumbnail"
        onDelete={vi.fn()}
        deleteLabel="Remove"
        t={t}
      />
    )
    expect(thumbContainer.querySelector("img,video,a")).not.toBeInTheDocument()
  })

  // Found by round-45 PR review: an early return for both variants on an
  // unsafe URL would have silently dropped a real capability the original
  // thumbnail copy had -- its remove button rendered unconditionally,
  // *outside* the isHttpUrl guard, so a legacy unsafe mediaFiles entry
  // could still be removed via the UI. The single-answer variant never had
  // a button in this case (nothing to delete but the whole answer,
  // handled elsewhere), so this is deliberately variant-specific, not a
  // blanket "always show the button" rule.
  it("still shows a working delete button for an unsafe URL in thumbnail variant, but not in answer variant", async () => {
    const onDeleteThumbnail = vi.fn()
    render(
      <MediaThumbnail
        url="javascript:alert(1)"
        variant="thumbnail"
        onDelete={onDeleteThumbnail}
        deleteLabel="Remove"
        t={t}
      />
    )
    await userEvent.click(screen.getByRole("button", { name: "Remove" }))
    expect(onDeleteThumbnail).toHaveBeenCalledTimes(1)

    render(
      <MediaThumbnail
        url="javascript:alert(1)"
        variant="answer"
        onDelete={vi.fn()}
        deleteLabel="Delete media"
        t={t}
      />
    )
    expect(
      screen.queryByRole("button", { name: "Delete media" })
    ).not.toBeInTheDocument()
  })

  // fileType()'s fallback kind for an unrecognized extension -- code-path
  // identical to "document" (same link+icon treatment), but not previously
  // exercised directly against MediaThumbnail.
  it("renders an unrecognized extension the same way as a document (fileType's \"file\" fallback)", () => {
    render(
      <MediaThumbnail
        url="https://cdn.example.com/dataset.xyz"
        variant="answer"
        onDelete={vi.fn()}
        deleteLabel="Delete media"
        t={t}
      />
    )

    const link = screen.getByRole("link", { name: /dataset\.xyz/ })
    expect(link).toHaveAttribute("href", "https://cdn.example.com/dataset.xyz")
  })

  it("calls onDelete when the delete/remove button is clicked", async () => {
    const onDelete = vi.fn()
    render(
      <MediaThumbnail
        url="https://cdn.example.com/photo.jpg"
        variant="answer"
        onDelete={onDelete}
        deleteLabel="Delete media"
        t={t}
      />
    )

    await userEvent.click(screen.getByRole("button", { name: "Delete media" }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  // The three original call sites (plus one duplicate) used different
  // translation keys for the same conceptual action -- deleteMedia for
  // both single-answer previews, but removeMedia in
  // CreateNewInspection.tsx's thumbnail vs. plain remove in
  // UpdateInspection.tsx's. `deleteLabel` is caller-resolved rather than
  // computed internally specifically so this extraction can't silently
  // collapse those three distinct copy strings into one.
  it("renders whatever deleteLabel the caller resolves, without recomputing it internally", () => {
    const { rerender } = render(
      <MediaThumbnail
        url="https://cdn.example.com/photo.jpg"
        variant="thumbnail"
        onDelete={vi.fn()}
        deleteLabel="Remove attachment 2"
        t={t}
      />
    )
    expect(
      screen.getByRole("button", { name: "Remove attachment 2" })
    ).toBeInTheDocument()

    rerender(
      <MediaThumbnail
        url="https://cdn.example.com/photo.jpg"
        variant="thumbnail"
        onDelete={vi.fn()}
        deleteLabel="Remove"
        t={t}
      />
    )
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument()
  })
})
