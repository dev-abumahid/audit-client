/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  useDeleteFileFromPineconeMutation,
  useGetAllFilesFromPineconeQuery,
  useUploadPdfIntoPineconeMutation,
} from "@/redux/apis/organization/knowledgeBase.api"
import { FileText, Loader2, Trash2, Upload } from "lucide-react"
import type { ChangeEvent, DragEvent } from "react"
import { useRef, useState } from "react"
import { toast } from "sonner"

//  id           String   @id @default(uuid())
//     fileName     String?
//     fileId       String?
//     fileSize     String?
//     orgAccountId String
//     account      Account  @relation(fields: [orgAccountId], references: [id])
//     createdAt    DateTime @default(now())

interface Document {
  id: string
  fileName: string
  fileSize: string
  createdAt: string
  fileId: string
}

const KnowledgeBaseUploadingForm = () => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const {
    data: apiResponse,
    isLoading,
    refetch,
  } = useGetAllFilesFromPineconeQuery(undefined)
  const [deleteDocument] = useDeleteFileFromPineconeMutation()
  const [uploadDocument] = useUploadPdfIntoPineconeMutation()

  const documents = apiResponse?.data || []
  const totalItems = apiResponse?.meta?.total || 0

  const formatFileSize = (size: string): string => {
    const bytes = parseInt(size)
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
        toast.success(result.message || "File uploaded successfully!")
        await refetch()
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
          documents.map((doc: Document) => (
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
                    {doc?.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(doc?.fileSize)}
                  </p>
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1">
                <button
                  onClick={() => handleDeleteDocument(doc.id, doc?.fileName)}
                  disabled={deletingId === doc.id}
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
    </div>
  )
}

export default KnowledgeBaseUploadingForm
