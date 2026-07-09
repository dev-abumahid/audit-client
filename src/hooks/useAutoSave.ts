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

    timeoutRef.current = setTimeout(async () => {
      try {
        setSaveStatus("saving")
        isSavingRef.current = true

        const currentData = form.getValues()
        await onSave(currentData)

        lastSavedDataRef.current = JSON.stringify(currentData)
        setHasChanges(false)
        setSaveStatus("saved")

        // Reset saved status after 2 seconds
        setTimeout(() => {
          setSaveStatus((prev) => (prev === "saved" ? "idle" : prev))
        }, 2000)
      } catch (error: any) {
        toast.error(error?.message || "Auto-save failed")
        setSaveStatus("error")
      } finally {
        isSavingRef.current = false
      }
    }, interval)

    return () => {
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

      lastSavedDataRef.current = JSON.stringify(currentData)
      setHasChanges(false)
      setSaveStatus("saved")

      setTimeout(() => {
        setSaveStatus((prev) => (prev === "saved" ? "idle" : prev))
      }, 2000)
    } catch (error) {
      setSaveStatus("error")
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
