import { Database, Eye, Lock, Mail, Share2, ShieldCheck } from "lucide-react"
import { useTranslation } from "react-i18next"

const PrivacyPolicy = () => {
  const { t } = useTranslation()
  const lastUpdated = "February 24, 2026"

  const dataCards = [
    {
      icon: <Database className="h-6 w-6 text-primary" />,
      title: t("pages.policy.privacy.cards.collect.title"),
      items: t("pages.policy.privacy.cards.collect.items", {
        returnObjects: true,
      }) as string[],
    },
    {
      icon: <Eye className="h-6 w-6 text-primary" />,
      title: t("pages.policy.privacy.cards.use.title"),
      items: t("pages.policy.privacy.cards.use.items", {
        returnObjects: true,
      }) as string[],
    },
    {
      icon: <Share2 className="h-6 w-6 text-primary" />,
      title: t("pages.policy.privacy.cards.sharing.title"),
      items: t("pages.policy.privacy.cards.sharing.items", {
        returnObjects: true,
      }) as string[],
    },
  ]

  const rights = t("pages.policy.privacy.sections.rights", {
    returnObjects: true,
  }) as { intro: string; item1: string; item2: string; item3: string; item4: string }

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground">
      {/* Hero Header */}
      <header className="border-b border-border bg-linear-to-b from-card to-background px-4 pt-24 pb-16">
        <div className="container mx-auto text-center">
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
            <Lock className="h-8 w-8 text-primary" />
          </div>

          <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
            {t("pages.policy.privacy.pageTitle")}
          </h1>

          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            {t("pages.policy.privacy.intro")}
          </p>

          <div className="mt-6 font-mono text-sm text-primary">
            {t("pages.policy.privacy.lastUpdated", { date: lastUpdated })}
          </div>
        </div>
      </header>

      <main className="container mx-auto mt-4 max-w-5xl px-4">
        {/* Highlights Grid */}
        <div className="mb-16 grid gap-6 md:grid-cols-3">
          {dataCards.map((card, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/30"
            >
              <div className="mb-4">{card.icon}</div>
              <h3 className="mb-4 text-lg font-semibold">{card.title}</h3>
              <ul className="space-y-2.5">
                {card.items.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Detailed Text Sections */}
        <div className="space-y-16">
          {/* 1. Data Security & Storage */}
          <section>
            <h2 className="mb-6 flex items-center gap-3 text-2xl font-semibold">
              <ShieldCheck className="h-6 w-6 text-primary" />
              {t("pages.policy.privacy.sections.security.title")}
            </h2>
            <div className="prose prose-neutral dark:prose-invert max-w-none leading-relaxed text-muted-foreground">
              <p>{t("pages.policy.privacy.sections.security.body1")}</p>
              <p className="mt-4">
                {t("pages.policy.privacy.sections.security.body2")}
              </p>
            </div>
          </section>

          {/* 2. Cookies and Tracking */}
          <section className="rounded-2xl border border-border bg-card p-8">
            <h2 className="mb-6 text-2xl font-semibold">
              {t("pages.policy.privacy.sections.cookies.title")}
            </h2>
            <p className="leading-relaxed text-muted-foreground">
              {t("pages.policy.privacy.sections.cookies.body")}
            </p>
          </section>

          {/* 3. Your Rights & Control */}
          <section>
            <h2 className="mb-6 text-2xl font-semibold">
              {t("pages.policy.privacy.sections.rights.title")}
            </h2>
            <p className="mb-8 text-muted-foreground">{rights.intro}</p>

            <div className="grid gap-4 sm:grid-cols-2">
              {[rights.item1, rights.item2, rights.item3, rights.item4].map(
                (right, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-5"
                  >
                    <div className="shrink-0 text-xl font-bold text-primary">
                      ✓
                    </div>
                    <span className="text-sm leading-snug">{right}</span>
                  </div>
                ),
              )}
            </div>
          </section>

          {/* Contact/Support Footer */}
          <section className="mt-20 border-t border-border py-12 text-center">
            <div className="mx-auto max-w-2xl rounded-3xl border border-primary/20 bg-linear-to-br from-primary/5 to-transparent p-10">
              <Mail className="mx-auto mb-6 h-12 w-12 text-primary" />
              <h3 className="mb-3 text-2xl font-semibold">
                {t("pages.policy.privacy.footer.title")}
              </h3>
              <p className="mb-8 text-muted-foreground">
                {t("pages.policy.privacy.footer.body")}
              </p>
              <a
                href="mailto:privacy@yourcompany.com"
                className="inline-flex items-center gap-2 font-semibold text-primary hover:underline"
              >
                privacy@yourcompany.com
              </a>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

export default PrivacyPolicy
