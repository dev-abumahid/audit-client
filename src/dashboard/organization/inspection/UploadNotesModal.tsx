/* eslint-disable @typescript-eslint/no-explicit-any */
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
import {
  useExtractNoteFromFileMutation,
  useGetNoteByInspectionIdQuery,
  useSaveRawNoteMutation,
  useUpdateNoteMutation,
} from "@/redux/apis/organization/note.api"
import { FileUp, Notebook, TypeOutline } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

type CreationMode = "file" | "text" | null

interface UploadNotesModalProps {
  open: boolean
  setOpen: (open: boolean) => void
  inspectionId: string
}

const loadingMessages = [
  "AI is reviewing your file...",
  "AI is extracting content...",
  "Performing OCR...",
  "Rewriting and optimizing...",
  "Generating note...",
]

export default function UploadNotesModal({
  open,
  setOpen,
  inspectionId,
}: UploadNotesModalProps) {
  const [mode, setMode] = useState<CreationMode>(null)
  const [messageIndex, setMessageIndex] = useState(0)
  const [extractedText, setExtractedText] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isUpdating, setIsUpdating] = useState<boolean>(false)

  // RTK query state
  const [uploadRawNote] = useSaveRawNoteMutation()
  const [extractNoteFromFile] = useExtractNoteFromFileMutation()
  const [updateNote] = useUpdateNoteMutation()
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
          title: "Inspection Note",
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
    } catch (error: any) {
      toast.error(error?.data?.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdate = async () => {
    try {
      setIsUpdating(true)

      const response = await updateNote({
        id: existingNote.id,
        body: { extracted_text: extractedText },
      }).unwrap()

      if (response?.success) {
        toast.success("Note updated successfully")
        refetch() // Refetch to update the UI
        handleClose()
      }
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to update note")
    } finally {
      setIsUpdating(false)
    }
  }

  useEffect(() => {
    if (!isLoading) return

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length)
    }, 1000)

    return () => clearInterval(interval)
  }, [isLoading])

  // If note exists, show update form
  if (hasNote && open) {
    return (
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
              Update Note
            </DialogTitle>
            <DialogDescription>
              Edit your inspection note below
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <div>
              <Label htmlFor="update-note">Note Content</Label>
              <Textarea
                id="update-note"
                value={extractedText}
                onChange={(e) => setExtractedText(e.target.value)}
                placeholder="Write your note here..."
                rows={15}
                className="mt-2 font-mono text-lg"
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={isUpdating || !extractedText.trim()}
            >
              {isUpdating ? "Updating..." : "Update Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
        className={`max-w-2xl ${isLoading ? "pointer-events-none" : ""}`}
      >
        {/* Loader Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
              {/* Spinner */}
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />

              {/* Text */}
              <p className="animate-pulse text-sm font-medium text-muted-foreground">
                {loadingMessages[messageIndex]}
              </p>
            </div>
          </div>
        )}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Notebook className="h-5 w-5" />
            Upload Notes
          </DialogTitle>
          <DialogDescription>
            Choose one method to upload your note into this inspection
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
              <p className="font-medium">Notes by Text</p>
              <p className="text-sm text-muted-foreground">
                Describe in detail Notes here..
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
              <p className="font-medium">Extract note from file</p>
              <p className="text-sm text-muted-foreground">
                Upload existing any file to extract notes
              </p>
            </div>
          </button>

          {/* Conditional Input Fields */}
          {mode === "text" && (
            <div className="pt-2">
              <Label htmlFor="extracted-text">Write Detailed Note</Label>
              <Textarea
                id="extracted-text"
                value={extractedText}
                onChange={(e) => setExtractedText(e.target.value)}
                placeholder="Create a comprehensive daily safety inspection checklist for construction sites including PPE, tools, emergency procedures..."
                rows={8}
                className="mt-2"
              />
            </div>
          )}

          {mode === "file" && (
            <div>
              <label
                htmlFor="file"
                className="block text-sm text-gray-500 dark:text-gray-300"
              >
                Upload any File
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
                  Any File
                </h2>

                <p className="mt-2 text-xs tracking-wide text-gray-500 dark:text-gray-400">
                  Upload any file.{" "}
                </p>

                <input
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  id="dropzone-file-pdf"
                  type="file"
                  className="hidden"
                />
              </label>
              {file && (
                <p className="mt-1 text-xs text-green-600">
                  Selected: {file.name}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!mode || isLoading}>
            {isLoading ? "Generating..." : "Generate Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
