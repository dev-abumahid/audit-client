import { useGetSocialProvidersQuery } from "@/redux/apis/auth.api"
import { SERVER_BASE_URL } from "@/redux/baseApi"

type Provider = "google" | "facebook" | "twitter" | "github"

const PROVIDER_LABELS: Record<Provider, string> = {
  google: "Google",
  facebook: "Facebook",
  twitter: "Twitter",
  github: "GitHub",
}

// Minimal brand marks — lucide-react has no branded logos, and pulling in a
// whole icon package for four static SVGs isn't worth it.
const PROVIDER_ICONS: Record<Provider, React.ReactNode> = {
  google: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.87-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A11.998 11.998 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54V6.62H1.27a12 12 0 0 0 0 10.76l4-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.62l4 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#1877F2" aria-hidden="true">
      <path d="M24 12.07C24 5.71 18.63.5 12 .5S0 5.71 0 12.07C0 17.8 4.39 22.54 10.13 23.5v-8.1H7.08v-3.33h3.05V9.41c0-3 1.79-4.67 4.53-4.67 1.31 0 2.68.24 2.68.24v2.94h-1.51c-1.49 0-1.95.92-1.95 1.87v2.25h3.32l-.53 3.32h-2.79v8.1C19.61 22.54 24 17.8 24 12.07Z" />
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M18.9 1.5h3.68l-8.04 9.19L24 22.5h-7.41l-5.8-7.58-6.64 7.58H.46l8.6-9.83L0 1.5h7.6l5.24 6.93L18.9 1.5Zm-1.29 18.81h2.04L6.49 3.58H4.3l13.31 16.73Z" />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55 0-.27-.01-1-.02-1.96-3.2.7-3.87-1.54-3.87-1.54-.53-1.33-1.29-1.69-1.29-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.08 0 4.41-2.69 5.38-5.25 5.67.42.36.78 1.07.78 2.15 0 1.55-.01 2.8-.01 3.18 0 .3.2.66.79.55A10.51 10.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  ),
}

/**
 * Renders "Sign in with X" buttons only for providers that actually have
 * real OAuth credentials configured (GET /auth/social-providers) — a
 * provider with no credentials has no /auth/social/:provider route on the
 * server at all, so guessing which to show would render dead buttons.
 * Full-page redirect (not an RTK Query call) since OAuth needs a real
 * browser navigation through the provider's consent screen and back.
 */
export default function SocialLoginButtons() {
  const { data, isLoading } = useGetSocialProvidersQuery()
  const providers = data?.data

  // Deliberately no error-specific UI: a query error leaves `providers`
  // undefined same as "still loading" or "no providers configured", and all
  // three render nothing. Social login is optional/supplementary to the
  // email/password form the rest of this modal always shows, so silently
  // hiding it on a transient failure is preferable to an error banner
  // fighting for attention next to the real sign-in form.
  if (isLoading || !providers) return null

  const enabled = (Object.keys(PROVIDER_LABELS) as Provider[]).filter(
    (p) => providers[p]
  )
  if (enabled.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] text-muted-foreground">or continue with</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      {/* flex-wrap, not a 2-col grid: a grid leaves an awkward empty cell
          whenever an odd number of providers is enabled (commonly just 1) */}
      <div className="flex flex-wrap gap-2">
        {enabled.map((provider) => (
          <a
            key={provider}
            href={`${SERVER_BASE_URL}/auth/social/${provider}`}
            className="flex min-w-[45%] flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            {PROVIDER_ICONS[provider]}
            {PROVIDER_LABELS[provider]}
          </a>
        ))}
      </div>
    </div>
  )
}
