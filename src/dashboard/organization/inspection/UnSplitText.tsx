import { Text } from "lucide-react"

export default function UnSplitText({ unSplitText }: { unSplitText: string }) {
  // Generate button view
  if (!unSplitText) {
    return (
      <div className="rounded-md" id="unsplit-page">
        <div className="mx-auto">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border p-6 md:p-8">
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 rounded-full bg-[#6EC075]/10 p-3">
                  <Text className="h-8 w-8 text-[#6EC075]" />
                </div>
                <h2 className="mb-2 text-2xl font-bold">
                  No Unsplit Text Found
                </h2>
                <p className="mb-6 text-gray-600">
                  Tips: Please check if the note has been split then you can
                  find unsplit text.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div id="unsplit-page">
      <div className="mx-auto">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-6 md:p-8">
            <div className="flex flex-col items-center text-center">
              <h2 className="mb-2 text-2xl font-bold">Unsplit Text</h2>
              <p className="mb-6 text-gray-600 text-justify">{unSplitText}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
