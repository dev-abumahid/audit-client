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
