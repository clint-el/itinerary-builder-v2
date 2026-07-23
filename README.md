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

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Typecheck + production build |
| `npm run lint` | oxlint |
| `npm test` | Unit tests (vitest) |

## Flows (parity with HTML prototype)

1. **Inquiries** — hierarchical table, search, full filters drawer, status dashboard, split/copy, sidebar collapse
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
