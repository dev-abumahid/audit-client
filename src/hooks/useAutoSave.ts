/* eslint-disable @typescript-eslint/no-explicit-any */
import type { TemplateFormValues } from "@/types/template"
import { useEffect, useRef, useState } from "react"
import { type UseFormReturn } from "react-hook-form"
import { toast } from "sonner"

interface UseAutoSaveOptions {
  form: UseFormReturn<TemplateFormValues>
  onSave: (data: TemplateFormValues) => Promise<void>
  interval?: number
  enabled?: boolean
}

export function useAutoSave({
  form,
  onSave,
  interval = 3000,
  enabled = true,
}: UseAutoSaveOptions) {
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle")
  const [hasChanges, setHasChanges] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedDataRef = useRef<string | null>(null)
  const isSavingRef = useRef(false)
  // Tracks the "saved" -> "idle" status reset timer shared by the
  // auto-save and manual-save paths, so it can be cleared on unmount --
  // otherwise it fires setSaveStatus() after unmount if the component goes
  // away within the 2s window right after a save completes.
  const savedStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  // Mirrors the auto-save effect's per-attempt `cancelled` flag, but for
  // manualSave() -- which isn't scoped to an effect, so it needs its own
  // unmount signal to avoid calling setState after the component is gone
  // if it unmounts while a manual save's onSave() call is still in flight.
  const isMountedRef = useRef(true)
  useEffect(() => {
    return () => {
      isMountedRef.current = false
      if (savedStatusTimeoutRef.current) {
        clearTimeout(savedStatusTimeoutRef.current)
      }
    }
  }, [])

  // Track form changes
  useEffect(() => {
    if (!enabled) return

    const subscription = form.watch((value, { type }) => {
      if (type === "change") {
        const currentData = JSON.stringify(value)
        const hasUnsavedChanges = currentData !== lastSavedDataRef.current
        setHasChanges(hasUnsavedChanges)

        if (hasUnsavedChanges) {
          setSaveStatus("idle")
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [form, enabled])

  // Auto-save logic
  useEffect(() => {
    if (!enabled || !hasChanges || isSavingRef.current) return

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    let cancelled = false

    const attemptSave = async () => {
      if (cancelled) return

      try {
        // Re-validate before persisting -- form.watch() only tracks that
        // *something* changed, not whether the current values are valid.
        // Without this, autosave silently writes invalid data (e.g. an
        // emptied required field) to the server even though the form UI is
        // showing an inline validation error for it.
        const isValid = await form.trigger()
        if (cancelled) return
        if (!isValid) {
          setSaveStatus("idle")
          // hasChanges is already true and won't flip false->true again
          // while the field stays invalid, so this effect won't re-run on
          // its own -- reschedule explicitly so autosave resumes the moment
          // the value becomes valid again, instead of stalling permanently.
          if (!cancelled) {
            timeoutRef.current = setTimeout(attemptSave, interval)
          }
          return
        }

        setSaveStatus("saving")
        isSavingRef.current = true

        const currentData = form.getValues()
        await onSave(currentData)
        if (cancelled) return

        lastSavedDataRef.current = JSON.stringify(currentData)
        setHasChanges(false)
        setSaveStatus("saved")

        // Reset saved status after 2 seconds
        if (savedStatusTimeoutRef.current) {
          clearTimeout(savedStatusTimeoutRef.current)
        }
        savedStatusTimeoutRef.current = setTimeout(() => {
          setSaveStatus((prev) => (prev === "saved" ? "idle" : prev))
        }, 2000)
      } catch (error: any) {
        if (!cancelled) {
          toast.error(error?.message || "Auto-save failed")
          setSaveStatus("error")
        }
      } finally {
        // Always reset the in-flight guard, even if this attempt was
        // cancelled mid-flight -- otherwise a cancelled save would leave
        // isSavingRef stuck "true" forever and permanently block all future
        // autosave attempts once the effect re-runs (e.g. after remount).
        isSavingRef.current = false
      }
    }

    timeoutRef.current = setTimeout(attemptSave, interval)

    return () => {
      cancelled = true
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [hasChanges, form, onSave, interval, enabled])

  // Manual save
  const manualSave = async () => {
    if (isSavingRef.current) return

    try {
      setSaveStatus("saving")
      isSavingRef.current = true

      const currentData = form.getValues()
      await onSave(currentData)
      if (!isMountedRef.current) return

      lastSavedDataRef.current = JSON.stringify(currentData)
      setHasChanges(false)
      setSaveStatus("saved")

      if (savedStatusTimeoutRef.current) {
        clearTimeout(savedStatusTimeoutRef.current)
      }
      savedStatusTimeoutRef.current = setTimeout(() => {
        setSaveStatus((prev) => (prev === "saved" ? "idle" : prev))
      }, 2000)
    } catch (error) {
      if (isMountedRef.current) {
        setSaveStatus("error")
      }
      throw error
    } finally {
      isSavingRef.current = false
    }
  }

  // Initialize last saved data
  useEffect(() => {
    if (enabled && !lastSavedDataRef.current) {
      lastSavedDataRef.current = JSON.stringify(form.getValues())
    }
  }, [form, enabled])

  return {
    saveStatus,
    hasChanges,
    manualSave,
    isSaving: saveStatus === "saving",
  }
}
