import { Text } from "lucide-react"
import { useTranslation } from "react-i18next"

export default function UnSplitText({ unSplitText }: { unSplitText: string }) {
  const { t } = useTranslation()
  // Generate button view
  if (!unSplitText) {
    return (
      <div className="rounded-md" id="unsplit-page">
        <div className="mx-auto">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border p-6 md:p-8">
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 rounded-full bg-primary/10 p-3">
                  <Text className="h-8 w-8 text-primary" />
                </div>
                <h2 className="mb-2 text-2xl font-bold">
                  {t("organization.inspection.noUnsplitTextTitle")}
                </h2>
                <p className="mb-6 text-muted-foreground">
                  {t("organization.inspection.noUnsplitTextTip")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div id="unsplit-page">
      <div className="mx-auto">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-6 md:p-8">
            <div className="flex flex-col items-center text-center">
              <h2 className="mb-2 text-2xl font-bold">
                {t("organization.inspection.unsplitText")}
              </h2>
              <p className="mb-6 text-justify text-muted-foreground">{unSplitText}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
