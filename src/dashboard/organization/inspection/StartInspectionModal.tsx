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
import { useDebouncedValue } from "@/hooks/Usedebouncedvalue"
import { useGetAllSitesQuery } from "@/redux/apis/organization/sites.api"
import { useGetAllTemplatesQuery } from "@/redux/apis/organization/template.api"
import type { SiteSummary } from "@/types/organization"
import type { TemplateSummary } from "@/types/template"
import { isSystemTemplateName } from "@/utils/isSystemTemplate"
import { Check, ChevronDown, FileText, Globe } from "lucide-react"
import { useId, useState } from "react"
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
  // quality-bar-loop round 2 (accessibility): aria-labelledby on the
  // trigger buttons below needs to combine the static field label with
  // each trigger's own dynamic text (the selected site/template name) --
  // pointing aria-labelledby at ONLY the static label would replace the
  // button's own text-derived accessible name entirely (buttons are
  // labelable elements), the same bug found and fixed on AuditPage's
  // RiskMultiSelect this session.
  const siteStateTextId = useId()
  const templateStateTextId = useId()
  const navigate = useNavigate()

  // quality-bar-loop (Inspections, round 8, efficiency finding): both
  // search inputs fed straight into their query's searchTerm on every
  // keystroke, firing one network request per character -- inconsistent
  // with InspectionTable.tsx's own search box, which already debounces
  // 500ms (issue #243) using this same shared hook.
  const debouncedSiteSearch = useDebouncedValue(siteSearch)
  const debouncedTemplateSearch = useDebouncedValue(templateSearch)

  // quality-bar-loop (Inspections, round 5, resilience finding): neither
  // query checked isError -- a genuine fetch failure rendered the same
  // "no site/template found" empty state as a legitimately empty org,
  // silently blocking inspection creation with no indication the fetch
  // itself failed. Same bug class InspectionTable.tsx already fixed for
  // itself.
  // quality-bar-loop (Inspections, round 39, efficiency finding): this
  // modal is always mounted by InspectionTable.tsx (only `open` toggles),
  // and these two queries used to fire unconditionally on mount -- the
  // sites one unbounded up to 1000 rows. Every visit to the inspections
  // list page paid that cost before the user ever clicked "Start
  // Inspection." Same fix pattern already proven for CreateNewFindingModal.tsx
  // (round 37).
  const { data: sitesData, isError: isSitesError } = useGetAllSitesQuery(
    {
      page: 1,
      limit: 1000,
      searchTerm: debouncedSiteSearch,
    },
    { skip: !open }
  )
  const {
    data: templatesData,
    isLoading,
    isError: isTemplatesError,
  } = useGetAllTemplatesQuery(
    {
      page: 1,
      limit: 100,
      searchTerm: debouncedTemplateSearch,
      // quality-bar-loop round 5 (industry-standards): exclude drafts --
      // starting a real inspection against an unfinished checklist would
      // silently produce an incomplete report with no warning.
      status: "PUBLISHED",
    },
    { skip: !open }
  )

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

  // quality-bar-loop round 2 (UX, round-1 finding): the protected system
  // template ("AI-Generated Findings, do not edit") was live-confirmed
  // selectable here, with nothing stopping a real inspection from being
  // started against it -- same exclusion TemplatesPage.tsx already
  // applies to Edit/Delete for the identical template.
  const selectableTemplates = (templatesData?.data ?? []).filter(
    (temp: TemplateSummary) => !isSystemTemplateName(temp.templateName)
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
            <label
              id="start-inspection-site-label"
              className="flex items-center gap-2 text-sm font-medium text-foreground"
            >
              <Globe className="h-4 w-4 text-muted-foreground" />
              {t("organization.inspection.selectSite")}
            </label>

            <Popover open={siteOpen} onOpenChange={setSiteOpen}>
              <PopoverTrigger asChild>
                {/* quality-bar-loop round 2 (mobile, round-1 finding): the
                    shared Button's default height (h-7) is well under the
                    44px touch-target guideline, same bug class fixed on
                    9+ pages this session. aria-labelledby combines the
                    static field label with this span's own dynamic text
                    (see siteStateTextId comment above). */}
                <Button
                  variant="outline"
                  role="combobox"
                  aria-labelledby={`start-inspection-site-label ${siteStateTextId}`}
                  className="h-11 w-full justify-between"
                >
                  <span id={siteStateTextId}>
                    {selectedSite
                      ? selectedSite.name
                      : t("organization.inspection.chooseSite")}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-(--radix-popover-trigger-width) p-0"
                align="start"
                sideOffset={4}
              >
                {/* review follow-up (round 8): the site/template list is
                    already filtered server-side via the debounced
                    searchTerm above -- cmdk's own default client-side
                    fuzzy filter would otherwise re-filter that list
                    against the RAW (non-debounced) search text, which can
                    transiently hide a result that already matches the
                    server's response, or show CommandEmpty prematurely
                    during the debounce window. */}
                <Command shouldFilter={false}>
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
                      <span role={isSitesError ? "alert" : undefined}>
                        {isSitesError
                          ? t("organization.inspection.sitesLoadError")
                          : t("organization.inspection.noSiteFound")}
                      </span>
                    </CommandEmpty>
                    <CommandGroup>
                      {sitesData?.data?.map((site: SiteSummary) => (
                        <CommandItem
                          className="h-11 w-full"
                          key={site.id}
                          value={site.name}
                          onSelect={() => {
                            setValue("siteId", site.id)
                            setSiteOpen(false)
                            // review follow-up (round 8): the template
                            // branch already clears its search on select;
                            // this one didn't, so a leftover search term
                            // plus this round's debounce widened a
                            // pre-existing gap -- the debounced refetch
                            // could land after selection with a list that
                            // no longer contains the selected site,
                            // silently clearing `selectedSite` (derived by
                            // find()) while `selectedSiteId` stays set.
                            setSiteSearch("")
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
            <label
              id="start-inspection-template-label"
              className="flex items-center gap-2 text-sm font-medium text-foreground"
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
              {t("organization.inspection.selectTemplate")}
            </label>

            <Popover open={templateOpen} onOpenChange={setTemplateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-labelledby={`start-inspection-template-label ${templateStateTextId}`}
                  className="h-11 w-full justify-between"
                >
                  <span id={templateStateTextId}>
                    {selectedTemplate
                      ? selectedTemplate.templateName
                      : t("organization.inspection.chooseTemplate")}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                {/* review follow-up (round 8): the site/template list is
                    already filtered server-side via the debounced
                    searchTerm above -- cmdk's own default client-side
                    fuzzy filter would otherwise re-filter that list
                    against the RAW (non-debounced) search text, which can
                    transiently hide a result that already matches the
                    server's response, or show CommandEmpty prematurely
                    during the debounce window. */}
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder={t(
                      "organization.inspection.searchTemplatesPlaceholder"
                    )}
                    value={templateSearch}
                    onValueChange={setTemplateSearch}
                  />
                  <CommandList>
                    <CommandEmpty>
                      <span role={isTemplatesError ? "alert" : undefined}>
                        {isLoading
                          ? t("organization.inspection.loadingShort")
                          : isTemplatesError
                            ? t("organization.inspection.templatesLoadError")
                            : t("organization.inspection.noTemplateFound")}
                      </span>
                    </CommandEmpty>
                    <CommandGroup>
                      {selectableTemplates.map((temp: TemplateSummary) => (
                        <CommandItem
                          className="h-11"
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
              <Button type="button" variant="outline" size="touch">
                {t("organization.inspection.cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={!selectedSiteId || !selectedTemplateId}
              size="touch"
            >
              {t("organization.inspection.startInspection")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
