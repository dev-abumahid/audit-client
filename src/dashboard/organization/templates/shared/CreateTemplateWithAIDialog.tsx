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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  useGenerateTemplateWithPdfMutation,
  useGenerateTemplateWithPromptMutation,
  useGenerateTemplateWithRiskMutation,
} from "@/redux/apis/organization/ai.api"
import { useGetAllRisksQuery } from "@/redux/apis/organization/risk.api"
import type { Risk } from "@/types/organization"
import { severityTextClasses } from "@/utils/severityStyles"
import { AlertCircleIcon, Brain, FileText, Upload } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import type { TFunction } from "i18next"

type CreationMode = "prompt" | "file" | "risk" | null

interface CreateTemplateWithAIDialogProps {
  open: boolean
  setOpen: (open: boolean) => void
}

const getLoadingMessages = (mode: CreationMode, t: TFunction) => {
  const generating = t("organization.templates.ai.loading.generating")
  switch (mode) {
    case "prompt":
      return [t("organization.templates.ai.loading.reviewingPrompt"), generating]

    case "risk":
      return [
        t("organization.templates.ai.loading.reviewingRisk"),
        t("organization.templates.ai.loading.gatheringContext"),
        generating,
      ]

    case "file":
      return [
        t("organization.templates.ai.loading.reviewingFile"),
        t("organization.templates.ai.loading.extracting"),
        t("organization.templates.ai.loading.ocr"),
        t("organization.templates.ai.loading.optimizing"),
        generating,
      ]

    default:
      return [generating]
  }
}
export default function CreateTemplateWithAIDialog({
  open,
  setOpen,
}: CreateTemplateWithAIDialogProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<CreationMode>(null)
  const [messageIndex, setMessageIndex] = useState(0)
  const [prompt, setPrompt] = useState("")
  const [selectedRisk, setSelectedRisk] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const navigate = useNavigate()
  const loadingMessages = getLoadingMessages(mode, t)

  // RTK query state
  const { data: riskData } = useGetAllRisksQuery({
    page: 1,
    limit: 1000,
    searchTerm: "",
    siteId: "",
    category: "",
  })

  const [generateTemplateWithPrompt] = useGenerateTemplateWithPromptMutation()
  const [generateTemplateWithPdf] = useGenerateTemplateWithPdfMutation()
  const [generateTemplateWithRisk] = useGenerateTemplateWithRiskMutation()

  const resetAll = () => {
    setPrompt("")
    setSelectedRisk("")
    setFile(null)
  }

  const handleModeChange = (newMode: CreationMode) => {
    if (mode === newMode) return
    resetAll() // Clear previous input when switching
    setMode(newMode)
  }

  const handleClose = () => {
    setMode(null)
    resetAll()
    setOpen(false)
  }

  const handleCreate = async () => {
    try {
      if (!mode) return

      setIsLoading(true)

      let response

      if (mode === "prompt") {
        response = await generateTemplateWithPrompt({
          prompt,
        }).unwrap()
      }

      if (mode === "file") {
        const formData = new FormData()
        formData.append("file", file!)

        response = await generateTemplateWithPdf(formData).unwrap()
      }

      if (mode === "risk") {
        response = await generateTemplateWithRisk({
          riskId: selectedRisk,
        }).unwrap()
      }

      if (response?.success) {
        toast.success(t("organization.templates.ai.createSuccess"))
        navigate("/organization/audit/templates")
      }

      handleClose()
    } catch (error: any) {
      toast.error(error?.data?.message || t("organization.templates.ai.createFailed"))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isLoading) {
      setMessageIndex(0)
      return
    }

    const messages = getLoadingMessages(mode, t)

    const interval = setInterval(() => {
      setMessageIndex((prev) => {
        if (prev >= messages.length - 1) {
          return prev // stay on last message
        }

        return prev + 1
      })
    }, 2000)

    return () => clearInterval(interval)
  }, [isLoading, mode, t])

  useEffect(() => {
    setMessageIndex(0)
  }, [mode])

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
        className={`sm:max-w-md ${isLoading ? "pointer-events-none" : ""}`}
      >
        {/* Loader Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-5">
              <div className="relative">
                <div className="h-14 w-14 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
              </div>

              {/* Phase C (theme-improvement-initiative): was framer-motion's
                  AnimatePresence/motion.p, the library's only usage site in
                  this repo -- replaced with the same CSS-only entrance
                  pattern (animate-fade-in, src/index.css) every other
                  reveal-on-mount in this app already uses, so this is the
                  one place motion in this file relies on a dependency
                  nothing else does. The `key` change on messageIndex forces
                  a real remount, which is what re-triggers the CSS
                  animation each time the loading message cycles.
                  animate-fade-in already collapses to an instant, static
                  end-state under prefers-reduced-motion (shared media query
                  in index.css) -- framer-motion's transition had no
                  reduced-motion handling at all. */}
              <p
                key={messageIndex}
                className="animate-fade-in text-center text-sm font-medium text-muted-foreground"
              >
                {loadingMessages[messageIndex]}
              </p>
            </div>
          </div>
        )}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            {t("organization.templates.ai.title")}
          </DialogTitle>
          <DialogDescription>
            {t("organization.templates.ai.subtitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Prompt Option */}
          <button
            type="button"
            onClick={() => handleModeChange("prompt")}
            className={`focus-ring flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all hover:bg-secondary ${
              mode === "prompt"
                ? "border-primary bg-primary/5"
                : "border-border"
            }`}
          >
            <FileText className="h-6 w-6 text-primary" />
            <div>
              <p className="font-medium">{t("organization.templates.ai.promptOption.title")}</p>
              <p className="text-sm text-muted-foreground">
                {t("organization.templates.ai.promptOption.desc")}
              </p>
            </div>
          </button>

          {/* File Option */}
          <button
            type="button"
            onClick={() => handleModeChange("file")}
            className={`focus-ring flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all hover:bg-secondary ${
              mode === "file" ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <Upload className="h-6 w-6 text-primary" />
            <div>
              <p className="font-medium">{t("organization.templates.ai.fileOption.title")}</p>
              <p className="text-sm text-muted-foreground">
                {t("organization.templates.ai.fileOption.desc")}
              </p>
            </div>
          </button>

          {/* Risk Option */}
          <button
            type="button"
            onClick={() => handleModeChange("risk")}
            className={`focus-ring flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all hover:bg-secondary ${
              mode === "risk" ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <AlertCircleIcon className="h-6 w-6 text-primary" />
            <div>
              <p className="font-medium">{t("organization.templates.ai.riskOption.title")}</p>
              <p className="text-sm text-muted-foreground">
                {t("organization.templates.ai.riskOption.desc")}
              </p>
            </div>
          </button>

          {/* Conditional Input Fields */}
          {mode === "prompt" && (
            <div className="pt-2">
              <Label htmlFor="prompt">{t("organization.templates.ai.promptLabel")}</Label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t("organization.templates.ai.promptPlaceholder")}
                rows={5}
                className="mt-2"
              />
            </div>
          )}

          {mode === "file" && (
            <div>
              <label
                htmlFor="file"
                className="block text-sm text-muted-foreground"
              >
                {t("organization.templates.ai.uploadFile")}
              </label>

              <label
                htmlFor="dropzone-file"
                className="mx-auto mt-2 flex w-full max-w-lg cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-border bg-card p-5 text-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  className="h-8 w-8 text-muted-foreground"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
                  />
                </svg>

                <h2 className="mt-1 font-medium tracking-wide text-foreground">
                  {t("organization.templates.ai.anyFile")}
                </h2>

                <p className="mt-2 text-xs tracking-wide text-muted-foreground">
                  {t("organization.templates.ai.dropHint")}{" "}
                </p>

                <input
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  id="dropzone-file"
                  type="file"
                  className="hidden"
                />
              </label>
              {file && (
                <p className={`mt-1 text-xs ${severityTextClasses("low")}`}>
                  {t("organization.templates.ai.selectedFile", { name: file.name })}
                </p>
              )}
            </div>
          )}

          {mode === "risk" && (
            <div className="w-full pt-2">
              <Label>{t("organization.templates.ai.selectRisk")}</Label>

              <Select value={selectedRisk} onValueChange={setSelectedRisk}>
                <SelectTrigger className="mt-2 w-full">
                  <SelectValue placeholder={t("organization.templates.ai.chooseRisk")} />
                </SelectTrigger>

                <SelectContent className="rounded-lg">
                  {riskData?.data?.map((risk: Risk) => (
                    <SelectItem value={risk.id} key={risk.id} className="py-1">
                      {risk.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t("organization.templates.create.cancel")}
          </Button>
          <Button onClick={handleCreate} disabled={!mode || isLoading}>
            {isLoading
              ? t("organization.templates.ai.generating")
              : t("organization.templates.ai.generateTemplate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
