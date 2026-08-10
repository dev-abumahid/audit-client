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
// exact name to gate Edit/Delete for this one template. It's fragile to a
// future rename, same as the backend's own check -- the real fix is a
// shared `isSystem` flag returned by the API. Shared between
// TemplatesPage.tsx (list-row Edit/Delete buttons) and EditTemplatePage.tsx
// (the edit route itself, directly reachable by URL regardless of what the
// list page hides) so both entry points stay in sync.
//
// Exact match, not a substring check -- mirrors the backend's own exact
// SYNTHETIC_TEMPLATE_NAME comparison in risk.correlation.service.ts. A
// substring check was tried first and found (by live verification, PR
// #675) to incorrectly lock a legitimate template that merely CONTAINS
// this marker in its name -- specifically, the "Duplicate" feature's own
// "{name} (copy)" suffix on a duplicate of this template still contained
// the marker substring, so the copy's Edit/Delete stayed disabled even
// though it's an independent, fully-editable template.
const SYSTEM_TEMPLATE_NAME = "⚙ AI-Generated Findings (system, do not edit)"

export const isSystemTemplateName = (templateName: string | null | undefined) =>
  templateName === SYSTEM_TEMPLATE_NAME
