import { useAppSelector } from "@/redux/hooks"
import type { ReactNode } from "react"
import { Navigate } from "react-router"

// Client-side convenience only, mirroring ProtectedRoute.tsx's own framing --
// the real gate is the httpOnly external_access_token cookie the backend
// checks on every request. This just avoids flashing the portal placeholder
// before a real request 401s. Redirects to "/" (not a specific
// /external-login/:organizationId) because without a live session there's no
// organizationId to redirect back to -- re-entry requires the same link the
// admin originally shared.
export default function ExternalProtectedRoute({
  children,
}: {
  children: ReactNode
}) {
  const externalUser = useAppSelector((state) => state.externalUser)

  if (!externalUser?.externalOrgMemberId) {
    return <Navigate to="/" replace />
  }

  return children
}
