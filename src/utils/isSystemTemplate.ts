// aexa-frontend#377 -- the GET /template (list) and GET /template/:id
// (single) responses have no isSystem-style flag distinguishing the
// synthetic "AI-Generated Findings" template (created by aexa-server's
// risk.correlation.service.ts findOrCreateSyntheticTemplate for the
// root-cause-bucketing -> Action flow) from a real user-authored one, so
// there's nothing structural to key off. aexa-server itself already
// accepts this same limitation -- its own find-or-create there matches on
// an exact templateName string (see SYNTHETIC_TEMPLATE_NAME in
// risk.correlation.service.ts) rather than a dedicated column, calling it
// "a defensible, sufficiently distinguishing check" until a real
// ai_generated-style flag is added.
//
// This is a frontend-only stopgap of the same shape: match on the known
// name substring to gate Edit/Delete for this one template. It's fragile
// to a future rename, same as the backend's own check -- the real fix is
// a shared `isSystem` flag returned by the API. Shared between
// TemplatesPage.tsx (list-row Edit/Delete buttons) and EditTemplatePage.tsx
// (the edit route itself, directly reachable by URL regardless of what the
// list page hides) so both entry points stay in sync.
const SYSTEM_TEMPLATE_NAME_MARKER = "AI-Generated Findings"

export const isSystemTemplateName = (templateName: string | null | undefined) =>
  !!templateName?.includes(SYSTEM_TEMPLATE_NAME_MARKER)
