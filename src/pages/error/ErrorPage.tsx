import { Button } from "@/components/ui/button"
import { AlertTriangle, ArrowLeft, Home } from "lucide-react"

const ErrorPage = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-lg text-center">
        <div className="mb-8 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>

        <h1 className="mb-2 text-[120px] leading-none font-bold tracking-tighter text-foreground">
          404
        </h1>

        <p className="mb-3 text-2xl font-medium text-foreground">
          Oops! Page not found
        </p>

        <p className="mb-10 text-muted-foreground">
          The page you are looking for might have been removed, had its name
          changed, or is temporarily unavailable.
        </p>

        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Button asChild size="lg" className="gap-2">
            <a href="/">
              <Home className="h-5 w-5" />
              Go to Homepage
            </a>
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={() => window.history.back()}
            className="gap-2"
          >
            <ArrowLeft className="h-5 w-5" />
            Go Back
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ErrorPage
