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
  confirmLabel?: string
  loadingLabel?: string
}

export default function DeleteAlertModal({
  title,
  description,
  onConfirm,
  loading = false,
  open,
  setOpen,
  confirmLabel,
  loadingLabel,
}: DeleteAlertModalProps) {
  const { t } = useTranslation()
  const resolvedTitle = title ?? t("common.deleteAlertModal.defaultTitle")
  const resolvedDescription =
    description ?? t("common.deleteAlertModal.defaultDescription")
  // Round 11 (UX finding): every OTHER caller of this shared component
  // (site/risk/finding/template delete, etc.) genuinely deletes, so
  // "Delete"/"Deleting..." is the right default -- but AlertsPage's
  // "Dismiss" flow used this same hardcoded copy despite every other
  // affordance around it (button label, toast keys, modal title) calling
  // the action "Dismiss." Live-confirmed as a real trust/comprehension
  // gap: a user clicking "Dismiss" (expecting something reversible, à la
  // GitHub/Slack) hit a modal that flipped terminology to "Delete" right
  // before an irreversible action. Optional overrides let a caller supply
  // its own verb without changing the default for every other caller.
  const resolvedConfirmLabel =
    confirmLabel ?? t("common.deleteAlertModal.delete")
  const resolvedLoadingLabel =
    loadingLabel ?? t("common.deleteAlertModal.deleting")

  // quality-bar-loop round 7 (accessibility): this component is always used
  // fully controlled (open/setOpen from the caller's own state, no
  // <AlertDialogTrigger>), so Radix has no trigger reference to restore
  // focus to on close -- confirmed live that pressing Escape left focus on
  // <body> instead of the button that opened the modal. The sibling
  // create/edit modal already solves this via useModalA11y's
  // triggerRef.current?.focus() on cleanup; this mirrors that for every
  // caller of this shared component (site delete, risk delete, and any
  // future one) in one place rather than pushing the fix onto each caller.
  //
  // Known, accepted limitation (round 8): this only restores focus for the
  // cancel/Escape path, where the trigger is still in the DOM. On a
  // *successful* delete, the row (and its trigger button) is removed from
  // the list once the query refetches, so `previouslyFocusedElement`
  // points at a detached node -- `.focus()` on it is a no-op, and the
  // browser's own default (moving focus to <body> when the focused
  // element is removed from the document) already runs before this
  // effect's cleanup even gets a chance to act. There's no generically
  // correct fallback target this shared, page-agnostic component could
  // pick instead (the "next" element in a list, a page heading, etc. all
  // require knowledge only the calling page has) -- this is the same
  // trade-off mature dialog primitives (including Radix's own docs) call
  // out explicitly rather than solve, and the success toast this
  // component's callers already show carries the outcome for
  // screen-reader users independent of where focus lands.
  const previouslyFocusedElement = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (open) {
      previouslyFocusedElement.current = document.activeElement as HTMLElement | null
    } else {
      previouslyFocusedElement.current?.focus?.()
    }
  }, [open])

  // quality-bar-loop round 8 (accessibility): `disabled={loading}` on the
  // Delete button is a real native `disabled` attribute, so the instant a
  // caller's mutation starts, the browser force-blurs the button the user
  // just clicked -- there's no `tabIndex`/`aria-disabled` alternative that
  // keeps it focusable, and the "Delete" -> "Deleting..." label swap has
  // no live region, so a keyboard/screen-reader user loses focus context
  // and gets no announcement at the exact moment their destructive-action
  // click registers. Moving focus deliberately to the still-enabled Cancel
  // button (rather than the browser's default of dropping it to <body>)
  // keeps focus inside the dialog and on a meaningful control.
  const footerRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (loading && footerRef.current?.contains(document.activeElement)) {
      footerRef.current
        .querySelector<HTMLButtonElement>("button:not([disabled])")
        ?.focus()
    }
  }, [loading])

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="flex max-w-sm flex-col items-center justify-center rounded-3xl p-6 sm:p-8">
        <AlertDialogHeader>
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <AlertCircle
              className="h-9 w-9 shrink-0 text-destructive"
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

        {/* quality-bar-loop round 8 (accessibility): announces the
            "Deleting..." transition to screen readers -- the button label
            swap alone is silent since there's no live region wrapping it. */}
        <span aria-live="polite" className="sr-only">
          {loading ? resolvedLoadingLabel : ""}
        </span>

        <AlertDialogFooter
          ref={footerRef}
          className="mt-6 flex w-full flex-row gap-3 sm:justify-between sm:space-x-0"
        >
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
            className="h-11 flex-1 cursor-pointer rounded-xl border-none bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90"
            disabled={loading}
          >
            {loading ? resolvedLoadingLabel : resolvedConfirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
