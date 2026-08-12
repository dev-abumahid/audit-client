// quality-bar-loop (Inspections, round 16, code quality finding): this
// exact size limit + MIME allowlist was independently copy-pasted 4 times
// across CreateNewInspection.tsx (handleAnswerMediaUpload,
// handleExternalMediaUpload) and UpdateInspection.tsx (the same two
// handlers) -- currently identical, but with no shared source of truth
// nothing stops the four copies from silently drifting apart (e.g. one
// handler gaining a new allowed MIME type without the other three).
export const MAX_INSPECTION_FILE_SIZE_BYTES = 5 * 1024 * 1024

export const ALLOWED_INSPECTION_FILE_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  // Found by review of PR #719: aexa-server's upload allowlist (uploader.ts,
  // fixed under aexa-server#326) already accepts video/quicktime (.mov) and
  // video/webm alongside video/mp4 -- this list was missing both, so
  // UploadNotesModal.tsx's newly-added client-side validation (round 43)
  // would have rejected a .mov/.webm note-extraction file the backend
  // actually accepts, a real regression from the previously-unvalidated
  // (accept-anything) behavior.
  "video/quicktime",
  "video/webm",
  "application/pdf",
]

export type InspectionFileValidation =
  | { valid: true }
  | { valid: false; reason: "size" | "type" }

// Pure validation only -- callers keep their own toast copy (a generic
// message vs. one interpolating the file's name), which legitimately
// differs between the single-file and multi-file upload flows.
export function validateInspectionFile(file: File): InspectionFileValidation {
  if (file.size > MAX_INSPECTION_FILE_SIZE_BYTES) {
    return { valid: false, reason: "size" }
  }
  if (!ALLOWED_INSPECTION_FILE_TYPES.includes(file.type)) {
    return { valid: false, reason: "type" }
  }
  return { valid: true }
}
