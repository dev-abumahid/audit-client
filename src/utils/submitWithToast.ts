import { toast } from "sonner"

// aexa-server#346 review round: extracted out of CompliancePage.tsx (where
// this originated -- see git blame for the fuller history: handleSave,
// handleConfirmDelete, and confirmAttest each independently repeated the
// identical shape) so ComplianceRiskLinkModal.tsx's two mutation submits
// could reuse it too, instead of a third hand-rolled copy that (as review
// caught) skipped the `res.success` check entirely -- an RTK Query mutation
// can resolve with HTTP 200 and `{ success: false, message: "..." }`
// (manage_response.ts on the backend), so skipping that check meant a
// business-rule failure would show a false-positive success toast and close
// the modal without actually creating/linking anything.
//
// Never throws -- swallows both the "request succeeded but server reported
// failure" and genuine network/validation-error cases into a toast either
// way, so every call site can safely `await` this without its own
// try/catch.
export async function submitWithToast<T extends { success: boolean; message?: string }>(
  action: () => Promise<T>,
  successMessage: string,
  fallbackErrorMessage: string,
  onSuccess?: () => void
): Promise<void> {
  try {
    const res = await action()
    if (res.success) {
      toast.success(successMessage)
      onSuccess?.()
    } else {
      toast.error(res.message || fallbackErrorMessage)
    }
  } catch (err) {
    const message =
      (err as { data?: { message?: string } })?.data?.message ||
      fallbackErrorMessage
    toast.error(message)
  }
}
