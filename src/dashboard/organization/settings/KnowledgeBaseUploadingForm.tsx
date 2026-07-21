/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  useCheckUploadFileStatusQuery,
  useDeleteFileFromPineconeMutation,
  useGetAllFilesFromPineconeQuery,
  useUploadPdfIntoPineconeMutation,
} from "@/redux/apis/organization/knowledgeBase.api"
import type { PineconeDocument } from "@/types/knowledgeBase"
import { FileText, Loader2, Trash2, Upload } from "lucide-react"
import type { ChangeEvent, DragEvent } from "react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

// One instance per concurrently-polling upload — a single scalar
// pollingFileId/pollingFileName would have one upload's tracking silently
// overwritten (and its terminal toast dropped) by a second upload started
// before the first finishes. Rendering one hook subscription per in-flight
// fileId keeps each poll independent without breaking rules-of-hooks.
// Found by independent review.
function UploadStatusPoller({
  fileId,
  onSettled,
}: {
  fileId: string
  onSettled: (
    fileId: string,
    outcome: "completed" | "failed",
    message?: string
  ) => void
}) {
  const { data: statusResponse } = useCheckUploadFileStatusQuery(fileId, {
    pollingInterval: 2000,
  })

  useEffect(() => {
    const status = statusResponse?.data?.status
    if (status === "completed") {
      onSettled(fileId, "completed")
    } else if (status === "failed") {
      onSettled(fileId, "failed", statusResponse?.data?.message)
    }
    // onSettled intentionally omitted — it's recreated every parent render,
    // and including it would re-run this effect on every unrelated
    // re-render rather than only on a real status transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusResponse])

  return null
}

const KnowledgeBaseUploadingForm = () => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  // The upload mutation itself only means "queued" — actual embedding into
  // Pinecone runs async on the aexa-ai side (see #35). Tracking fileId ->
  // fileName here lets us poll real status per upload instead of treating
  // the mutation resolving as "done". A map (not a single scalar) so a
  // second upload started before the first finishes doesn't silently drop
  // tracking of the first one.
  const [pollingUploads, setPollingUploads] = useState<Map<string, string>>(
    new Map()
  )

  const {
    data: apiResponse,
    isLoading,
    refetch,
  } = useGetAllFilesFromPineconeQuery(undefined)
  const [deleteDocument] = useDeleteFileFromPineconeMutation()
  const [uploadDocument] = useUploadPdfIntoPineconeMutation()

  const handlePollingSettled = (
    fileId: string,
    outcome: "completed" | "failed",
    message?: string
  ) => {
    const fileName = pollingUploads.get(fileId) ?? "File"
    if (outcome === "completed") {
      toast.success(`${fileName} finished processing`)
    } else {
      toast.error(message ?? `${fileName} failed to process`)
    }
    setPollingUploads((prev) => {
      const next = new Map(prev)
      next.delete(fileId)
      return next
    })
    refetch()
  }

  const documents = apiResponse?.data || []
  // GET /ai/get-all-files-from-pinecone is a plain, unpaginated findMany on
  // the backend (see ai.service.ts's get_all_pinecone_data_from_database) —
  // there's no meta.total to read (ApiResponse has no `meta` field at all,
  // unlike the paginated endpoints' PaginatedApiResponse). This used to read
  // apiResponse?.meta?.total, which was always undefined, so the displayed
  // count silently showed 0 documents forever regardless of how many were
  // actually uploaded. Found while typing this endpoint (issue #108).
  const totalItems = documents.length

  const formatFileSize = (size: string | null): string => {
    const bytes = parseInt(size ?? "")
    if (isNaN(bytes) || bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  const handleDrag = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(e.type === "dragenter" || e.type === "dragover")
  }

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files?.[0]) {
      await handleFileUpload(e.dataTransfer.files[0])
    }
  }

  const handleFileInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      await handleFileUpload(e.target.files[0])
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleFileUpload = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Please upload only PDF files")
      return
    }

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const result = await uploadDocument(formData).unwrap()

      if (result.success) {
        await refetch()
        const fileId = result?.data?.fileId ?? undefined
        if (fileId) {
          toast.info(`${file.name} queued — processing…`)
          setPollingUploads((prev) => new Map(prev).set(fileId, file.name))
        } else {
          // No fileId to poll status for — fall back to the old
          // assume-it-worked toast rather than silently saying nothing.
          toast.success(result.message || "File uploaded successfully!")
        }
      } else {
        toast.error(result.message || "Upload failed")
      }
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to upload file")
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteDocument = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return

    setDeletingId(id)

    try {
      const result = await deleteDocument(name).unwrap()
      if (result.success) {
        toast.success(result.message || "Document deleted successfully")
        await refetch()
      } else {
        toast.error(result.message || "Failed to delete document")
      }
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to delete document")
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Knowledge Base
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload and manage PDF documents for AI training
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Total: {totalItems} document{totalItems !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Upload Area */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept=".pdf,application/pdf"
        className="hidden"
      />

      <div
        className={`cursor-pointer rounded-lg border-2 border-dashed transition-all ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        } ${uploading ? "pointer-events-none opacity-60" : ""}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center justify-center py-12">
          {uploading ? (
            <>
              <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-foreground">Uploading...</p>
            </>
          ) : (
            <>
              <Upload
                className="mb-3 h-10 w-10 text-muted-foreground"
                strokeWidth={1.5}
              />
              <p className="text-sm text-foreground">
                Click or drag PDF to upload
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                PDF files only
              </p>
            </>
          )}
        </div>
      </div>

      {/* Documents List */}
      <div className="space-y-2">
        {documents.length === 0 ? (
          <div className="rounded-lg border border-border bg-card py-12 text-center">
            <FileText className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No documents yet</p>
          </div>
        ) : (
          documents.map((doc: PineconeDocument) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-3 transition-all hover:border-primary/30"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <FileText
                  className="h-8 w-8 flex-shrink-0 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {doc.fileName ?? "Untitled"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(doc.fileSize)}
                    {!!doc.fileId && pollingUploads.has(doc.fileId) && (
                      <span className="ml-2 inline-flex items-center gap-1 text-primary">
                        <Loader2 className="h-3 w-3 animate-spin" /> Processing…
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1">
                <button
                  onClick={() => {
                    // DELETE /ai/delete-file-from-pinecone matches by
                    // fileName -- a null fileName has nothing to key the
                    // delete on, so an empty-string fallback would silently
                    // no-op (Prisma's deleteMany matches zero rows) instead
                    // of deleting anything. Not reachable via the current
                    // upload flow (it always sets fileName), but disabled
                    // rather than left to silently do nothing if that ever
                    // changes.
                    if (!doc.fileName) return
                    handleDeleteDocument(doc.id, doc.fileName)
                  }}
                  disabled={
                    !doc.fileName ||
                    deletingId === doc.id ||
                    (!!doc.fileId && pollingUploads.has(doc.fileId))
                  }
                  className="rounded-md p-1.5 text-risk-critical transition-colors hover:bg-risk-critical/10 disabled:opacity-50"
                  title="Delete"
                >
                  {deletingId === doc.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {Array.from(pollingUploads.keys()).map((fileId) => (
        <UploadStatusPoller
          key={fileId}
          fileId={fileId}
          onSettled={handlePollingSettled}
        />
      ))}
    </div>
  )
}

export default KnowledgeBaseUploadingForm
