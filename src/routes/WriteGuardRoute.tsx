import { canWriteOrgResource, useMyOrgRole } from "@/hooks/useMyOrgRole"
import type { ReactNode } from "react"
import { Navigate } from "react-router"

// aexa-frontend#271 -- ProtectedRoute only guards account-type (ADMIN vs
// ORGANIZATION). Below that, write-affordance gating (canWriteOrgResource,
// #217) was only ever applied to buttons on list/detail pages, so a VIEWER
// who bookmarks or types a create/edit URL directly still reached the full
// editing surface and only found out they couldn't write when the mutation
// 403'd on submit. This wraps the route itself with the same
// canWriteOrgResource() check those pages already use for their buttons, so
// the guard and the affordance can never disagree.
//
// `role === undefined` means the role query is still in flight (see
// useMyOrgRole's doc comment) -- rendering nothing yet avoids flashing a
// redirect at a legitimate write-capable user while their role resolves,
// mirroring how every other canWriteOrgResource() consumer treats the
// loading state.
//
// Redirects to `fallback` (the relevant list page) rather than a dedicated
// "access denied" page -- this repo has no existing unauthorized-state UX
// pattern (ErrorPage.tsx is a 404), and the issue's own design guidance
// prefers a redirect to a sensible fallback over a broken half-rendered
// form.
export default function WriteGuardRoute({
  children,
  fallback,
}: {
  children: ReactNode
  fallback: string
}) {
  const role = useMyOrgRole()

  if (role === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
      </div>
    )
  }

  if (!canWriteOrgResource(role)) {
    return <Navigate to={fallback} replace />
  }

  return children
}
