import { attachmentFileName } from "@/utils/attachmentFileName"
import { fileType } from "@/utils/fileType"
import { isHttpUrl } from "@/utils/isHttpUrl"
import { PLACEHOLDER_IMAGE_SRC } from "@/utils/placeholderImage"
import type { TFunction } from "i18next"
import { FileText, Trash } from "lucide-react"

// quality-bar-loop (Inspections, round 45, code-quality finding): this
// video/document/image branch was independently copy-pasted across
// CreateNewInspection.tsx and UpdateInspection.tsx, twice each (once for
// a question's single-answer media preview, once for its mediaFiles
// thumbnail strip) -- four near-identical copies of the same rendering
// logic, first flagged for extraction in round 41's PR review and made
// worse by round 43 porting a fourth copy rather than extracting. `variant`
// captures the one real layout difference between the two call sites
// (a large single-answer preview vs. a small thumbnail); everything else
// -- guard order, delete-button treatment, per-kind branching -- is
// otherwise byte-identical across all four original copies.
interface MediaThumbnailProps {
  url: string
  variant: "answer" | "thumbnail"
  onDelete: () => void
  // Caller-resolved accessible name for the delete/remove button, not
  // computed internally -- the four original copies used three different
  // translation keys for this (deleteMedia in both single-answer cases,
  // but removeMedia in CreateNewInspection.tsx's thumbnail vs. plain
  // remove in UpdateInspection.tsx's), a genuine pre-existing copy
  // difference this extraction must not silently collapse.
  deleteLabel: string
  t: TFunction
}

export default function MediaThumbnail({
  url,
  variant,
  onDelete,
  deleteLabel,
  t,
}: MediaThumbnailProps) {
  // quality-bar-loop (Inspections, round 3, security finding): `url` may be
  // client-supplied (a stored answer/mediaFile saved before the backend's
  // URL-scheme validation existed) -- guard every render sink the same way
  // InspectionReport.tsx does, before it ever reaches <source src>/<a href>/
  // <img src>.
  //
  // Found by round-45 PR review: the two original variants disagreed on
  // whether the delete button survives an unsafe URL -- the single-answer
  // case never showed one (nothing to delete but the whole answer, handled
  // elsewhere), but the thumbnail case rendered its remove button
  // unconditionally, *outside* this guard, so a legacy unsafe mediaFiles
  // entry could still be removed from the UI. An early return for both
  // variants would have silently dropped that for the thumbnail case --
  // preserved by branching on `variant` before the isHttpUrl check instead
  // of returning early for both.
  if (!isHttpUrl(url)) {
    if (variant === "answer") {
      return (
        <p className="text-sm text-muted-foreground italic">
          {t("organization.inspection.unsafeAttachment")}
        </p>
      )
    }
    return (
      <div className="relative">
        {/* quality-bar-loop (Inspections, round 60, mobile/visual-polish
            finding, open since round 45): this thumbnail-variant delete
            button was `p-1` around a `size-4` icon -- an effective ~24px
            touch target, well under the 44px guideline this same file's
            "answer"-variant delete buttons already meet below. The
            thumbnails render in a `gap-5` (20px) flex row, so a larger
            button anchored at the corner has room without overlapping a
            sibling thumbnail. */}
        <button
          type="button"
          onClick={onDelete}
          aria-label={deleteLabel}
          className="absolute -top-3 -right-3 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
        >
          <Trash className="size-4" />
        </button>
        <div className="flex h-12 w-12 items-center justify-center rounded border bg-muted text-[10px] text-muted-foreground">
          {t("organization.inspection.unsafeAttachment")}
        </div>
      </div>
    )
  }

  const mediaKind = fileType(url)

  if (variant === "thumbnail") {
    return (
      <div className="relative">
        {/* quality-bar-loop (Inspections, round 60, mobile/visual-polish
            finding, open since round 45): this thumbnail-variant delete
            button was `p-1` around a `size-4` icon -- an effective ~24px
            touch target, well under the 44px guideline this same file's
            "answer"-variant delete buttons already meet below. The
            thumbnails render in a `gap-5` (20px) flex row, so a larger
            button anchored at the corner has room without overlapping a
            sibling thumbnail. */}
        <button
          type="button"
          onClick={onDelete}
          aria-label={deleteLabel}
          className="absolute -top-3 -right-3 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
        >
          <Trash className="size-4" />
        </button>
        {mediaKind === "video" ? (
          <video controls className="h-12 w-12 rounded object-cover">
            <source src={url} />
            {t("organization.inspection.videoUnsupported")}
          </video>
        ) : mediaKind === "document" || mediaKind === "file" ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 w-12 items-center justify-center rounded border bg-muted"
          >
            <FileText className="size-5 text-muted-foreground" />
          </a>
        ) : (
          <img
            className="h-12 w-12"
            src={url}
            alt={t("organization.inspection.uploadedMediaAlt")}
            onError={(e) => {
              ;(e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE_SRC
            }}
          />
        )}
      </div>
    )
  }

  if (mediaKind === "video") {
    return (
      <div className="relative flex w-full items-center justify-center overflow-hidden rounded-lg border p-2">
        <video controls className="max-h-96 max-w-full rounded">
          <source src={url} />
          {t("organization.inspection.videoUnsupported")}
        </video>
        <button
          type="button"
          onClick={onDelete}
          aria-label={deleteLabel}
          className="absolute top-1 right-1 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
        >
          <Trash className="size-5" />
        </button>
      </div>
    )
  }

  if (mediaKind === "document" || mediaKind === "file") {
    return (
      <div className="relative flex w-full items-center justify-center overflow-hidden rounded-lg border">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-2 px-8 py-10 text-center text-muted-foreground transition-colors hover:text-foreground"
        >
          <FileText className="h-10 w-10" />
          <span className="max-w-60 truncate text-sm font-medium text-foreground">
            {attachmentFileName(url)}
          </span>
          <span className="text-xs">
            {t("organization.inspection.openDocument")}
          </span>
        </a>
        <button
          type="button"
          onClick={onDelete}
          aria-label={deleteLabel}
          className="absolute top-1 right-1 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
        >
          <Trash className="size-5" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative inline-block overflow-hidden rounded-lg border">
      <img
        src={url}
        alt={t("organization.inspection.uploadedMediaAlt")}
        className="max-h-96 max-w-full object-contain"
        onError={(e) => {
          ;(e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE_SRC
        }}
      />
      <button
        type="button"
        onClick={onDelete}
        aria-label={deleteLabel}
        className="absolute top-1 right-1 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
      >
        <Trash className="size-5" />
      </button>
    </div>
  )
}
