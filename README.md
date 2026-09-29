# SOL Itinerary Builder Demo

React + TypeScript + Tailwind CSS + shadcn/ui mirror of the SOL Itinerary Build UX HTML prototype.

The HTML prototype in `../SOL Itinerary Build UX` is left untouched. This app persists all user data in **localStorage** under `sol-demo-*` keys.

## Run

```bash
cd itinerary-builder-demo
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

### Voucher email (Resend, local dev only)

Copy [`.env.example`](.env.example) to `.env` and set:

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Resend API key (server-side only — never `VITE_`) |
| `APP_ORIGIN` | Base URL for confirmation links in email (e.g. Amplify deploy URL) |
| `VOUCHER_FROM` | Verified sender on Resend (e.g. `vouchers@elewanaportal.com`) |

With `pnpm dev`, issuing or resending a voucher calls `POST /api/voucher-mail` on the Vite dev server, which sends via Resend.

**Amplify (static hosting):** the app does not read `RESEND_API_KEY` in the browser. At build time, `scripts/generate-voucher-public-config.mjs` writes `public/sol-voucher-mail.json` so production knows whether to call the mail API. Set in **Amplify Console → Environment variables**:

| Variable | Purpose |
|----------|---------|
| `VOUCHER_MAIL` | `resend` to enable real sends (or rely on `RESEND_API_KEY` at build to auto-set resend in the script) |
| `VOUCHER_MAIL_API_URL` | Full URL of the mail API (Lambda Function URL — see [`lambda/voucher-mail/index.mjs`](lambda/voucher-mail/index.mjs)) |
| `RESEND_API_KEY`, `APP_ORIGIN`, `VOUCHER_FROM` | On the **Lambda** environment, not the static build (unless only used to flip `resend` mode at build) |

Deploy [`lambda/voucher-mail`](lambda/voucher-mail) as an AWS Lambda with Function URL, CORS enabled, secrets on the function. Point `VOUCHER_MAIL_API_URL` at that URL and redeploy the Amplify branch.

Optional: `VITE_VOUCHER_MAIL=stub` forces the stub; `VITE_VOUCHER_MAIL=resend` mirrors `VOUCHER_MAIL`.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Typecheck + production build |
| `npm run lint` | oxlint |
| `npm test` | Unit tests (vitest) |

## Flows (parity with HTML prototype)

1. **Inquiries** — hierarchical table, search, full filters drawer, action board, split/copy, sidebar collapse
2. **Create** — inquiry ref, agency/agent tree, dual-month calendar, destinations, resident/non-resident pax, child ages
3. **Builder** (`/build/:id`) — Stay / Transport / Flight / Activity / Other, rooms & guest DnD, holds, extras, promotions, pricing override, resizable right pane, service reorder
4. **Quote** (`/quote/:id`) — supplier groups, DnD, Add Service overlay, guest drawer, price modal
5. **Summary** (`/summary/:id`) — grouped breakdown, pricing/holds, full lifecycle transitions

All create / update / status / split / quote / service changes survive refresh.

## Reset demo data

In DevTools console:

```js
;['sol-demo-itineraries','sol-demo-services','sol-demo-quote-groups','sol-demo-guests','sol-demo-version','sol-demo-sidebar-collapsed']
  .forEach((k) => localStorage.removeItem(k))
location.reload()
```

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui
- React Router
- localStorage (`src/shared/lib/storage.ts`)
- Vitest for helpers/storage unit tests
