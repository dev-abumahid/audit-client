import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useGetAllSitesQuery } from "@/redux/apis/organization/sites.api"
import { useGetAllTemplatesQuery } from "@/redux/apis/organization/template.api"
import type { SiteSummary } from "@/types/organization"
import type { TemplateSummary } from "@/types/template"
import { Check, ChevronDown, FileText, Globe } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"

type FormData = {
  siteId: string
  templateId: string
}

type Props = {
  open: boolean
  setOpen: (value: boolean) => void
}

export default function StartInspectionModal({ open, setOpen }: Props) {
  const { t } = useTranslation()
  const [siteOpen, setSiteOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [templateSearch, setTemplateSearch] = useState("")
  const [siteSearch, setSiteSearch] = useState("")
  const navigate = useNavigate()

  const { data: sitesData } = useGetAllSitesQuery({
    page: 1,
    limit: 1000,
    searchTerm: siteSearch,
  })
  const { data: templatesData, isLoading } = useGetAllTemplatesQuery({
    page: 1,
    limit: 100,
    searchTerm: templateSearch,
  })

  const { handleSubmit, watch, setValue } = useForm<FormData>({
    defaultValues: { siteId: "", templateId: "" },
  })

  const selectedSiteId = watch("siteId")
  const selectedTemplateId = watch("templateId")

  const selectedSite = sitesData?.data?.find(
    (s: SiteSummary) => s.id === selectedSiteId
  )

  const selectedTemplate = templatesData?.data?.find(
    (t: TemplateSummary) => t.id === selectedTemplateId
  )

  const onSubmit = (data: FormData) => {
    // Guards a real gap the previous untyped `any` on selectedSite masked:
    // the submit button only checks the ids are set (selectedSiteId /
    // selectedTemplateId), not that the site/template list has finished
    // loading and actually contains a matching row. Navigating with
    // siteName: undefined would silently show a blank site name on the next
    // page instead of surfacing that something's wrong. Found while typing
    // this endpoint (issue #108).
    if (!selectedSite) return
    navigate("/organization/audit/inspection/create", {
      state: {
        siteId: data.siteId,
        templateId: data.templateId,
        siteName: selectedSite.name,
      },
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("organization.inspection.startNewInspection")}
          </DialogTitle>
          <DialogDescription>
            {t("organization.inspection.startModalDescription")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Site Selection */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Globe className="h-4 w-4 text-muted-foreground" />
              {t("organization.inspection.selectSite")}
            </label>

            <Popover open={siteOpen} onOpenChange={setSiteOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {selectedSite
                    ? selectedSite.name
                    : t("organization.inspection.chooseSite")}
                  <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-(--radix-popover-trigger-width) p-0"
                align="start"
                sideOffset={4}
              >
                <Command>
                  <CommandInput
                    placeholder={t(
                      "organization.inspection.searchSitePlaceholder"
                    )}
                    value={siteSearch}
                    onValueChange={setSiteSearch}
                    className="w-full"
                  />
                  <CommandList>
                    <CommandEmpty>
                      {t("organization.inspection.noSiteFound")}
                    </CommandEmpty>
                    <CommandGroup>
                      {sitesData?.data?.map((site: SiteSummary) => (
                        <CommandItem
                          className="w-full"
                          key={site.id}
                          value={site.name}
                          onSelect={() => {
                            setValue("siteId", site.id)
                            setSiteOpen(false)
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              selectedSiteId === site.id
                                ? "opacity-100"
                                : "opacity-0"
                            }`}
                          />
                          {site.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Template Selection */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileText className="h-4 w-4 text-muted-foreground" />
              {t("organization.inspection.selectTemplate")}
            </label>

            <Popover open={templateOpen} onOpenChange={setTemplateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {selectedTemplate
                    ? selectedTemplate.templateName
                    : t("organization.inspection.chooseTemplate")}
                  <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder={t(
                      "organization.inspection.searchTemplatesPlaceholder"
                    )}
                    value={templateSearch}
                    onValueChange={setTemplateSearch}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {isLoading
                        ? t("organization.inspection.loadingShort")
                        : t("organization.inspection.noTemplateFound")}
                    </CommandEmpty>
                    <CommandGroup>
                      {templatesData?.data?.map((temp: TemplateSummary) => (
                        <CommandItem
                          key={temp.id}
                          value={temp.templateName}
                          onSelect={() => {
                            setValue("templateId", temp.id)
                            setTemplateOpen(false)
                            setTemplateSearch("")
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              selectedTemplateId === temp.id
                                ? "opacity-100"
                                : "opacity-0"
                            }`}
                          />
                          {temp.templateName}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t("organization.inspection.cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={!selectedSiteId || !selectedTemplateId}
            >
              {t("organization.inspection.startInspection")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
