import { Clock, FileText, Scale, ShieldCheck } from "lucide-react"

const TermsAndConditions = () => {
  const sections = [
    { id: "acceptance", title: "1. Acceptance of Terms" },
    { id: "services", title: "2. Description of Services" },
    { id: "accounts", title: "3. User Accounts & Security" },
    { id: "privacy", title: "4. Privacy & Data Protection" },
    { id: "usage", title: "5. Acceptable Use Policy" },
    { id: "termination", title: "6. Termination" },
    { id: "liability", title: "7. Limitation of Liability" },
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
            Terms & Conditions
          </h1>

          <p className="flex items-center justify-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            Last Updated: October 24, 2023
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
                Table of Contents
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
                Acceptance of Terms
              </h2>
              <div className="prose prose-neutral dark:prose-invert max-w-none">
                <div className="rounded-xl border border-border bg-card p-7 leading-relaxed">
                  <p>
                    By accessing or using our platform, you agree to be bound by
                    these Terms and Conditions and all applicable laws and
                    regulations. If you do not agree with any of these terms,
                    you are prohibited from using or accessing this site.
                  </p>
                  <p className="mt-4">
                    The materials contained in this website are protected by
                    applicable copyright and trademark law.
                  </p>
                </div>
              </div>
            </section>

            {/* 2. Description of Services */}
            <section id="services">
              <h2 className="mb-6 flex items-center gap-3 text-2xl font-semibold">
                <span className="font-mono text-primary">02</span>
                Description of Services
              </h2>
              <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
                <p className="text-muted-foreground">
                  Our platform provides a digital suite for workplace
                  inspections, operational management, and frontline workforce
                  coordination. Services include:
                </p>
                <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
                  <li>Digital inspection form creation and distribution.</li>
                  <li>Real-time action assignment and tracking.</li>
                  <li>Multi-site management and user permission controls.</li>
                  <li>Automated reporting and data analytics.</li>
                </ul>
              </div>
            </section>

            {/* 3. User Accounts & Security */}
            <section id="accounts">
              <h2 className="mb-6 flex items-center gap-3 text-2xl font-semibold">
                <span className="font-mono text-primary">03</span>
                User Accounts & Security
              </h2>
              <div className="rounded-xl border-l-4 border-primary bg-card/80 p-7">
                <p className="text-muted-foreground">
                  Users are responsible for maintaining the confidentiality of
                  their account credentials. You agree to notify us immediately
                  of any unauthorized use of your account. We cannot and will
                  not be liable for any loss or damage arising from your failure
                  to comply with this security obligation.
                </p>
              </div>
            </section>

            {/* 7. Limitation of Liability */}
            <section id="liability">
              <h2 className="mb-6 flex items-center gap-3 text-2xl font-semibold">
                <span className="font-mono text-primary">07</span>
                Limitation of Liability
              </h2>
              <div className="rounded-xl border border-dashed border-destructive/30 bg-destructive/5 p-7">
                <p className="mb-3 text-xs tracking-widest text-muted-foreground uppercase">
                  Legal Notice
                </p>
                <p className="text-muted-foreground">
                  In no event shall the Company or its suppliers be liable for
                  any damages (including, without limitation, damages for loss
                  of data or profit, or due to business interruption) arising
                  out of the use or inability to use the materials on our
                  platform.
                </p>
              </div>
            </section>

            {/* Summary Footer Box */}
            <div className="mt-20 rounded-3xl border border-border bg-linear-to-br from-card to-card/80 p-10 text-center">
              <Scale className="mx-auto mb-6 h-12 w-12 text-primary" />

              <h3 className="mb-3 text-2xl font-semibold">
                Have questions about our terms?
              </h3>
              <p className="mx-auto mb-8 max-w-md text-muted-foreground">
                Our legal team is here to help you understand how we protect
                your business.
              </p>

              <button className="rounded-xl bg-primary px-10 py-3.5 font-medium text-primary-foreground transition-all hover:bg-primary/90">
                Contact Legal Team
              </button>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default TermsAndConditions
