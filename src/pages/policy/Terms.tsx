import { Clock, FileText, Scale, ShieldCheck } from "lucide-react"
import { useTranslation } from "react-i18next"

const TermsAndConditions = () => {
  const { t } = useTranslation()

  const sections = [
    { id: "acceptance", title: t("pages.policy.terms.toc.acceptance") },
    { id: "services", title: t("pages.policy.terms.toc.services") },
    { id: "accounts", title: t("pages.policy.terms.toc.accounts") },
    { id: "privacy", title: t("pages.policy.terms.toc.privacy") },
    { id: "usage", title: t("pages.policy.terms.toc.usage") },
    { id: "termination", title: t("pages.policy.terms.toc.termination") },
    { id: "liability", title: t("pages.policy.terms.toc.liability") },
  ]

  return (
    <div className="min-h-screen bg-background pb-20 font-sans text-foreground">
      {/* Header */}
      <div className="relative border-b border-border bg-card pt-20 pb-12">
        <div className="container mx-auto px-4 text-center">
          <div className="mb-6 inline-flex items-center justify-center rounded-full bg-primary/10 p-3">
            <ShieldCheck className="h-9 w-9 text-primary" />
          </div>

          <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
            {t("pages.policy.terms.pageTitle")}
          </h1>

          <p className="flex items-center justify-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            {t("pages.policy.terms.lastUpdated", { date: "October 24, 2023" })}
          </p>
        </div>
      </div>

      <div className="container mx-auto mt-12 px-4">
        <div className="flex flex-col gap-12 lg:flex-row">
          {/* Sticky Sidebar Navigation */}
          <aside className="lg:w-1/4">
            <div className="sticky top-24 rounded-2xl border border-border bg-card p-6">
              <h4 className="mb-5 flex items-center gap-2 font-semibold text-foreground">
                <FileText className="h-4 w-4 text-primary" />
                {t("pages.policy.terms.tocHeading")}
              </h4>

              <nav className="space-y-2">
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="text-primary opacity-0 transition-all group-hover:opacity-100">
                      →
                    </span>
                    {section.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <main className="space-y-16 lg:w-3/4">
            {/* 1. Acceptance of Terms */}
            <section id="acceptance">
              <h2 className="mb-6 flex items-center gap-3 text-2xl font-semibold">
                <span className="font-mono text-primary">01</span>
                {t("pages.policy.terms.sections.acceptance.title")}
              </h2>
              <div className="prose prose-neutral dark:prose-invert max-w-none">
                <div className="rounded-xl border border-border bg-card p-7 leading-relaxed">
                  <p>{t("pages.policy.terms.sections.acceptance.body1")}</p>
                  <p className="mt-4">
                    {t("pages.policy.terms.sections.acceptance.body2")}
                  </p>
                </div>
              </div>
            </section>

            {/* 2. Description of Services */}
            <section id="services">
              <h2 className="mb-6 flex items-center gap-3 text-2xl font-semibold">
                <span className="font-mono text-primary">02</span>
                {t("pages.policy.terms.sections.services.title")}
              </h2>
              <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
                <p className="text-muted-foreground">
                  {t("pages.policy.terms.sections.services.intro")}
                </p>
                <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
                  <li>{t("pages.policy.terms.sections.services.item1")}</li>
                  <li>{t("pages.policy.terms.sections.services.item2")}</li>
                  <li>{t("pages.policy.terms.sections.services.item3")}</li>
                  <li>{t("pages.policy.terms.sections.services.item4")}</li>
                </ul>
              </div>
            </section>

            {/* 3. User Accounts & Security */}
            <section id="accounts">
              <h2 className="mb-6 flex items-center gap-3 text-2xl font-semibold">
                <span className="font-mono text-primary">03</span>
                {t("pages.policy.terms.sections.accounts.title")}
              </h2>
              <div className="rounded-xl border-l-4 border-primary bg-card/80 p-7">
                <p className="text-muted-foreground">
                  {t("pages.policy.terms.sections.accounts.body")}
                </p>
              </div>
            </section>

            {/* 7. Limitation of Liability */}
            <section id="liability">
              <h2 className="mb-6 flex items-center gap-3 text-2xl font-semibold">
                <span className="font-mono text-primary">07</span>
                {t("pages.policy.terms.sections.liability.title")}
              </h2>
              <div className="rounded-xl border border-dashed border-destructive/30 bg-destructive/5 p-7">
                <p className="mb-3 text-xs tracking-widest text-muted-foreground uppercase">
                  {t("pages.policy.terms.sections.liability.legalNotice")}
                </p>
                <p className="text-muted-foreground">
                  {t("pages.policy.terms.sections.liability.body")}
                </p>
              </div>
            </section>

            {/* Summary Footer Box */}
            <div className="mt-20 rounded-3xl border border-border bg-linear-to-br from-card to-card/80 p-10 text-center">
              <Scale className="mx-auto mb-6 h-12 w-12 text-primary" />

              <h3 className="mb-3 text-2xl font-semibold">
                {t("pages.policy.terms.footer.title")}
              </h3>
              <p className="mx-auto mb-8 max-w-md text-muted-foreground">
                {t("pages.policy.terms.footer.body")}
              </p>

              <button
                type="button"
                className="rounded-xl bg-primary px-10 py-3.5 font-medium text-primary-foreground transition-all hover:bg-primary/90"
              >
                {t("pages.policy.terms.footer.cta")}
              </button>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default TermsAndConditions
