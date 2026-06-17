# Contributing & Team Working Agreement — AEXA Web

How we work together on this repo so a small, distributed team moves fast without
stepping on each other. Short on purpose. The companion API is `aexa-server`.

---

## 1. How we divide work

- **One owner per area** — recorded in [`.github/CODEOWNERS`](.github/CODEOWNERS). To change an area you don't own, raise it with the owner first.
- **The API contract is the seam.** The server's Swagger docs (`/docs`) are the agreed interface. Agree the request/response shape up front, then web and server can be built in parallel.
- **The CTO owns architecture, review, and standards** — not every line of code.

## 2. Branching & pull requests

- **One task → one short-lived branch → one small PR.** `feat/…`, `fix/…`, `chore/…`.
- **Conventional commits** (e.g. `feat(risk): add register filters`).
- **Rebase on `main` often**; merge daily so branches don't drift.
- **Claim before you code:** assign the ticket to yourself and move it to *In Progress* on [the board](https://github.com/orgs/Qiyrix/projects/1) before writing code. This is how we avoid two people picking up the same task.

## 3. Definition of done

- [ ] `npm run lint`, `npm run typecheck`, `npm run build` pass locally.
- [ ] User-facing text goes through i18n (EN + FR) — no hardcoded strings.
- [ ] Data comes from the API — not hardcoded/mock data.
- [ ] No secrets committed; no stray `console.log` (especially never log credentials).
- [ ] You reviewed your own diff before requesting review.

## 4. Code review & AI use

- The **CTO reviews PRs**, targeting < 24h turnaround so no one is blocked across time zones.
- **AI assistance is welcome** for anyone — the bar is identical regardless of how code was written (must pass CI + review). The author is accountable for the result.
- Spot a problem in someone else's area? **Raise it in review or a ticket** — don't silently rewrite it.

## 5. CI (runs automatically on every PR)

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs **lint → typecheck → build**. A PR must be green to merge. A test step is staged and will be enabled once Vitest is added.

## 6. Cadence

- **Async daily standup** in chat: yesterday / today / blockers.
- **Weekly sync (Google Meet):** ~SF 7–8am · Luxembourg 16:00–17:00 · Bangladesh 20:00–21:00.

## 7. Local setup

```bash
npm ci             # install (uses package-lock.json)
npm run dev        # Vite dev server
npm run lint
npm run typecheck
npm run build
```

Configuration comes from a local `.env` (see the team secrets store) — never commit real secrets.
