## What & why

<!-- One or two sentences. Link the ticket. -->
Closes #

## Type
- [ ] Feature
- [ ] Bug fix
- [ ] Refactor
- [ ] Chore / infra

## Definition of done
- [ ] Scoped to one task; branch is short-lived and rebased on latest `main`
- [ ] `npm run lint`, `npm run typecheck`, and `npm run build` pass locally
- [ ] **`npm run test:coverage` passes** — every new file has a corresponding test file; coverage thresholds (80% lines · 74% statements · 68% functions · 65% branches) are met
- [ ] No secrets/keys committed; no `console.log` left in app code
- [ ] User-facing text goes through i18n (EN + FR), not hardcoded
- [ ] Data comes from the API, not hardcoded/mock data
- [ ] I reviewed my own diff before requesting review

## How to test
<!-- Steps for the reviewer to verify -->

## Notes for reviewer
<!-- Flag anything AI-assisted, risky, or worth a closer look -->
