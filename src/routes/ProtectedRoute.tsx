import { useAppSelector } from "@/redux/hooks"
import type { ReactNode } from "react"
import { Navigate } from "react-router"

export default function ProtectedRoute({
  children,
  role,
}: {
  children: ReactNode
  role: "ADMIN" | "ORGANIZATION"
}) {
  const user = useAppSelector((state) => state.user)
  // Not logged in
  if (!user?.role) {
    return <Navigate to="/" replace />
  }

  // Role mismatch → block access
  if (user.role !== role) {
    if (user.role === "ADMIN") {
      return <Navigate to="/admin" replace />
    } else if (user.role === "ORGANIZATION") {
      return <Navigate to="/organization" replace />
    } else {
      return <Navigate to="/" replace />
    }
  }
  return children
}
