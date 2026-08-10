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
import { FileUp, Notebook, TypeOutline } from "lucide-react"
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
  const { data, refetch } = useGetNoteByInspectionIdQuery(inspectionId)

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
      toast.error(error?.data?.message)
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
                className="h-11"
              >
                {t("organization.inspection.deleteNote")}
              </Button>
              <Button
                disabled={isSplitting}
                onClick={handleSplitNote}
                variant="secondary"
                className="h-11"
              >
                {isSplitting
                  ? t("organization.inspection.splitting")
                  : t("organization.inspection.splitNote")}
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={isUpdating || !extractedText.trim()}
                className="h-11"
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
            onClick={() => handleModeChange("text")}
            className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all hover:bg-secondary ${
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
            onClick={() => handleModeChange("file")}
            className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all hover:bg-secondary ${
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
                className="block text-sm text-gray-500 dark:text-gray-300"
              >
                {t("organization.inspection.uploadAnyFile")}
              </label>

              <label
                htmlFor="dropzone-file-pdf"
                className="mx-auto mt-2 flex w-full max-w-lg cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-gray-300 bg-white p-5 text-center dark:border-gray-700 dark:bg-gray-900"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  className="h-8 w-8 text-gray-500 dark:text-gray-400"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
                  />
                </svg>

                <h2 className="mt-1 font-medium tracking-wide text-gray-700 dark:text-gray-200">
                  {t("organization.inspection.anyFile")}
                </h2>

                <p className="mt-2 text-xs tracking-wide text-gray-500 dark:text-gray-400">
                  {t("organization.inspection.uploadAnyFileHint")}{" "}
                </p>

                <input
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  id="dropzone-file-pdf"
                  type="file"
                  className="hidden"
                />
              </label>
              {file && (
                <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                  {t("organization.inspection.selectedFile", {
                    name: file.name,
                  })}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} className="h-11">
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
            className="h-11"
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
