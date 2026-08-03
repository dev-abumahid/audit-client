import i18next from "i18next"
import en from "./locales/en.json"
import fr from "./locales/fr.json"

// This suite initializes its own real i18next instance (not the app's
// shared singleton in i18n.ts, and not mocked away like most component
// tests do) specifically so pluralization/interpolation is resolved for
// real against the actual locale JSON -- most other test files never
// trigger i18n.ts's side-effect init, so their t() calls just echo the raw
// key back and can't catch a wrong plural suffix or a bad interpolation
// position in the resource files themselves.
describe("locale resource pluralization/interpolation", () => {
  let t: (key: string, opts?: Record<string, unknown>) => string

  beforeAll(async () => {
    const instance = i18next.createInstance()
    await instance.init({
      lng: "en",
      resources: {
        en: { translation: en },
        fr: { translation: fr },
      },
      interpolation: { escapeValue: false },
    })
    t = (key, opts) => instance.t(key, opts)
    // expose changeLanguage on the closure for the tests below
    ;(t as unknown as { instance: typeof instance }).instance = instance
  })

  // Regression: organization.compliance.subtitle was a single un-pluralized
  // key ("{{count}} obligations tracked"), so a single obligation rendered
  // "1 obligations tracked". Split into subtitle_one/subtitle_other.
  it("pluralizes the compliance subtitle correctly in English", () => {
    expect(t("organization.compliance.subtitle", { count: 1 })).toBe(
      "1 obligation tracked"
    )
    expect(t("organization.compliance.subtitle", { count: 0 })).toBe(
      "0 obligations tracked"
    )
    expect(t("organization.compliance.subtitle", { count: 5 })).toBe(
      "5 obligations tracked"
    )
  })

  it("pluralizes the compliance subtitle correctly in French, with the correct singular form", async () => {
    const instance = (
      t as unknown as { instance: import("i18next").i18n }
    ).instance
    await instance.changeLanguage("fr")
    try {
      expect(t("organization.compliance.subtitle", { count: 1 })).toBe(
        "1 obligation suivie"
      )
      expect(t("organization.compliance.subtitle", { count: 3 })).toBe(
        "3 obligations suivies"
      )
    } finally {
      await instance.changeLanguage("en")
    }
  })

  // Regression (issue #353): organization.riskRegister.subtitle was a single
  // un-pluralized "Risks found" key with no count at all. Split into
  // subtitle_one/subtitle_other.
  it("pluralizes the risk register subtitle correctly in English", () => {
    expect(t("organization.riskRegister.subtitle", { count: 1 })).toBe(
      "1 risk found"
    )
    expect(t("organization.riskRegister.subtitle", { count: 0 })).toBe(
      "0 risks found"
    )
    expect(t("organization.riskRegister.subtitle", { count: 4 })).toBe(
      "4 risks found"
    )
  })

  it("pluralizes the risk register subtitle correctly in French", async () => {
    const instance = (
      t as unknown as { instance: import("i18next").i18n }
    ).instance
    await instance.changeLanguage("fr")
    try {
      expect(t("organization.riskRegister.subtitle", { count: 1 })).toBe(
        "1 risque trouvé"
      )
      expect(t("organization.riskRegister.subtitle", { count: 3 })).toBe(
        "3 risques trouvés"
      )
    } finally {
      await instance.changeLanguage("en")
    }
  })

  // Regression (issue #356): organization.riskGraph.legendCauses/
  // legendAmplifies/legendCorrelates were literal untranslated
  // "CAUSES"/"AMPLIFIES"/"CORRELATES" in both en.json and fr.json, unlike
  // the sibling legendTippingPoint key and the correctly-localized
  // organization.correlationMatrix.linkTypeCauses/etc. keys used elsewhere.
  // Assert both key families now agree in each locale.
  it("translates the risk graph link-type legend, matching correlationMatrix's linkType keys", () => {
    expect(t("organization.riskGraph.legendCauses")).toBe(
      t("organization.correlationMatrix.linkTypeCauses")
    )
    expect(t("organization.riskGraph.legendAmplifies")).toBe(
      t("organization.correlationMatrix.linkTypeAmplifies")
    )
    expect(t("organization.riskGraph.legendCorrelates")).toBe(
      t("organization.correlationMatrix.linkTypeCorrelates")
    )
    expect(t("organization.riskGraph.legendCauses")).not.toBe("CAUSES")
    expect(t("organization.riskGraph.legendAmplifies")).not.toBe("AMPLIFIES")
    expect(t("organization.riskGraph.legendCorrelates")).not.toBe(
      "CORRELATES"
    )
  })

  it("translates the risk graph link-type legend in French too", async () => {
    const instance = (
      t as unknown as { instance: import("i18next").i18n }
    ).instance
    await instance.changeLanguage("fr")
    try {
      expect(t("organization.riskGraph.legendCauses")).toBe(
        t("organization.correlationMatrix.linkTypeCauses")
      )
      expect(t("organization.riskGraph.legendAmplifies")).toBe(
        t("organization.correlationMatrix.linkTypeAmplifies")
      )
      expect(t("organization.riskGraph.legendCorrelates")).toBe(
        t("organization.correlationMatrix.linkTypeCorrelates")
      )
    } finally {
      await instance.changeLanguage("en")
    }
  })

  // Regression follow-up (issue #360, found in independent review):
  // organization.kri.frequency.<value> only has daily/weekly/monthly/
  // quarterly keys, but kri.frequency is an open string field (not a closed
  // enum) -- an unexpected/legacy value would otherwise fall back to
  // i18next's raw-key-path text ("organization.kri.frequency.biweekly")
  // instead of the old code's plain raw-value display. KriDashboardPage.tsx
  // passes `{ defaultValue: kri.frequency }` so an unrecognized value still
  // renders as itself rather than a raw i18n key path.
  it("falls back to the raw frequency value for a KRI frequency with no matching translation key", () => {
    expect(
      t("organization.kri.frequency.biweekly", { defaultValue: "biweekly" })
    ).toBe("biweekly")
    // A recognized key still resolves to its real translation, not the
    // defaultValue fallback.
    expect(
      t("organization.kri.frequency.quarterly", { defaultValue: "quarterly" })
    ).toBe("Quarterly")
  })

  // Regression: the French priority badge concatenated two separately-
  // translated fragments assuming English word order ("{{level}} Priority"),
  // which read backwards in French ("Élevée Priorité"). Now a single
  // interpolated key per locale controls its own word order.
  it("puts the priority level in the grammatically correct position for each locale", async () => {
    const instance = (
      t as unknown as { instance: import("i18next").i18n }
    ).instance

    expect(
      t("organization.findings.priorityLabel", { level: "High" })
    ).toBe("High Priority")

    await instance.changeLanguage("fr")
    try {
      expect(
        t("organization.findings.priorityLabel", { level: "Élevée" })
      ).toBe("Priorité Élevée")
    } finally {
      await instance.changeLanguage("en")
    }
  })

  // Regression (issue #432): admin.onboarding.review.selectedSummary and
  // admin.onboarding.done.banner interpolated {{risks}}/{{kris}}/{{sites}}
  // directly with no plural handling, so a single risk/site/KRI read
  // "1 risks and 1 KRIs selected". Each count now has its own risksCount/
  // krisCount/sitesCount _one/_other pair, composed into the sentence.
  it("pluralizes each independent count in the onboarding review summary", () => {
    expect(
      t("admin.onboarding.review.selectedSummary", {
        risksText: t("admin.onboarding.review.risksCount", { count: 1 }),
        krisText: t("admin.onboarding.review.krisCount", { count: 1 }),
      })
    ).toBe("1 risk and 1 KRI selected")
    expect(
      t("admin.onboarding.review.selectedSummary", {
        risksText: t("admin.onboarding.review.risksCount", { count: 3 }),
        krisText: t("admin.onboarding.review.krisCount", { count: 5 }),
      })
    ).toBe("3 risks and 5 KRIs selected")
  })

  it("pluralizes each independent count in the onboarding done banner", () => {
    expect(
      t("admin.onboarding.done.banner", {
        sitesText: t("admin.onboarding.done.sitesCount", { count: 1 }),
        risksText: t("admin.onboarding.done.risksCount", { count: 1 }),
        krisText: t("admin.onboarding.done.krisCount", { count: 1 }),
      })
    ).toBe(
      "1 site, 1 risk and 1 KRI were AI-generated during setup — review recommended before relying on them."
    )
    expect(
      t("admin.onboarding.done.banner", {
        sitesText: t("admin.onboarding.done.sitesCount", { count: 2 }),
        risksText: t("admin.onboarding.done.risksCount", { count: 4 }),
        krisText: t("admin.onboarding.done.krisCount", { count: 6 }),
      })
    ).toBe(
      "2 sites, 4 risks and 6 KRIs were AI-generated during setup — review recommended before relying on them."
    )
  })

  it("pluralizes the onboarding summary counts in French, with KRI kept invariant", async () => {
    const instance = (
      t as unknown as { instance: import("i18next").i18n }
    ).instance
    await instance.changeLanguage("fr")
    try {
      expect(
        t("admin.onboarding.review.selectedSummary", {
          risksText: t("admin.onboarding.review.risksCount", { count: 1 }),
          krisText: t("admin.onboarding.review.krisCount", { count: 1 }),
        })
      ).toBe("1 risque et 1 KRI sélectionnés")
      expect(
        t("admin.onboarding.review.selectedSummary", {
          risksText: t("admin.onboarding.review.risksCount", { count: 2 }),
          krisText: t("admin.onboarding.review.krisCount", { count: 3 }),
        })
      ).toBe("2 risques et 3 KRI sélectionnés")
    } finally {
      await instance.changeLanguage("en")
    }
  })
})
