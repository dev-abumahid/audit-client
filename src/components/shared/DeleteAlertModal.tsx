import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type DeleteAlertModalProps = {
  title?: string
  description?: string
  onConfirm?: () => void
  loading?: boolean
  open?: boolean
  setOpen?: (value: boolean) => void
}

export default function DeleteAlertModal({
  title = "Are you absolutely sure?",
  description = "This action cannot be undone. This will permanently delete this item.",
  onConfirm,
  loading = false,
  open,
  setOpen,
}: DeleteAlertModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          {/* Make title red for danger */}
          <AlertDialogTitle className="text-destructive">
            {title}
          </AlertDialogTitle>

          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>

          {/* Danger button */}
          <AlertDialogAction
            onClick={onConfirm}
            className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
            disabled={loading}
          >
            {loading ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
