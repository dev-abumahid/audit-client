/* eslint-disable @typescript-eslint/no-explicit-any */
import DeleteAlertModal from "@/components/shared/DeleteAlertModal"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useSplitInspectionNoteMutation } from "@/redux/apis/organization/inspection.api"
import {
  useDeleteNoteByIdMutation,
  useExtractNoteFromFileMutation,
  useGetNoteByInspectionIdQuery,
  useSaveRawNoteMutation,
  useUpdateNoteMutation,
} from "@/redux/apis/organization/note.api"
import { validateInspectionFile } from "@/utils/inspectionFileValidation"
import { CloudUpload, FileUp, Notebook, TypeOutline } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

type CreationMode = "file" | "text" | null

interface UploadNotesModalProps {
  open: boolean
  setOpen: (open: boolean) => void
  inspectionId: string
}

const loadingMessageKeys = [
  "organization.inspection.aiReviewingFile",
  "organization.inspection.aiExtractingContent",
  "organization.inspection.performingOcr",
  "organization.inspection.rewritingOptimizing",
  "organization.inspection.generatingNote",
]

export default function UploadNotesModal({
  open,
  setOpen,
  inspectionId,
}: UploadNotesModalProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<CreationMode>(null)
  const [messageIndex, setMessageIndex] = useState(0)
  const [extractedText, setExtractedText] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isUpdating, setIsUpdating] = useState<boolean>(false)
  const [isSplitting, setIsSplitting] = useState<boolean>(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  // RTK query state
  const [uploadRawNote] = useSaveRawNoteMutation()
  const [extractNoteFromFile] = useExtractNoteFromFileMutation()
  const [updateNote] = useUpdateNoteMutation()
  const [splitInspectionNote] = useSplitInspectionNoteMutation()
  const [deleteNote, { isLoading: isNoteDeleting }] =
    useDeleteNoteByIdMutation()
  // quality-bar-loop (Inspections, round 41, efficiency finding): this
  // modal is always mounted by UpdateInspection.tsx (only `open` toggles),
  // and this query used to fire unconditionally on mount -- the third
  // instance of the same always-mounted-modal/unguarded-query pattern
  // already fixed for CreateNewFindingModal.tsx (round 37) and
  // StartInspectionModal.tsx (round 39). Every `hasNote`/`existingNote`
  // usage below is already gated on `open` (directly or via a handler only
  // reachable while the modal is interactive), so skipping while closed is
  // safe.
  const { data, refetch } = useGetNoteByInspectionIdQuery(inspectionId, {
    skip: !open,
  })

  const existingNote = data?.data
  const hasNote = !!existingNote

  // Set extracted text when editing existing note
  useEffect(() => {
    if (hasNote && open) {
      setExtractedText(existingNote.extracted_text || "")
    }
  }, [hasNote, open, existingNote])

  const resetAll = () => {
    setExtractedText("")
    setFile(null)
    setMode(null)
    setIsUpdating(false)
  }

  const handleModeChange = (newMode: CreationMode) => {
    if (mode === newMode) return
    resetAll() // Clear previous input when switching
    setMode(newMode)
  }

  const handleClose = () => {
    resetAll()
    setOpen(false)
  }

  const handleCreate = async () => {
    try {
      if (!mode) return

      setIsLoading(true)

      let response

      if (mode === "text") {
        response = await uploadRawNote({
          title: t("organization.inspection.inspectionNoteTitle"),
          extracted_text: extractedText,
          inspectionId,
        }).unwrap()
      }

      if (mode === "file") {
        const formData = new FormData()
        formData.append("file", file!)
        formData.append("data", JSON.stringify({ inspectionId }))
        response = await extractNoteFromFile(formData).unwrap()
      }

      if (response?.success) {
        toast.success(response?.message)
        refetch() // Refetch to update the UI
      }

      handleClose()
      setOpen(true)
    } catch (error: any) {
      // quality-bar-loop (Inspections, round 41, resilience finding): this
      // was the one handler in this file with no fallback message --
      // every sibling handler (handleUpdate, handleSplitNote,
      // handleNoteDelete) falls back to a translated generic string when
      // the server response has no data.message (a timeout, a CORS
      // failure, a 502 from a proxy). This one used to surface a blank
      // toast in exactly that case.
      toast.error(
        error?.data?.message ||
          t("organization.inspection.noteCreateFailedToast")
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdate = async () => {
    // hasNote (checked by the branch that renders this handler's button)
    // only reflects state at render time, not at click time — narrowing it
    // here for TS is also a real guard against a race where the note gets
    // deleted out from under an open update form.
    if (!existingNote) return
    try {
      setIsUpdating(true)

      const response = await updateNote({
        id: existingNote.id,
        body: { extracted_text: extractedText },
      }).unwrap()

      if (response?.success) {
        toast.success(t("organization.inspection.noteUpdatedToast"))
        refetch() // Refetch to update the UI
        handleClose()
      }
    } catch (error: any) {
      toast.error(
        error?.data?.message ||
          t("organization.inspection.noteUpdateFailedToast")
      )
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSplitNote = async () => {
    setIsSplitting(true)
    try {
      const res = await splitInspectionNote(inspectionId).unwrap()
      if (res.success) {
        toast.success(res.message)
        handleClose()
      }
    } catch (error: any) {
      // Keep the update-note dialog open on failure so the user can retry
      // (matches handleUpdate/handleNoteDelete above); without this, a
      // rejected split would also leave isSplitting stuck true forever
      // since setIsSplitting(false) below was never reached.
      toast.error(
        error?.data?.message ||
          t("organization.inspection.noteSplitFailedToast")
      )
    } finally {
      setIsSplitting(false)
    }
  }

  const handleNoteDelete = async () => {
    // Same discarded-isLoading double-submission bug fixed for
    // RiskRegisterPage/aexa-frontend#620 -- the disabled button prop is the
    // primary guard, but a defensive check inside the handler closes the
    // theoretical window where a second call could land before a re-render
    // commits the disabled state.
    if (!existingNote?.id || isNoteDeleting) return

    try {
      const res = await deleteNote(existingNote.id).unwrap()
      if (res.success) {
        toast.success(res.message)
        setIsDeleteModalOpen(false)
      }
    } catch (err: any) {
      toast.error(
        err?.message || t("organization.inspection.noteDeleteFailedToast")
      )
    }
  }

  useEffect(() => {
    if (!isLoading) return

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessageKeys.length)
    }, 1000)

    return () => clearInterval(interval)
  }, [isLoading])

  // If note exists, show update form
  if (hasNote && open) {
    return (
      <>
        <Dialog
          open={open}
          modal={true}
          onOpenChange={(val) => {
            if (isLoading || isUpdating) return
            setOpen(val)
          }}
        >
          <DialogContent className="flex max-h-[90vh] w-full flex-col sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Notebook className="h-5 w-5" />
                {t("organization.inspection.updateNote")}
              </DialogTitle>
              <DialogDescription>
                {t("organization.inspection.updateNoteDescription")}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto">
              <div>
                <Label htmlFor="update-note">
                  {t("organization.inspection.noteContent")}
                </Label>
                <Textarea
                  id="update-note"
                  value={extractedText}
                  onChange={(e) => setExtractedText(e.target.value)}
                  placeholder={t(
                    "organization.inspection.noteContentPlaceholder"
                  )}
                  rows={15}
                  className="mt-2 font-mono text-lg"
                />
              </div>
            </div>

            {/* quality-bar-loop round 2 (mobile, round-1 finding): the
                shared Button's default height (h-7) is well under the
                44px touch-target guideline, same bug class fixed on 9+
                pages this session. */}
            <DialogFooter className="mt-4">
              <Button
                onClick={() => setIsDeleteModalOpen(true)}
                variant="destructive"
                size="touch"
              >
                {t("organization.inspection.deleteNote")}
              </Button>
              <Button
                disabled={isSplitting}
                onClick={handleSplitNote}
                variant="secondary"
                size="touch"
              >
                {isSplitting
                  ? t("organization.inspection.splitting")
                  : t("organization.inspection.splitNote")}
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={isUpdating || !extractedText.trim()}
                size="touch"
              >
                {isUpdating
                  ? t("organization.inspection.updating")
                  : t("organization.inspection.updateNote")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <DeleteAlertModal
          open={isDeleteModalOpen}
          setOpen={setIsDeleteModalOpen}
          title={t("organization.inspection.deleteConfirmTitle")}
          description={t("organization.inspection.deleteConfirmDescription")}
          onConfirm={handleNoteDelete}
          loading={isNoteDeleting}
        />
      </>
    )
  }

  // If no note exists, show upload form
  return (
    <Dialog
      open={open}
      modal={true}
      onOpenChange={(val) => {
        if (isLoading) return
        setOpen(val)
      }}
    >
      <DialogContent
        className={`max-h-[90vh] max-w-2xl ${isLoading ? "pointer-events-none" : ""}`}
      >
        {/* Loader Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
              {/* Spinner */}
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />

              {/* Text */}
              <p className="animate-pulse text-sm font-medium text-muted-foreground">
                {t(loadingMessageKeys[messageIndex])}
              </p>
            </div>
          </div>
        )}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Notebook className="h-5 w-5" />
            {t("organization.inspection.uploadNotes")}
          </DialogTitle>
          <DialogDescription>
            {t("organization.inspection.uploadNotesDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Text Option */}
          <button
            type="button"
            onClick={() => handleModeChange("text")}
            className={`focus-ring flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all hover:bg-secondary ${
              mode === "text" ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <TypeOutline className="h-6 w-6 text-primary" />
            <div>
              <p className="font-medium">
                {t("organization.inspection.notesByText")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("organization.inspection.notesByTextHint")}
              </p>
            </div>
          </button>

          {/* PDF Option */}
          <button
            type="button"
            onClick={() => handleModeChange("file")}
            className={`focus-ring flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all hover:bg-secondary ${
              mode === "file" ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <FileUp className="h-6 w-6 text-primary" />
            <div>
              <p className="font-medium">
                {t("organization.inspection.extractNoteFromFile")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("organization.inspection.extractNoteFromFileHint")}
              </p>
            </div>
          </button>

          {/* Conditional Input Fields */}
          {mode === "text" && (
            <div className="pt-2">
              <Label htmlFor="extracted-text">
                {t("organization.inspection.writeDetailedNote")}
              </Label>
              <Textarea
                id="extracted-text"
                value={extractedText}
                onChange={(e) => setExtractedText(e.target.value)}
                placeholder={t(
                  "organization.inspection.writeDetailedNotePlaceholder"
                )}
                rows={8}
                className="mt-2 h-52 resize-none overflow-y-auto"
              />
            </div>
          )}

          {mode === "file" && (
            <div>
              <label
                htmlFor="file"
                className="block text-sm text-muted-foreground"
              >
                {t("organization.inspection.uploadAnyFile")}
              </label>

              {/* quality-bar-loop (Inspections, round 15, visual polish
                  finding): this dropzone was the only upload control in
                  the Inspections feature hand-rolling raw Tailwind
                  gray/white instead of the app's semantic tokens (every
                  other dropzone -- CreateNewInspection.tsx,
                  UpdateInspection.tsx -- uses border-border/text-
                  foreground/text-muted-foreground), and its raw inline SVG
                  used kebab-case attribute names (stroke-width,
                  stroke-linecap/-linejoin) instead of React's camelCase,
                  spamming console with "Invalid DOM property" warnings on
                  every render -- confirmed live. Swapped for the same
                  CloudUpload icon + semantic-token treatment already
                  established in the other two upload flows. */}
              <label
                htmlFor="dropzone-file-pdf"
                // quality-bar-loop (Inspections, round 52, accessibility
                // finding): same gap as CreateNewInspection.tsx/
                // UpdateInspection.tsx's identical `sr-only` file inputs had
                // -- `sr-only` clips any focus ring on the input itself,
                // leaving keyboard focus reachable (round 7's fix) but
                // visually invisible (WCAG 2.4.7). This label wraps its
                // input directly, so `has-[:focus-visible]` works the same
                // way as UpdateInspection.tsx's attachment-upload fix.
                className="mx-auto mt-2 flex w-full max-w-lg cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-border bg-muted/30 p-5 text-center has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/30"
              >
                <CloudUpload className="h-8 w-8 text-muted-foreground" />

                <h2 className="mt-1 font-medium tracking-wide text-foreground">
                  {t("organization.inspection.anyFile")}
                </h2>

                <p className="mt-2 text-xs tracking-wide text-muted-foreground">
                  {t("organization.inspection.uploadAnyFileHint")}{" "}
                </p>

                <input
                  onChange={(e) => {
                    const selected = e.target.files?.[0] || null
                    // quality-bar-loop (Inspections, round 43, resilience
                    // finding): this input had no `accept` and never
                    // called validateInspectionFile() -- unlike every
                    // sibling upload flow in this feature
                    // (CreateNewInspection.tsx/UpdateInspection.tsx), a
                    // bad file here was only caught after a full network
                    // round-trip to extractNoteFromFile failed. Same
                    // immediate-reject-with-toast pattern as those flows.
                    if (selected) {
                      const validation = validateInspectionFile(selected)
                      if (!validation.valid) {
                        toast.error(
                          t(
                            validation.reason === "size"
                              ? "organization.inspection.fileSizeError"
                              : "organization.inspection.fileTypeError"
                          )
                        )
                        e.target.value = ""
                        return
                      }
                    }
                    setFile(selected)
                  }}
                  id="dropzone-file-pdf"
                  type="file"
                  accept="image/*,video/mp4,video/quicktime,video/webm,application/pdf"
                  // quality-bar-loop (Inspections, round 7, accessibility
                  // finding): `hidden`/`display:none` removes the input
                  // from the tab order entirely -- this upload control was
                  // keyboard-unreachable (WCAG 2.1.1). `sr-only` keeps it
                  // visually hidden but focusable, so Tab reaches it and
                  // Enter/Space opens the native file picker.
                  className="sr-only"
                />
              </label>
              {file && (
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                  {t("organization.inspection.selectedFile", {
                    name: file.name,
                  })}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} size="touch">
            {t("organization.inspection.cancel")}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={
              !mode ||
              isLoading ||
              (mode === "text" && !extractedText.trim()) ||
              (mode === "file" && !file)
            }
            size="touch"
          >
            {isLoading
              ? t("organization.inspection.extracting")
              : t("organization.inspection.uploadNotes")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
