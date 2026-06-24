import { useAuth } from '@/contexts/useAuth'
import { Navigate, Outlet } from 'react-router'

export function ProtectedRoute() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
