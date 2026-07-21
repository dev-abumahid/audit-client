import { useSplitInspectionNoteMutation } from "@/redux/apis/organization/inspection.api"
import {
  useExtractNoteFromFileMutation,
  useGetNoteByInspectionIdQuery,
} from "@/redux/apis/organization/note.api"
import type { Note } from "@/types/note"
import {
  CheckCircle2,
  FileText,
  Loader2,
  Paperclip,
  UploadCloud,
  X,
} from "lucide-react"
import { useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"

// Not imported from a shared util: at time of writing this codebase has the
// same try/catch-wrapped decodeURIComponent helper duplicated across a
// couple of not-yet-merged branches (attachments features landing around
// the same time) — defining it locally here keeps this PR correct
// independent of which one merges first. Worth consolidating once both land.
const attachmentFileName = (url: string) => {
  try {
    return decodeURIComponent(url.split("/").pop() || "file")
  } catch {
    return url.split("/").pop() || "file"
  }
}

type Stage = "idle" | "uploading" | "extracting" | "done" | "error"

export default function InspectionNote() {
  const { id: inspectionId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [stage, setStage] = useState<Stage>("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [freshNote, setFreshNote] = useState<Note | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    data: noteResponse,
    isLoading: noteLoading,
    error: noteError,
  } = useGetNoteByInspectionIdQuery(inspectionId!, { skip: !inspectionId })

  // A 404 genuinely means "no note yet" (mirrors the old fetch's
  // catch-as-null behavior). Any other error (500, network failure, etc.)
  // is a real error and should be surfaced instead of silently falling back
  // to the upload-a-note empty state — mirrors the pattern in the sibling
  // InspectionRecommendations page.
  const noteNotFound =
    !noteLoading &&
    !!noteError &&
    typeof noteError === "object" &&
    "status" in noteError &&
    noteError.status === 404
  const noteLoadError =
    !noteLoading && !!noteError && !noteNotFound
      ? ((noteError as { data?: { message?: string } })?.data?.message ??
        "Failed to load note")
      : null
  const existingNote: Note | null = noteError
    ? null
    : (noteResponse?.data ?? null)

  const [extractNoteFromFile] = useExtractNoteFromFileMutation()
  const [splitInspectionNote] = useSplitInspectionNoteMutation()

  function pickFile(file: File) {
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"]
    if (!allowed.includes(file.type)) {
      setErrorMsg("Only PDF, JPG, PNG, or WEBP files are accepted.")
      return
    }
    setSelectedFile(file)
    setErrorMsg(null)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) pickFile(file)
  }

  async function handleUpload() {
    if (!selectedFile || !inspectionId) return
    setStage("uploading")
    setErrorMsg(null)

    try {
      const form = new FormData()
      form.append("file", selectedFile)
      form.append("data", JSON.stringify({ inspectionId }))

      const response = await extractNoteFromFile(form).unwrap()
      const note: Note = response?.data ?? response
      setFreshNote(note)

      // Auto-trigger AI answer extraction
      setStage("extracting")
      await splitInspectionNote(inspectionId).unwrap()

      setStage("done")
    } catch (err) {
      setErrorMsg(
        (err as { data?: { message?: string } })?.data?.message ??
          "Something went wrong"
      )
      setStage("error")
    }
  }

  const displayNote = freshNote ?? existingNote

  // Loading existing note check
  if (noteLoading) {
    return (
      <div className="flex h-full items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          to="/organization/audit/inspections"
          className="hover:text-foreground"
        >
          Inspections
        </Link>
        <span>/</span>
        <Link
          to={`/organization/audit/inspections/${inspectionId}`}
          className="hover:text-foreground"
        >
          Inspection
        </Link>
        <span>/</span>
        <span className="text-foreground">Notes</span>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-foreground">
          Inspector notes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a handwritten or typed note — OCR extracts the text and AI maps
          it to your questions automatically.
        </p>
      </div>

      {/* A real error loading the note (not just "no note yet") */}
      {noteLoadError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {noteLoadError}
        </div>
      )}

      {/* Existing note already there and no fresh upload */}
      {existingNote && !freshNote && stage === "idle" && (
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-start justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {existingNote.title}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {new Date(existingNote.createdAt).toLocaleDateString()}
            </span>
          </div>
          <p className="line-clamp-6 text-sm whitespace-pre-wrap text-muted-foreground">
            {existingNote.extracted_text}
          </p>
          {(existingNote.attachments?.length ?? 0) > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {existingNote.attachments!.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1 text-xs text-foreground hover:underline"
                >
                  <Paperclip className="h-3 w-3 text-muted-foreground" />
                  {attachmentFileName(url)}
                </a>
              ))}
            </div>
          )}
          <div className="mt-4 flex gap-3">
            <Link
              to={`/organization/audit/inspections/${inspectionId}`}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Back to inspection
            </Link>
          </div>
        </div>
      )}

      {/* Upload area — shown when no existing note or after an upload error,
          but not when the note fetch itself hit a real (non-404) error */}
      {!noteLoadError &&
        (!existingNote || stage === "error") &&
        stage !== "done" && (
          <>
            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragOver(true)
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-12 transition-colors ${
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              <UploadCloud className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  Drop a file here or{" "}
                  <span className="text-primary">browse</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PDF, JPG, PNG, WEBP · max 10 MB
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) pickFile(f)
                }}
              />
            </div>

            {/* Selected file chip */}
            {selectedFile && (
              <div className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{selectedFile.name}</span>
                  <span className="text-muted-foreground">
                    ({(selectedFile.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {errorMsg}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={
                !selectedFile || stage === "uploading" || stage === "extracting"
              }
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {stage === "uploading" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading &amp;
                  extracting text…
                </>
              ) : (
                <>
                  <UploadCloud className="h-4 w-4" /> Upload &amp; extract
                </>
              )}
            </button>
          </>
        )}

      {/* Extracting answers stage */}
      {stage === "extracting" && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-6 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">
            AI is mapping notes to questions…
          </p>
          <p className="text-xs text-muted-foreground">
            This usually takes a few seconds.
          </p>
        </div>
      )}

      {/* Done */}
      {stage === "done" && displayNote && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-800">
                Notes uploaded &amp; answers extracted
              </p>
              <p className="text-xs text-green-700">
                AI has pre-filled your inspection answers. Review them before
                marking complete.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <p className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Extracted text
            </p>
            <p className="text-sm whitespace-pre-wrap text-foreground">
              {displayNote.extracted_text}
            </p>
            {(displayNote.attachments?.length ?? 0) > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {displayNote.attachments!.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1 text-xs text-foreground hover:underline"
                  >
                    <Paperclip className="h-3 w-3 text-muted-foreground" />
                    {attachmentFileName(url)}
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() =>
                navigate(`/organization/audit/inspections/${inspectionId}`)
              }
              className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Review answers →
            </button>
            <Link
              to="/organization/audit/inspections"
              className="rounded-md border border-border px-5 py-2 text-sm text-muted-foreground hover:bg-muted"
            >
              Back to list
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
