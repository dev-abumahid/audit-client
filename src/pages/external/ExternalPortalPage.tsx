import Logo from "@/components/shared/Logo"
import { baseApi } from "@/redux/baseApi"
import { useAppDispatch, useAppSelector } from "@/redux/hooks"
import { removeExternalUser } from "@/redux/slices/externalUser.slice"
import { LogOut } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"

// Placeholder landing page (aexa-frontend#216, scoped deliberately narrow):
// the real assignment-centric view (GET /action/external/mine etc) is a
// separate follow-up ticket, since it needs its own UI built against a
// payload shape the internal findings dashboard components don't share.
// This page only proves the login flow actually lands somewhere real.
export default function ExternalPortalPage() {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const externalUser = useAppSelector((state) => state.externalUser)

  const handleLogout = () => {
    dispatch(removeExternalUser())
    // Clear cached RTK Query data (findings, sites, etc.) so a subsequent
    // login -- by this or another external user -- never sees stale
    // responses from the previous session, matching the pattern established
    // in #249 (OrganizationLayout's logOutHandler).
    dispatch(baseApi.util.resetApiState())
    // No backend sign-out call yet -- the httpOnly external_access_token
    // cookie expires on its own (12h); this only clears the client-side
    // session hint. Re-entry requires the same login link the admin
    // originally shared, matching this flow's whole design (aexa-frontend#216).
    navigate("/")
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-6 text-center">
      <Logo
        role="img"
        aria-hidden={undefined}
        aria-label={t("externalAuth.portal.logoAlt")}
        className="h-14 w-14"
      />
      <div>
        <h1 className="text-lg font-semibold text-foreground">
          {t("externalAuth.portal.greeting", {
            name: externalUser.fullName || externalUser.email,
          })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("externalAuth.portal.placeholder")}
        </p>
      </div>
      <button
        onClick={handleLogout}
        className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        {t("externalAuth.portal.signOut")}
      </button>
    </div>
  )
}
