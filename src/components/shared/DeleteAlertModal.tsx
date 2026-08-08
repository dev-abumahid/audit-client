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
import { AlertCircle } from "lucide-react"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

type DeleteAlertModalProps = {
  title?: string
  description?: string
  onConfirm?: () => void
  loading?: boolean
  open?: boolean
  setOpen?: (value: boolean) => void
}

export default function DeleteAlertModal({
  title,
  description,
  onConfirm,
  loading = false,
  open,
  setOpen,
}: DeleteAlertModalProps) {
  const { t } = useTranslation()
  const resolvedTitle = title ?? t("common.deleteAlertModal.defaultTitle")
  const resolvedDescription =
    description ?? t("common.deleteAlertModal.defaultDescription")

  // quality-bar-loop round 7 (accessibility): this component is always used
  // fully controlled (open/setOpen from the caller's own state, no
  // <AlertDialogTrigger>), so Radix has no trigger reference to restore
  // focus to on close -- confirmed live that pressing Escape left focus on
  // <body> instead of the button that opened the modal. The sibling
  // create/edit modal already solves this via useModalA11y's
  // triggerRef.current?.focus() on cleanup; this mirrors that for every
  // caller of this shared component (site delete, risk delete, and any
  // future one) in one place rather than pushing the fix onto each caller.
  const previouslyFocusedElement = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (open) {
      previouslyFocusedElement.current = document.activeElement as HTMLElement | null
    } else {
      previouslyFocusedElement.current?.focus?.()
    }
  }, [open])

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="flex max-w-sm flex-col items-center justify-center rounded-3xl p-6 sm:p-8">
        <AlertDialogHeader>
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <AlertCircle
              className="h-9 w-9 shrink-0 text-red-600"
              strokeWidth={2}
            />
            <AlertDialogTitle className="max-w-full text-xl font-semibold wrap-break-word">
              {resolvedTitle}
            </AlertDialogTitle>
            <AlertDialogDescription className="max-w-full wrap-break-word">
              {resolvedDescription}
            </AlertDialogDescription>
          </div>
        </AlertDialogHeader>

        <AlertDialogFooter className="mt-6 flex w-full flex-row gap-3 sm:justify-between sm:space-x-0">
          {/* Cancel Button */}
          {/* quality-bar-loop round 5 (mobile): default size resolves to
              h-7 (28px), under the 44px touch-target guideline -- h-11
              overrides just the height, same pattern already used for
              this component's color/radius overrides. */}
          <AlertDialogCancel className="mt-0 h-11 flex-1 cursor-pointer rounded-xl border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
            {t("common.deleteAlertModal.cancel")}
          </AlertDialogCancel>

          {/* Delete Button */}
          <AlertDialogAction
            onClick={onConfirm}
            className="h-11 flex-1 cursor-pointer rounded-xl border-none bg-red-600 text-white shadow-sm hover:bg-red-700"
            disabled={loading}
          >
            {loading
              ? t("common.deleteAlertModal.deleting")
              : t("common.deleteAlertModal.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
