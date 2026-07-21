// Confirmed against the real PineconeDocument Prisma model (issue #108) --
// fileName/fileId/fileSize are all optional columns even though the current
// single write path (ai.service.ts's upload_pdf_into_pinecone_via_ai)
// always sets them.
export interface PineconeDocument {
  id: string
  fileName: string | null
  fileId: string | null
  fileSize: string | null
  orgAccountId: string
  createdAt: string
}

// Raw passthrough of aexa-ai's GET /upload-status/:fileId job-status store
// (see upload_pdf_to_pinecone.py's set_job_status calls) -- aexa-server's
// check_upload_file_status_from_ai proxies this unchanged, with no zod
// contract of its own, so this type is sourced from aexa-ai's actual
// job-store writes, not a validated schema.
export interface PineconeUploadStatus {
  status: "queued" | "processing" | "completed" | "failed"
  message: string
  organization_username: string
  total_vectors?: number
}
