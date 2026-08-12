// Round 13 (#507): extracted from FindingDetails.tsx's local `fileType`
// helper (originally written for attachment previews) since UpdateInspection
// .tsx and InspectionReport.tsx's media renderers need the exact same
// image/video/document discrimination to stop unconditionally rendering
// `<img>` for video and PDF uploads. Shared here instead of copied a third
// time.
export type FileKind = "image" | "video" | "document" | "file"

export const fileType = (url: string): FileKind => {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? ""
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "tiff"].includes(ext))
    return "image"
  if (["mp4", "mov", "avi", "mkv", "webm", "wmv"].includes(ext)) return "video"
  if (["pdf", "doc", "docx", "txt", "rtf"].includes(ext)) return "document"
  return "file"
}

// quality-bar-loop (Inspections, round 45, code-quality finding): extracted
// from CreateNewInspection.tsx's/UpdateInspection.tsx's handleExternalMediaUpload,
// where this exact ternary was independently copy-pasted twice -- the same
// "copied a third time" pattern fileType() above was already extracted to
// avoid, just for a File's MIME type instead of a stored URL's extension.
// Deliberately narrower than FileKind (never returns "file"): the upload
// handlers this backs only ever tag a freshly-uploaded file as one of these
// three, matching the original inline ternary's fallthrough-to-"image"
// behavior exactly (not a new discrimination, just relocated).
export const getMediaKindFromMime = (
  mimeType: string
): "video" | "document" | "image" =>
  mimeType.startsWith("video/")
    ? "video"
    : mimeType === "application/pdf"
      ? "document"
      : "image"
