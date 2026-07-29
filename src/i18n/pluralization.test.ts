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
})
