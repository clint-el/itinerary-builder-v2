# Itinerary Builder Epic

**Document**: Cheli & Peacock Safaris (CPS) / Elewana Afrika
**System**: SOL (SafariOnLine)
**Module**: Itinerary Builder (IB)
**Status**: In Progress — Backend substantially implemented (Phases 0–6 shipped); Frontend partial (create + list only); UX validated via standalone prototype
**Epic Owner**: —
**Key Stakeholders**: —
**Document Created**: July 26, 2026
**Prepared for**: Frontend, Backend, and QA engineering teams
**Requested by**: clint.maruti (Task Initiator)

---

## Overview

The Itinerary Builder is the core operational module of SOL — the workspace where a Safari Planner turns a client **Inquiry** into a fully-priced, day-by-day safari **Itinerary**: adding accommodation, transport, flights, activities and other services; assigning travelers; applying promotions and manual price overrides; and walking the itinerary through its commercial lifecycle from Draft through Quoted, Invoiced, Vouchered, Confirmed, and (post-booking) through amendments to Completed.

This epic consolidates three sources into one functional/technical/UX specification:

1. **The backend domain** (`SOL.Itinerary.Api`) — a mature, largely-shipped rich-domain module (Phases 0–6: engines, lifecycle, supplier commercial, finance, documents, amendments) with ~70 REST endpoints already implemented and specified in `backend/openspec/specs/itinerary-*`.
2. **The current admin frontend** (`frontend/apps/admin`) — which today only implements itinerary **creation** (a single header-only modal) and the **itineraries list** screen; there is no builder UI, detail page, or lifecycle UI in the shipped frontend yet.
3. **The `itinerary-builder-demo` UX prototype** — a standalone, backend-less React prototype that demonstrates the intended end-to-end UX flow (Inquiry → Builder → Quote → Summary) with placeholder pricing math and a simplified data model.

Because the backend is materially ahead of both the frontend and the prototype in domain richness (e.g., staged pending-changes, supplier vouchers, finance milestones, versioned snapshots), and because the prototype and backend disagree on some modeling details (status enum, pricing formula, per-line vs per-day structure), this epic explicitly reconciles the three. Material discrepancies that still need a stakeholder or architecture call are listed once under **Open Decisions (non-blocking backlog)**; the main body states current prototype/doc behavior as the buildable draft.

**Itinerary Builder** in this epic refers to the full authoring surface for an Itinerary — not just the "add a line" screens, but also its lifecycle, pending-changes/amendments, supplier engagement, finance, and generated documents, since the backend already treats these as one aggregate and one contiguous user workflow.

---

## Key Entities & Business Context

- **Inquiry**: The client request/lead that precedes an Itinerary — the top level of a confirmed **three-level nesting model**: Inquiry (container) → Itinerary (option) → Sub-quote (terminal, non-splittable). Carries a system-generated reference following the format `{Prefix}{Year:D2}{Seq:D6}` (e.g. `CPS26000123`) — the pattern business refers to as **"Itinerary Ref"**. Separately, Inquiry carries a **`CrmTicketReference`** field, manually entered by the user at Inquiry creation — this is what business calls the **"Inquiry number/ref"**: the CRM ticket number, distinct from the system-generated reference above despite the similar name. HubSpot-automated population of that field is **explicitly descoped from this epic** per business direction (clint) — manual entry only for now (see IB 1.1.d, Out of Scope, Related Epics). *(Backend implementation note, not spec-authoritative: architecture review during drafting found both fields already modeled in current code — see Technical Tasks (Backend).)*
- **Itinerary (Option)**: The aggregate root of this epic. A priced, dated trip proposal for one Agency's client, made of ordered **Items** (service lines), a **Traveller** roster, commercial config (margin/commission/uplift), and a **Status** that drives which actions are available. The first itinerary drafted under an Inquiry is Option 1; the Inquiry's `InquiryNumber` plus this Itinerary's `OptionNumber` together form its displayed reference (see IB 1.1.c/1.2). Further options are created by **splitting at the parent-Inquiry level** (e.g. a family group needing separate quotations) — see IB 1.3.
- **Sub-quote**: A variant created by **splitting under a confirmed Itinerary (option)** rather than under the parent Inquiry. Sub-quotes are terminal — they cannot themselves be split further. See IB 1.3.
- **Item (Line)**: A single priced service — Accommodation, Activity, Transport, Flight, Fee, or Other — either Catalog-backed (snapshotted rate/supplier) or manual/ad-hoc. Lines can have child **Extras**.
- **Traveller**: A named or placeholder person on the trip, assigned to specific Lines, driving per-line pax pricing.
- **Pending Change (Working Copy)**: A staged, not-yet-committed edit to an Itinerary. Every builder edit — even in Draft — is staged first, then folded into the committed Itinerary. Post-booking, this staging mechanism becomes the **Amendment** workflow with its own approval ladder.
- **Commercial (Supplier Facts)**: Supplier-side request/confirmation/hold state per line, tracked separately from pricing so it survives amendments untouched.
- **Voucher**: A supplier-facing confirmation document, one per supplier, auto-raised at the Vouchered transition and re-raised on qualifying amendments.
- **Document**: An immutable, frozen client/finance-facing snapshot — Quote, Invoice, or FCA (Final Confirmation/Activity — Ops handover) — regenerated (never mutated) as the itinerary changes.
- **Itinerary Version**: An immutable full snapshot written every time a Pending Change is applied — the audit trail of "what the itinerary looked like at each committed revision."

### Current State
- Backend: Phases 0–6 shipped (engines, builder CRUD, lifecycle, supplier commercial, finance, documents, amendments/versions) per `backend/openspec/specs/itinerary-*`.
- Frontend: Only "Create Itinerary" (header fields only, no lines/services) and the "Itineraries List" screen exist. No detail/edit page, no lifecycle UI, no pricing UI ships today.
- A separate, unwired UX prototype (`itinerary-builder-demo`) demonstrates the intended full flow but uses invented placeholder pricing and a simplified data/status model that does not match the backend 1:1.

### Future State
- A single, backend-integrated Itinerary Builder UI covering: creation → line-by-line building → traveller assignment → pricing review → lifecycle progression → pending changes/amendments → supplier vouchers → finance → documents — replacing both the placeholder prototype math and the current frontend's create-only scope.
- Frontend to consume the real `SOL.Itinerary.Api` contract (72 endpoints) rather than the 2 endpoints it calls today.

---

## Users/Actors in the Epic

| Actor | Role |
|-------|------|
| **Safari Planner** (`Safari.Planner`) | Primary builder user — creates itineraries, adds/edits lines, assigns travelers, manages pricing, drives lifecycle up to Confirmed |
| **Safari Sales** (`Safari.Sales`) | Lifecycle actions (approve/invoice/lost/supersede); per-tenant Cognito-provisioned role |
| **Safari Ops** (`Safari.Ops`) | Marks lines Ops-ready, generates FCA documents, manages post-confirmation operational handover |
| **Safari Finance** (`Safari.Finance`) | Deposits, payments, milestones, credit notes/terms, finance lock, cancellation quotes |
| **Admin** | Superset access across all builder/lifecycle/supplier/finance actions |
| **Agency / Agent** | Client-side party the itinerary is built for; not a SOL user in this phase (see Agencies Management Epic — [01-Agencies-Management-Epic](01-Agencies-Management-Epic.md)) |
| **Supplier** | Recipient of Vouchers; not a SOL user — engaged via Commercial/Voucher records only |
| **SOL (System)** | Automated recompute, roll-ups, auto-voucher-on-transition, auto-history logging |

### Personas
No persona document was supplied for this epic. Cross-reference whatever persona doc backs [01-Agencies-Management-Epic](01-Agencies-Management-Epic.md) / [02-Manage-Suppliers-Epic](02-Manage-Suppliers-Epic.md), if one exists.

---

## Source Documents

- `backend/openspec/specs/itinerary-*` (23 capability specs: builder, offer-engine, staging, promotions, lifecycle, supplier-commercial, brochure-copy, holds, versions, vouchers, documents, amendments, history, create-hardening, item-lifecycle, finance, computation-log, parity) — **authoritative, shipped backend behavior**
- `backend/docs/itinerary_*.md` / `*.plan.md` (Phase 0–6 build plans, domain model, entity spec, API design) — original planning artifacts, superseded in detail by the openspec specs above where they disagree
- `backend/docs/itinerary_carryover_action_required.md` — live schedule of 19 unresolved Phase-1 deferrals (see Open Decisions)
- `backend/openapi.json` — current REST contract (72 itinerary/voucher paths)
- `frontend/apps/admin/src/features/create-itinerary/**`, `frontend/apps/admin/src/entities/itinerary/**`, `frontend/apps/admin/src/widgets/itineraries-list/**` — current shipped frontend
- `frontend/.cursor/agents/itinerary.md` — frontend itinerary-domain agent brief (secondary source)
- `itinerary-builder-demo/` (standalone prototype, `src/features/{inquiries,builder,quote,summary}`) — UX reference, **not** a data-model source of truth
- `backend/.claude/skills/itny-simulator` / `backend/docs/lab/itny.js` — the historical JS behavioral-oracle simulator underlying the lifecycle/reconciliation rule IDs cited throughout this epic (`R-LC-*`, `R-CH-*`, `R-IT-*`, `R-CN-*`, `R-FN-*`, `R-OPS-*`, `R-IF-*`)

---

## Scope

### In Scope
- Itinerary creation from a new or existing Inquiry (header, pax, dates, agency/agent)
- Itineraries list: search, sort, filter (status, payment, agency, destination, dates)
- Builder: add/edit/remove service lines (Accommodation, Activity, Transport, Flight, Fee/Other) and extras
- Traveller roster management and per-line traveller assignment
- Pricing: rate resolution, margin/commission/uplift compounding, manual net/sell overrides, promotions
- Lifecycle: Draft → Prepared → Quoted → Approved → Invoiced → Vouchered → Confirmed, plus Lost / Superseded / Cancelled / Reopen / Revert-to-Draft
- Pending Changes: pre-booking staging (auto, invisible-by-design) and post-booking Amendments (explicit approval ladder, apply/cancel, per-line revert/restore)
- Supplier commercial: holds, vouchers (auto-raise, confirm/reject, prior-version reconciliation)
- Finance: deposit, payment ledger (receive/refund/credit-note), milestones, credit terms, finance lock, cancellation quotes
- Documents: Quote, Invoice, FCA generation and staleness tracking
- Itinerary Versions (immutable apply snapshots), History log, Computation log (audit)
- Brochure copy (duplicate a booking as a non-committal brochure itinerary)
- Role-based authorization and the platform's lifecycle error contract (409/422/404)

### Out of Scope (this epic; flag for future epics)
- Tax calculation (`ITaxEngine` is a hard-zero stub platform-wide — no tax field exists anywhere)
- Real currency/FX conversion (`ICurrencyFxEngine` is a 1:1 identity stub)
- Agent/Agency self-service itinerary creation (AgentZone remains the client-facing system this phase — see [01-Agencies-Management-Epic](01-Agencies-Management-Epic.md))
- Automated Xero sync for itinerary-driven invoices (manual today, per [02-Manage-Suppliers-Epic](02-Manage-Suppliers-Epic.md) pattern)
- Real cancellation/change fee schedules (`CancellationEngine`/`PolicyEngine` exist but default to 0% — configurable rate is a future commercial decision)
- Mobile/tablet-optimized builder UI (prototype and current admin app are desktop-only; out of scope unless explicitly requested)
- Multi-currency presentment (single USD assumed throughout current implementation and prototype)
- Status Dashboard (priority queue + trade-partner ranking) — per business clarification, explicitly deferred: "ignore for now, still under work." Any remaining Priority Queue column questions are out of scope for this epic's delivery.
- HubSpot-automated population of the Inquiry's CRM ticket reference (see IB 1.1.d) — explicitly descoped per clint's direction; manual entry only for this epic. No CRM adapter/webhook exists today, so this is genuine future integration work, not a technical blocker on this epic. Recommend a follow-up CRM-integration epic rather than dropping the idea — see Related & Blocked Items.

---

## Functional Requirements

---

## IB 1.N: Inquiry Intake & Itinerary Creation

### Requirement 1.1: Create Itinerary from New or Existing Inquiry
SOL shall support creating an Itinerary either against a **new** Inquiry (auto-generating the next sequential reference) or an **existing** Inquiry (selected from a searchable list), producing an Itinerary in `Draft` status.

#### 1.1.a: Auto-Seeding on Create
On create, SOL shall auto-seed the global `PaxConfigEntry` set and corresponding `Traveller` placeholder rows from the submitted Adults/Children/Infants counts + child ages (defaulting unknown ages: Adult 35, Child 10, Infant 1, Teen 16), so the very first recompute prices correctly without a follow-up edit.

#### 1.1.b: Destination Validation
Each submitted Destination/Location id shall be validated to exist and belong to the tenant before the Itinerary and its `ItineraryLocation` rows are persisted.

#### 1.1.c: Inquiry Reference Allocation ("Itinerary Ref")
The business term **"Itinerary Ref"** shall be a system-generated reference, format `{Prefix}{Year:D2}{Seq:D6}` (e.g. `CPS26000123`), allocated per-tenant and concurrency-safe (a same-instant allocation race must resolve via a handled retry, never a duplicate number). The prefix (and whether a year suffix is included) shall be tenant-configurable in Settings (exact field names under Open Decisions — minor).

*(Technical note, not spec-authoritative — see Technical Tasks (Backend): this reference format and allocation mechanism already exist as a computed value in current backend code; confirm during implementation rather than treating that as settling this requirement.)*

**Note**: The `itinerary-builder-demo` prototype models Inquiry reference and Itinerary reference as a **single hierarchical string field** (parent/child via dash suffixes, e.g. `CPS5678-1`), with no `parentId` relation. The real UI shall use the backend's relational `Inquiry(1)→Itinerary(many)` model via `OptionNumber`, not the prototype's string-parsed hierarchy.

#### 1.1.d: CRM Ticket Reference ("Inquiry Number/Ref") — Manual Entry Only
**Terminology clarification**: "Inquiry number/ref," as used by business, refers to a **separate concept** from the Itinerary Ref above — the CRM ticket reference. SOL shall capture this as a free-text, nullable field on the Inquiry, manually entered by the user at Inquiry creation.

*(Technical note, not spec-authoritative — see Technical Tasks (Backend): architecture review during drafting characterized this as a small, additive field with no conflict against existing reference allocation; treat as background for estimation, not confirmation that the requirement is satisfied.)*

**Explicitly out of scope for this epic**: HubSpot-automated population of `CrmTicketReference` (i.e., auto-populating it from a CRM integration rather than manual entry). Per clint's direction, this is a scoping decision — manual entry only for this epic; automation is flagged as a follow-up item for a later CRM-integration epic rather than dropped — see Out of Scope and Related & Blocked Items. For the future CRM-integration epic (not this one): whether `CrmTicketReference` remains manually editable after HubSpot automation lands is deferred to that epic's design.

*(Technical note, not spec-authoritative: architecture review during drafting found no CRM adapter/webhook in the codebase today, supporting that automation is genuinely new integration work — useful background for backend estimation, not the basis for the scoping decision above, which is clint's business call.)*

### Requirement 1.2: Itinerary Header Fields
Itinerary shall consist of the header fields defined in the **Itinerary Fields Table** below.

### Requirement 1.3: Split / Additional Option Creation
Per business clarification, Split is not a single flow — it depends on the level being split from:
- **Split at the parent Inquiry level** produces a new **Option** (e.g. for a family group wanting separate quotations) — a sibling Itinerary under the same Inquiry with the next sequential `OptionNumber`.
- **Split under a confirmed Itinerary (option)** produces a **Sub-quote** — a variant that is terminal and cannot itself be split further.

SOL shall support Split as a first-class server-side operation: creating a new sibling Itinerary under the same Inquiry (for an Option-level split) with committed items/travellers/pricing carried forward from the source — not something a client assembles by composing other calls. Option-level Split is in scope for this epic. Sub-quote creation (split under a confirmed Option) is described above; its data-model shape is listed under Open Decisions and is not required to ship Option-level Split.

*(Technical note — see Technical Tasks (Backend): existing `POST itineraries` creates a blank header only; `CopyAsBrochureHandler`/`BrochureFactory` is an existing pattern Split can reuse for copy mechanics.)*

---

## IB 2.N: Itineraries List, Search & Filter

### Requirement 2.1: Itineraries List
SOL shall show the Itineraries List for authorized users (`Admin ∨ Safari.Planner`) as a **three-level tree** (Inquiry → Itinerary/Option → Sub-quote, per business clarification — see Key Entities), with columns: Inquiry No., Itinerary Title, Agency/Agent, Safari Planner, Travel Dates, Status, Hold Status, Margin, Payment, Total, Balance, Last Updated, Actions.

#### 2.1.a: Financial Columns
The Itineraries List shall show real Payment, Total, Balance, and Last-Updated (distinct from Created At) values for every row — this is a required part of the list, not an optional enhancement.

*(Technical note, not spec-authoritative — see Technical Tasks (Backend): these values aren't currently returned by the search endpoint the shipped admin frontend calls, though the underlying data exists elsewhere in the backend. That's an implementation gap to close, not a reason to soften this requirement.)*

#### 2.1.b: Hold Status Column
Since Holds are per-line (service-based — IB 10.3) and an Itinerary can carry many, the Hold Status column shall display the single **nearest-expiring active hold** (fewest days left; an already-expired hold wins over any future one), per business clarification — that is the hold that dictates when the whole itinerary is at risk. Count and per-service breakdown shall be secondary detail exposed on hover/expand, not in the column itself.

*(Technical note, not spec-authoritative — see Technical Tasks (Backend): this value isn't currently returned by the search endpoint the shipped admin frontend calls — same implementation gap as 2.1.a.)*

#### 2.1.c: Margin Column
The Margin column shall show **CPS Margin %** (per business clarification) — see IB 6.4 for margin sourcing/resolution and IB 6.4.a for the AgencyGroup-scoped resolution fix in progress.

#### 2.1.d: Entry Points — Open Builder vs. Open Quote
Per business clarification, the list's row actions shall expose two distinct entry points into an itinerary:
- **Open Builder** — the primary/authoring flow (assemble services, pax, dates, quantities, holds, cost/sell and margin). Everything that changes the itinerary happens here.
- **Open Quote** — the output/client-facing, read-optimized view (grouped totals, generate/send), derived from what the Builder produced. Not an alternative editor. **Status**: Available only for itineraries that have reached `Quoted` status or later (per business clarification — see IB 12.5).

Both actions land on the itinerary; which view opens by default (absent an explicit Open Builder/Open Quote choice) is governed by status-aware landing — see IB 8.7.

### Requirement 2.2: Search
SOL shall support dynamic search across Inquiry No., Itinerary Title, Agency, Agent, Lead Traveler Name, and Safari Planner (Created By), matching after 3 characters entered.

### Requirement 2.3: Sort
SOL shall support sorting by any backend-declared sortable field (`ItinerarySortBy`: None, InquiryNumber, DateFrom, DateTo, LeadTravelerLastName, CreatedAt, Status). Columns without a backend sort key (Itinerary Title, Agency/Agent, Safari Planner, and the financial placeholders) shall either (a) be added to the backend sort enum, or (b) remain explicitly client-page-only sorted with a documented limitation once server pagination exceeds one page.

**Note**: Client-side-only sort on a field that isn't server-sortable only sorts the currently loaded page (max 50 rows) — this needs explicit resolution once pagination ships (see 2.5).

### Requirement 2.4: Filters
SOL shall support filtering the list by: Status, Payment Status, Agency, Destination, Travel Date From/To, Created On From/To, and a "Hide completed" toggle. Applied filters shall render as removable chips with an overflow "+N more" affordance when they exceed the available width.

### Requirement 2.5: Pagination
SOL shall support paging through the full Itineraries List, not just the first page of results.

*(Technical note, not spec-authoritative — see Technical Tasks (Backend): the search contract already models a `cursor` field for this, but no frontend implementation consumes it today — an implementation gap to close, not a reason to soften this requirement.)*

### Requirement 2.6: Empty States
SOL shall show a distinct empty state for "no itineraries created yet" (with a Create CTA) versus "no itineraries match the current search/filters" (with a Clear Filters CTA).

---

## IB 3.N: Itinerary Header & Pax Configuration

### Requirement 3.1: View/Update Header
SOL shall support viewing and updating Itinerary header fields (title, dates, presentment currency, commercial config) via `PUT itineraries/{id}`, subject to the Builder Mutation Gate (IB 4.1.a).

### Requirement 3.2: Global Pax Configuration
SOL shall maintain a global `PaxConfig` (Adult/Child/Infant only — no Teen at this level) as the authoritative trip-target headcount. Updating it auto-creates additional `Traveller` placeholder rows up to the new target (never deletes existing travelers).

#### 3.2.a: Pax Divergence Warning
If the global pax target diverges from the actual assigned-traveler count on lines, SOL shall surface a **non-blocking** `PAX_DIVERGENCE` warning (not an error) in the itinerary's `summary.warnings[]`.

#### 3.2.b: Two Pax Models Coexist by Design
**Note for FE/QA**: SOL maintains two related-but-distinct pax concepts: the global trip-level `PaxConfig` (Adult/Child/Infant) and the per-line `ItemTraveller` assignment set (Adult/Child/Infant/**Teen**, Teen only ever appearing at line level). The UI shall clearly distinguish "how many travelers total" from "which travelers are on this specific line." The prototype's flat `Guest[]` + drag-and-drop pattern is the UX reference; the real build must also model the Teen band and any global-vs-line divergence warning.

### Requirement 3.3: Per-Line Pax Taxonomy Pricing
SOL shall price each line based on its own assigned travelers (per-line pax taxonomy), not the itinerary's global pax config — a line with a traveler assignment that diverges from the global config must price correctly for who is actually on that line.

*(Technical note, not spec-authoritative — see Technical Tasks (Backend): architecture review during drafting found the pricing engine currently computes pax context once per itinerary and reuses it for every line, and assessed the fix as scoped to that internal computation with no data-model or contract change needed for frontend. Background for backend estimation only — frontend should build the traveler-assignment UI against the documented contract (IB 5.2) regardless of this gap's status.)*

---

## IB 4.N: Builder — Service Lines

### Requirement 4.1: Add/Edit/Remove Lines
SOL shall support adding, editing, and removing Itinerary lines (`ItineraryItem`) of type Accommodation, Activity, Transport, Flight, Fee, or Other — either Catalog-backed (snapshotting a `RateRuleSnapshot` at pick time) or manual/ad-hoc (seller-entered name + service type + flat or per-pax net).

#### 4.1.a: Builder Mutation Gate
Every builder write (line, extra, traveler, header, pax, promotion, manual price, reprice) shall be rejected with **409** unless `Itinerary.Status == Draft` — except once a Pending Change is open, in which case the same edit is accepted but routed onto the open Working Copy (see IB 9.N). The rejection reason shall differ by context: "return to Draft to edit" (Quoted/Invoiced) vs "use Pending Changes" (Confirmed/Vouchered).

#### 4.1.b: Extras (Child Lines)
SOL shall support adding Extras as child lines under a parent line (`ParentItemId`), each independently priced. Per business clarification, each Extra shall support a **quantity** (not just presence/absence).

SOL shall support Catalog-backed Extras (not just manual entry). Sequencing of Catalog-backed Extras within this epic vs later is listed under Open Decisions; extras are manual-entry only in current backend code today.

*(Technical note — see Technical Tasks (Backend): Catalog-backed extras are not implemented in current backend code; extras are manual-entry only.)*

#### 4.1.b.i: Extras Refresh on Room/Service Change
Per business clarification, when a new Room (Service/ServiceOption combination — see 4.2.b) is added, SOL shall load that room's applicable extras and contract pricing, auto-select any mandatory extras, and expose optional ones for selection. If instead another instance of the **same** Room Service/Option is added, the eligible extras list shall remain unchanged — only quantities and prices are recalculated.

#### 4.1.c: Rate Resolution on Date Change
Changing a line's travel date shall re-evaluate its frozen rate snapshot if the new date stays within the snapshotted rate plan's validity window; if it falls outside, SOL shall re-resolve from Catalog (fresh pick + re-snapshot).

#### 4.1.d: Hypothetical / No-Rate Lines
If no Catalog rate resolves for an assigned PaxType on a future-dated line, SOL shall mark the line `Hypothetical` (if a prior rate existed) and price it via uplift-adjusted approximation, or return `Invalid`/"not sellable" if no prior rate exists — pricing shall never silently default to $0.

SOL shall price Hypothetical lines via uplift-adjusted approximation off a prior/contracted rate reference so pricing never silently defaults to $0. The exact SME-defined base-net source is listed under Open Decisions; until then, the current backend uplift-adjusted approximation is the implemented behavior this epic builds against.

*(Technical note: current backend approximates via uplift-adjusted calculation off the contracted rate — see Open Decisions for SME confirmation of the intended source.)*

### Requirement 4.2: Service-Type-Specific Configuration
Each line type shall support its type-specific configuration surface, informed by the prototype's screen design (see UX Reference below):
- **Accommodation**: supplier/location, stay dates, meal basis/Option (Basis) at the **Service level** — see 4.2.b for rationale and schema — rooms (type, capacity, per-room date override; **rooms are duplicated one-at-a-time via an explicit "Duplicate" action, not a quantity multiplier** — see 4.2.h), pricing per room (each room is priced as its own Service — per business clarification), Total (Client Price) per Service (UI to be included — see 4.2.c), traveler assignment per room (with an "Auto-assign" bulk action — see 4.2.h), extras (with quantity — 4.1.b), promotions, supplier notes.
- **Transportation**: supplier/location + Service selection, then vehicles (type/capacity/rate) and traveler assignment per vehicle. There is **no Transfer/Hire mode** (removed — see 4.2.d).
- **Flight**: no separate From/To location fields — **intentional**, since Flight services are defined/named by route in Catalog (e.g. "Nairobi – Amboseli"), see 4.2.e. **One-way only** (return-trip toggle removed — see 4.2.i), supplier/service, charter/capacity (now conditional on the Service name matching "charter" rather than always shown — see 4.2.i) with auto-computed required-charter count derived from the assigned traveler roster (not manual counters), per-PAX-band rates, extras, promotions, and min/max-capacity overflow handling (split-vs-squeeze, with inducement-fee and supplier-approval messaging — see 4.2.g).
- **Activity**: supplier/location, one-or-more dated activity items, per-item traveler assignment, "add all unassigned travelers" bulk action, Extras/Promotions (confirmed **included** per business clarification — see 4.2.f). The prototype's **Days of Week** field has been removed from scope per business clarification.
- **Other/Fee**: supplier/location, dates, flat qty × unit price, or itemized sub-lines.

#### 4.2.a: Per-Room / Per-Vehicle / Per-Item Live Pricing
SOL shall show a live per-line price breakdown (by traveler-type rate cell × nights/units) as rooms/vehicles/activity items are configured, before the line is committed.

#### 4.2.b: Accommodation Selection Model — Basis, Rooms & Seasons
Per architecture clarification (from the team discussion, cross-checked against the current Catalog schema), Option (Basis) sits at the **Service level**, not per room: the team agreed there is no case where different PAX on the same stay need a different basis, so one Basis applies to all rooms/guests on that Service.

The current Catalog schema is:
```
Supplier
  └── Service (typed by ServiceType: Accommodation, Transport, …)
        ├── Rate[]              ← room / sellable unit (chargeType, timeUnit)
        ├── ServiceOption[]     ← basis/package (e.g. FB, GB)
        └── ContractedRate[]    ← season under a Contract
              └── options[]     ← price cells: (serviceOptionId × rateId) → net/rack/sell
```
- **Rate** lives on the Service — for accommodation, this is the room-like sellable unit.
- **ServiceOption** also lives on the Service — for accommodation, this is the board/basis.
- **ContractedRate** is a **season** (name + travel date ranges), not a room; its `options`/price rows are the Season × Option × Rate price matrix.

For itinerary selection, a stay is: one Service from one Supplier → a chosen ServiceOption (basis) → one or more Rates (rooms) from that same Service → price resolved by looking up the applicable ContractedRate season for the travel dates, then the matching Option × Rate cell. This is **a collection of selected Rates (rooms) under one Service/Option stay** — not a collection of ContractedRates (seasons are not rooms), and not multiple Services grouped under a ServiceType to represent rooms.

FE shall build the room picker against this Service → ServiceOption → Rate(s) model. `AddItineraryItem` currently keys catalog selection by `serviceOptionId` (with units/quantity and optional price cells); whether an explicit `rateId` is a quick contract addition or a deeper change is listed under Open Decisions.

**Prototype update (commits 2026-07-28 → 2026-07-30)**: Accommodation room types now use a stable id (e.g. `hemingways-double-suite` style, with legacy-name fallback) rather than the display label — supporting an id-based room model on the frontend side.

#### 4.2.c: Total (Client Price) Per Service — UI Confirmed In Scope
Per business clarification, the Total (Client Price) per Service UI, missing from the current design, will be included — not dropped.

#### 4.2.d: Transportation — No Transfer/Hire Mode
The Transportation configuration surface is **Location + Supplier + Service selection**, then vehicles (type/capacity/rate) and traveler assignment. There is **no Transfer vs Hire mode toggle** and no multi-leg hire routing sub-flow — do not build one. (An earlier prototype sync briefly modeled Transfer vs Hire; that was removed and is settled current behavior.)

Per-vehicle pricing model details remain under Open Decisions (needs Catalog/Transport service-loading review). Overnight-transfer questions from the old mode toggle are moot under the current surface unless Transfer/Hire returns.

#### 4.2.h: Accommodation — Room Duplication & Auto-Assign (Prototype Update)
The latest prototype sync replaced the room "quantity" multiplier with an explicit **"Duplicate"** action — the UI now models one row per physical room, rather than a quantity field fanning out identical rooms. Capacity math is simplified accordingly (per-row capacity, not quantity × capacity). An **"Auto-assign"** button was added for bulk guest-to-room assignment (distinct from the manual drag-and-drop/dropdown assignment per IB 5.2.a).

#### 4.2.i: Flight — One-Way Only, Free-Text Time, Conditional Charter Section
Flight lines are configured as **one-way only** (no return-trip toggle). Departure/arrival times use **free-text time entry**. The charter/capacity section is shown only when the Service name matches **"charter"**. Whether round-trip should return in a later epic is listed under Open Decisions; this epic builds the one-way surface.

#### 4.2.e: Flight — Route-Based Service Naming
Confirmed intentional per business clarification: Flight services are defined/named in Catalog by route (e.g. "Nairobi – Amboseli"), so there is no separate From/To location field pair on the line — the route is carried by the selected Service itself.

#### 4.2.f: Activity — Extras/Promotions & Days of Week
Per business clarification: the prototype's Days of Week field on Activity lines has been removed from scope. Extras and Promotions on Activity lines are confirmed **in scope** (not intentionally omitted).

#### 4.2.g: Flight — Capacity Derivation & Overflow Handling (Prototype Commits 2026-07-28 → 2026-07-30)
The prototype now derives required charter pax from the itinerary's **assigned traveler roster**, rather than a manually entered counter — consistent with how traveler assignment already drives pricing elsewhere in this epic (IB 3.3, IB 5.2). It also adds a min/max-capacity overflow mode when the assigned pax count doesn't cleanly fit the selected charter capacity: a **split** option (multiple charters) vs. a **squeeze** option (over-capacity on one charter), the latter surfaced with inducement-fee and supplier-approval messaging.

The builder shall surface this split-vs-squeeze overflow UX. Whether the inducement fee is priced by `IOfferEngine` or handled as Catalog/booking-side workflow is listed under Open Decisions; do not block the capacity-derivation UX on that call.

### Requirement 4.3: Manual Price Overrides
SOL shall support overriding computed Net/Sell values per line, gated behind a **mandatory reason** capture, and shall record who/when/why in the audit trail.

#### 4.3.a: Manual Levers Precedence
Manual Net (per PaxType) and Manual Total Sell (flat, per line) shall win over system-computed values when present. Manual Total Sell bypasses the discount/promotion step; Manual Net still flows through the full compounding chain (see IB 6.2).

The prototype's "Override Prices" flow (modal-gated mandatory reason + session-only audit panel) is the UX reference. The real implementation **shall persist** override reason/actor/timestamp durably (backend price-override audit path exists structurally — confirm exact storage with backend at implementation).

### Requirement 4.4: Reorder Lines
SOL shall support manually reordering lines (`Order` field). Reordering shall not automatically recompute or shift line dates.

**Note**: Reordering shall not auto-shift dates. The prototype's post-reorder "Update date ranges?" dialog is a no-op stub — either remove that dialog or wire real date-shift logic once the algorithm is decided (see Open Decisions).

### Requirement 4.5: Catalog Search & Selection ("Find a Supplier or Service")
Per business clarification, "Find a supplier or service" is the single entry point for adding any service type: it lets the user select the Supplier and Catalog Service they want to add, and that selection establishes the context for all configuration below it (available options, rates, extras, dates, and other service-specific settings). It replaces the older supplier-and-service search popup design.

#### 4.5.a: Supplier List Display Fields
Per business clarification, the supplier list shall display supplier name plus additional detail beyond name alone — Preferred, Head Office, Closeout, and similar badges. Exact subset is under Open Decisions; build the list to show name + available detail badges.

#### 4.5.b: Service List Display Fields
Per business clarification, the service list shall display: Service Name, Supplier Name (when the supplier isn't already set as context), Pax composition, Indicative price, and ChargePer/TimeUnit (PPPS/PUPN) — confirmed in scope, not dropped.

#### 4.5.c: Search Result Item Fields
Per business clarification, "Find a Supplier or Service" results shall show, per result type:
- **Supplier results**: supplier name, location, head office/group, service-type badge, preferred/starred indicator if applicable.
- **Service results**: service name, parent supplier, service-type badge, location, and a preview price if available.

#### 4.5.d: Duplicate Service Detection
Per business clarification, duplicate Added Services shall **not** be blocked unconditionally — the same service may legitimately be added again for different dates, guests, or itinerary segments. Instead:
- The Added Services list shall remain in a scrollable area with a visible item count.
- Matching search results shall be marked **"Already added."**
- Selecting an "Already added" result shall highlight/scroll to the existing service instance rather than silently adding a duplicate.
- If dates or configuration differ from the existing instance, the UI shall offer **"Add another instance."**
- Addition shall only be warned against or prevented when Service, Option, dates, and allocation are **all** identical to an existing line.

The prototype already handles list overflow via scrolling; duplicate detection ("Already added" / "Add another instance") shall be built as specified above.

---

## IB 5.N: Traveller Management & Per-Line Assignment

### Requirement 5.1: Traveller Roster
SOL shall maintain a `Traveller` roster per itinerary (name, PaxType, sequence-derived tag e.g. `ADT1`, age, origin), auto-seeded from pax config (5.2 above) and independently editable (rename, set age/origin, add/remove within pax-config bounds).

### Requirement 5.2: Per-Line Assignment
SOL shall support assigning/unassigning specific Travellers to a specific line (`PUT items/{itemId}/travellers`), unique per `(ItemId, TravellerId)`.

#### 5.2.a: Assignment UX Pattern
SOL shall use **drag-and-drop only** for traveler assignment for MVP, platform-wide (chip ↔ room/vehicle/activity-item drop zones, plus an "unassigned" pool) — the prototype's drag-and-drop guest-chip pattern, not its toggle-button/dropdown alternative. (Decision: clint.)

**Accepted accessibility gap (known tradeoff, not an oversight)**: native HTML5 drag-and-drop has no keyboard-accessible equivalent — drag-and-drop-only means keyboard-only users cannot assign travelers to lines at all in this MVP. This was raised explicitly before the decision was made (not silently dropped): it is a real accessibility gap, deliberately accepted for MVP scope per clint's call. Revisit post-MVP if a keyboard-accessible path becomes a requirement.

**Prototype update (commits 2026-07-28 → 2026-07-30)**: the prototype's own pattern had diverged further per service type before this decision — Accommodation had gained a keyboard-accessible dropdown alongside drag-and-drop, and Transportation had dropped drag-and-drop entirely in favor of dropdown-only. Per the decision above, the real build does **not** follow either of those prototype variants — it standardizes on drag-and-drop only, platform-wide, superseding both.

### Requirement 5.3: Guest Detail Capture
SOL shall support capturing extended per-traveler detail beyond the roster minimum: salutation, full name, DOB/age, dietary requirements, international flight details, preferences, and free-text notes — informed by the prototype's Guest Drawer (Manage/Assign two-mode pattern).

---

## IB 6.N: Pricing & Commercial Engine

### Requirement 6.1: Recompute-on-Write
Every builder mutation shall dispatch the pricing engine (`IOfferEngine`) **before** persisting, so reads never recompute — the composite `GET itineraries/{id}` always returns stored, already-priced values.

#### 6.1.a: Engine Modes
- `SearchAndPrice` — read-only preview (service-option picker), no persistence, no computation trace.
- `ChangeItem` — update/remove a line; includes an old-vs-new `PriceDiff`.
- `RepriceItem` — explicit re-price of one line; breakdown only, no diff.
- `RecalculateItinerary` — add line, pax/date-changing header edit, or explicit recalculate; recomputes itinerary totals.

### Requirement 6.2: Net-to-Sell Pricing
SOL shall compute a client-facing Sell price from a line's Net cost, applying discount, margin, commission, and uplift. CPS Margin shall always be applied (no supplier-provided-sell skip); a supplier-provided sell price is retained only as informational reference, not used to bypass margin.

SOL shall compute Sell using this compounding order (current backend engine — the build target for this epic; independent finance sign-off tracked under Open Decisions):

```
Purchase           = Net × (1 − Discount)
LastContractedSell = (Purchase × (1 + Margin)) × (1 + Commission)
Sell               = LastContractedSell × (1 + Uplift)
```

Prototype pricing math is invented placeholder and is **not** a source of truth (see UX Reference). QA shall assert against this compounding formula, not the prototype constants.

#### 6.2.a: Prototype Update — Discount Now Applied Consistently (2026-07-28 → 2026-07-30)
The prototype previously showed a promotion discount reducing only Sell/Rack; it now reduces both Cost/Net **and** Sell/Rack. This is the prototype **catching up** to the backend's already-shipped formula above — not a new business rule: per IB 6.2, `Discount` reduces `Net` to produce `Purchase`, which cascades through Margin/Commission/Uplift into `Sell`, so a discount was always supposed to affect the whole chain, not just the final Sell figure. No spec change needed here; flagging only so QA doesn't mistake the prototype's older display bug for a spec.

#### 6.2.b: Terminology — Doc Uses Net/Rack/Sell
This epic uses **Net / Rack / Sell** (matching shipped backend field names such as `RateSell`). The prototype pricing UI labels the same concepts **"Cost/Sell."** FE may mirror prototype label copy in the UI; domain/API vocabulary in this epic remains Net/Rack/Sell. Terminology alignment (whether Cost = Net, whether Rack is dropped) is under Open Decisions — do not rename backend fields in this epic.

#### 6.2.c: Price-Display-Mode Toggle on Summary
The Summary view includes a **Cost/Sell/Everything** display-mode toggle (prototype). Build this toggle as a presentation control over the same Net/Rack/Sell values; label mapping follows 6.2.b / Open Decisions.

### Requirement 6.3: Uplift for Hypothetical Lines
Future-dated lines with no contracted rate covering the travel date shall apply `Uplift = max(1, yearsOut) × upliftRate`; contracted (rate-covered) lines get an uplift factor of 1 (no uplift).

### Requirement 6.4: Margin & Commission Sourcing
CPS Margin and Travel-Counselor (TC) Commission shall be resolved per Agency Group where possible.

#### 6.4.a: AgencyGroup-Scoped Margin
SOL shall resolve CPS Margin using the Agency's AgencyGroup-scoped Margin Rule, not a header-level default, whenever the Agency belongs to an AgencyGroup with such a rule defined.

This requirement ships **non-blocking** per program decision (carryover #5, clint): until the AgencyGroup lookup is wired, wholesale/retail agencies may fall back to header-level margin — a live financial-correctness risk, not a softened requirement. Multi-group margin precedence (Agency in >1 AgencyGroup) is under Open Decisions.

*(Technical note — see Technical Tasks (Backend): Catalog lookup service exists; assessed as a scoped Agency→AgencyGroup lookup wired into the pricing engine.)*

### Requirement 6.5: Tax & FX — Explicitly Out of Scope
Tax is a hard-zero stub (no tax field persisted anywhere); Currency FX is a 1:1 identity stub. Both are tracked as post-all-phases backlog (carryover #1, #3), not this epic's delivery scope.

### Requirement 6.6: Rate Resolution Fidelity
Each line's frozen `RateRuleSnapshot` must capture per-component fidelity (`RateRuleId`, per-component `ChargePer`/`TimeUnit`, contracted season/booking-window/date scope) — not a single option-level cell shared across all components.

This requirement stands for delivery. Verify against actual behavior at QA time (see Open Decisions) — do not treat a prior architecture code-review note as confirmation it is already met.

**Separate caveat**: Catalog has no free-of-charge concept, so a line can never be marked genuinely free-of-charge today. Worth its own backlog line item if it matters to the business.

*(Technical note, not spec-authoritative — see Technical Tasks (Backend): architecture review during drafting found this fidelity already implemented in current code (frozen per-component rate rows, not a shared option-level cell), via a change record described as archived and fully tested. Background for backend estimation only — not a substitute for confirming the requirement is met.)*

### Requirement 6.7: Per-Night Rate Differential
SOL shall price a multi-night stay accounting for per-night weekday-rate differentials, not a single representative rate applied to the whole stay.

This requirement ships **non-blocking** per program decision — a live correctness risk that ships as-is until separately prioritized.

*(Technical note, not spec-authoritative: per-night weekday-differential pricing is not implemented in current backend code; a stay uses the start-day/representative-weekday rate for the whole stay today.)*

---

## IB 7.N: Promotions

### Requirement 7.1: Catalog & Manual Promotions
SOL shall support selecting a Catalog promotion (deep-copied into a tenant-scoped `PromotionInstance` at selection time, never re-read live thereafter) or creating a Manual/ad-hoc promotion (unconditional, flat % on Total).

### Requirement 7.2: Promotion Conditions
Catalog promotion conditions shall be evaluated conjunctively (AND): multi-supplier requirement, booking window, travel dates, supplier-nights/nights-total/suppliers-total/pax-number/pax-age thresholds.

### Requirement 7.3: Discount Targets & Add-Ons
Promotion discount benefit shall be computed on the supplier **net** (feeding the `Discount` term in IB 6.2), scoped by PaxType + index range and/or nights (Cheapest/AnyFromFirst/AnyFromLast/Any). Add-on actions shall materialize a system-managed, free ($0/$0) line that is auto-removed if the promotion stops matching.

### Requirement 7.4: Promotion Confirmation UX
**UX Reference**: the prototype's "Ongoing promotion applied" soft-confirmation dialog (Review vs Add-with-promotion) when adding a line while a promotion is active is a reasonable pattern to carry forward.

**Prototype update (commits 2026-07-28 → 2026-07-30)**: The Pricing panel's promotion row now computes a real numeric discount for at least the early-bird promotion type; other promotion types may still show placeholders until wired — build against the Promotion model (IB 7.N), not the old permanent "--" stub.

#### 7.4.a: Terminology — Doc Uses Promotion
This epic uses **Promotion** / `PromotionInstance` (matching shipped backend types). The prototype UI labels read **"Special(s)."** FE may mirror prototype label copy; domain/API vocabulary in this epic remains Promotion. Terminology alignment is under Open Decisions — do not rename backend types in this epic.

### Requirement 7.5: Promotion Target Mapping
Catalog `PromotionTargetType{Pax=1, Nights=2}` shall map explicitly (never int-cast) to engine `PromoTargetType{Total=1, Nights=2, Pax=3}`.

#### 7.5.a: SME Gap — Multi-Member Night Targeting (Non-Blocking, Computed-Correctness Gap — Accepted Risk)
Multi-member free-night promotion targeting uses a best-effort heuristic and ships **non-blocking** (carryover #7, High) until SME input confirms the oracle (see Open Decisions).

**Note — deliberate risk acceptance**: like 6.4.a, this is a computed-correctness gap (a live promo/pricing decision that can pick the wrong target today), not a missing-surface gap — flagged explicitly rather than folded silently into the general non-blocking reclassification. Per confirmed program direction it ships as-is until SME input resolves it.

---

## IB 8.N: Lifecycle & Status Management

### Requirement 8.1: Status Model
Itinerary Status shall be one of: `Draft, Prepared, Quoted, Approved, Invoiced, InvoicePaid, Vouchered, Confirmed, Lost, Superseded, Cancelled` (shipped enum — see Itinerary Fields Table for authoritative int values; `InvoicePaid` is a below-Vouchered gating state, not a distinct forward-ladder step).

### Requirement 8.2: Transition Table
SOL shall permit only the transitions in the table below; any pair not listed is rejected regardless of which endpoint is called.

| Transition | Trigger / Gate |
|---|---|
| Draft → Prepared | ≥1 active line, no open Pending Change (R-LC-02) |
| Prepared → Quoted | A `QUOTE` document exists whose frozen fingerprint matches current state (R-LC-03) |
| Quoted → Approved | Direct flip (R-LC-04) |
| Approved → Invoiced | An `INVOICE` document exists whose frozen fingerprint matches current state (R-LC-06) |
| Invoiced → Vouchered | Suppliers resolvable AND (amount paid > 0 OR credit terms enabled) (R-LC-07) — auto-raises one Voucher per supplier |
| Vouchered → Confirmed | No open Pending Change; every committed active line is supplier-Booked (R-LC-08) |
| Prepared/Quoted/Approved/Invoiced → Draft | Revert (R-LC-09); **hard-blocked at Vouchered+** (R-LC-09c) |
| Draft..Invoiced → Lost | Requires non-empty Lost Reason (R-LC-11); blocked at Vouchered+ |
| Any pre-Confirmed non-terminal (incl. Vouchered) → Superseded | No live supplier engagement on any line (R-LC-12) |
| Vouchered/Confirmed → Cancelled | Opens/reuses a Cancellation-triggered Pending Change; real flip happens only on Apply (R-CN-09) |
| Lost/Superseded → Draft | Reopen (R-LC-13), clears Lost Reason |
| Booking-type, ≥1 committed New/Confirmed line → new Brochure-type Draft itinerary | Copy-as-Brochure (R-LC-15) |

### Requirement 8.3: Item-Level Lifecycle
Item Status shall be `New`, `Confirmed`, or `Cancelled`, with its own transition rules (R-IT-10 New→Confirmed, R-CN-01 Confirmed→Cancelled, R-IT-06 Confirmed→New reset) that branch on the parent Itinerary's status: below Vouchered = inline flip + recompute; at/above Vouchered with no open change = still an inline flip (a deliberate ops-workflow carve-out distinct from itinerary-level Cancel); at/above Vouchered **with** an open change = routed onto the Pending Change as a staged op.

### Requirement 8.4: Ops-Ready Flag
SOL shall support an idempotent `ops-ready` flag per line (R-OPS-01), requiring `Confirmed` status + supplier-Booked, gated to the Ops role both at the endpoint and in-rule.

### Requirement 8.5: Concurrency & History
Every transition shall be optimistic-concurrent on the caller's last-seen `version` (409 on stale) and shall write exactly one `ItineraryHistoryEntry` on success, none on rejection.

### Requirement 8.6: UX — Lifecycle Action Surface
**UX Reference**: the prototype's Summary-page footer (one button per valid transition for the current status, contextual hint text, reason-required transitions prompting for free text) is a strong reference for the real lifecycle control surface.

**Note**: Build against the backend's 11-value status enum (not the prototype's 12). Transition reasons shall persist durably — Lost Reason already does; confirm equivalents for Supersede/Cancel/Reopen at implementation (see Open Decisions). Do not reuse the prototype's `window.prompt()` gate (value discarded after submit).

### Requirement 8.7: Status-Aware Landing View
Per business clarification, opening an itinerary shall route to a **status-aware default view** — the view matching the itinerary's next likely action — rather than always opening the Add Services (Builder) view:
- **`Draft` / `Prepared`** → **Builder** (Add Services). Still being assembled — the editor is the right place.
- **`Quoted` / `Approved` / `Invoiced` / `Vouchered` / `Confirmed` / in-progress / `Completed`** → **Summary** (read-first). At these stages the work is reviewing, sending, checking payment, or recording a decision, not adding services.
- **`Lost` / `Cancelled` / `Superseded`** → **Summary** (read-first), surfacing the reopen/reactivate path rather than the editor.

Editing remains one click away via a "Back to editing" button on Summary, alongside the status-transition actions — revising is an explicit choice, not the default. **Rationale**: most opens of a quoted or confirmed itinerary are to look or send, not rebuild; status-aware landing reduces accidental edits to itineraries carrying financial or client-facing commitments.

#### 8.7.a: Superseded Options Are Read-Only
A superseded Option (see IB 1.3) shall always open read-only (Summary), regardless of the general status-aware rule; the accepted master option opens to its own status-appropriate view like any other Itinerary.

#### 8.7.b: Summary View Access
Per business clarification, the Summary view shall be available to **all** authorized users (see IB 15.N Role Model) — it is not gated to a subset of roles beyond the itinerary's general view authorization.

---

## IB 9.N: Pending Changes (Staging & Post-Booking Amendments)

This section documents the shipped backend staging/amendment workflow (Working Copy, Fold-on-apply, post-booking approval ladder, endpoints and rule codes below). No frontend or prototype screen currently covers it — treat this as the documented backend behavior this epic builds against.

### Requirement 9.1: Universal Staging
Every builder mutation — even in Draft — shall stage first: the first edit on an itinerary with no open Pending Change auto-opens a Working Copy (cloning all committed lines), and subsequent edits stage into that same open copy. No inline mutation of committed lines ever occurs.

#### 9.1.a: Change Diff Derivation
The change diff (ADD/MODIFY/REMOVE/CANCEL per line) shall be derived on read by diffing the Working Copy against the committed Itinerary — never persisted as a separate change-op table.

#### 9.1.b: Remove vs Cancel
A no-fee `REMOVE` (line dropped entirely at apply) is distinct from a fee-bearing `CANCEL` (line kept at apply with `Status=Cancelled` and a computed cancel fee, currently 0 pending real cancellation-fee configuration).

#### 9.1.c: Auto-Close (Pre-Booking Only)
A pre-booking Pending Change auto-closes when its diff empties out (e.g., add-then-remove nets to nothing). A post-booking Amendment never auto-closes — it must be explicitly applied or cancelled even if empty.

### Requirement 9.2: Post-Booking Amendment Ladder
Once Vouchered/Confirmed, staging auto-opens as a post-booking change (unless Finance-locked or one is already open) and walks its own ladder: `Draft → Prepared → Quoted → Approved → Invoiced`, each requiring its exact prior step; Prepared/Quoted additionally require ≥1 staged edit.

#### 9.2.a: Manual Open & Trigger
SOL shall support manually opening a change (`POST changes/open`) with an explicit Trigger (`Seller` or `ClientRequest`).

#### 9.2.b: Re-Open a Change
SOL shall support re-opening a change past Draft back to Draft (`POST changes/draft`), preserving all staged edits; while past Draft, further staging edits are frozen/rejected until re-opened.

#### 9.2.c: Per-Line Revert/Restore
SOL shall support reverting a single staged `MODIFY` (back to baseline) or removing a staged `ADD`, and restoring an undone staged `REMOVE`, without discarding the whole change.

### Requirement 9.3: Apply
`POST changes/apply` (only from post-booking `Invoiced` state, or directly for pre-booking changes) shall, in one transaction: recompute → raise/supersede supplier vouchers for qualifying lines → fold the Working Copy into committed (preserving stable line IDs) → post client settlement (extra charge or refund on the net delta) → write exactly one immutable Itinerary Version → clear the open-change flag.

#### 9.3.a: Voucher-Confirmation Gate
If applying would raise supplier vouchers and the apply command's `ConfirmVouchers` flag is `false`, the entire apply shall **abort** (409) before any write — the change stays open (R-CH-26).

#### 9.3.b: Cancellation-Triggered Settlement
For a Cancellation-triggered change, settlement shall route to a credit note (if `issueCreditNote`, default true) or a refund + paid "Refund to Client" milestone.

### Requirement 9.4: Cancel a Pending Change
`POST changes/cancel` shall discard the open change and restore the committed baseline unconditionally.

### Requirement 9.5: UX — Pending Changes Surface
No frontend or prototype screen currently exists for viewing/managing a Pending Change as a distinct concept (diff view, per-line revert/restore, apply/cancel actions, voucher-confirmation prompt). This is a **net-new UI surface** this epic must design. Recommend a dedicated "Pending Changes" panel/drawer showing the live diff against committed state.

---

## IB 10.N: Supplier Commercial — Holds & Vouchers

Holds (10.3) has partial prototype UX coverage (see UX Reference below). Commercial Facts (10.1), Supplier Status (10.2), and Vouchers (10.4) are documented from shipped backend behavior and are the build target for this epic.

### Requirement 10.1: Commercial Facts
SOL shall track supplier-side request/confirmation state per line in a Commercial record keyed by a stable Line Key that survives Apply/Fold untouched (never staged, cloned, or diffed).

### Requirement 10.2: Supplier Status
(`NeedsDecision` is a reserved-but-inert enum member and is not shipped).

### Requirement 10.3: Holds
SOL shall support requesting a Hold on an unlocked `New` line (with no active hold already covering its current fingerprint) and releasing it. Hold state is one-way `HELD ↔ RELEASED`; there is no persisted "expired" flag (expiry is derived client-side from `ExpiresAt`) and no dedicated expire endpoint.

**UX Reference**: the prototype's Hold card pattern (status-colored, expiration date + reference + comment, Confirm/Release actions) is a reasonable basis; note the prototype models a 4th status (`Expired`) that the backend does not persist — the UI must derive "expired" client-side from the stored expiry date rather than expecting a server-provided status value.

### Requirement 10.4: Vouchers
SOL shall auto-raise one Voucher per supplier at the Invoiced→Vouchered transition: `SENT` for unconfirmed active non-auto-confirm lines, immediately `CONFIRMED` for auto-confirm (`Others`) lines. There is no manual send/withdraw endpoint.

#### 10.4.a: Confirm / Reject
SOL shall support voucher-level (all-or-nothing) Confirm/Reject. Reject requires a non-blank reason and cannot target an all-Cancel voucher.

#### 10.4.b: Re-Vouchering on Amendment
A qualifying Apply (per IB 9.3) shall supersede the prior live voucher for an engaged line (chained `Supersedes`/`SupersededBy`), including for margin-only edits that don't change the supplier-facing commercial fingerprint (a fresh voucher is still raised, since re-vouchering keys off the staged op, not the fingerprint).

#### 10.4.c: Prior-Version Race
A superseded voucher shall remain answerable via `confirm-prior`/`reject-prior` until acknowledged, recording the outcome without touching money or Supplier Status (R-IF-06).

#### 10.4.d: Vouchers Summary View (New — Prototype Discovery)
The Summary **Vouchers** sub-view (per-supplier cards, cost/sell/none value-display toggle, and an "Issue voucher" action) is current prototype UX. Backend requirement remains auto-raise at Invoiced→Vouchered with no manual send (10.4). How "Issue voucher" maps to that model is under Open Decisions — build the Summary cards and value toggle; do not invent a second voucher-send pipeline ahead of that call.

---

## IB 11.N: Finance — Deposits, Payments, Milestones, Credit

### Requirement 11.1: Deposit
SOL shall maintain a single Deposit record per itinerary (system-computed amount/due-date, optional manual override amount/due-date, paid flag, skip flag).

### Requirement 11.2: Payment Ledger
SOL shall support recording Payments (Receive / Refund / Credit Note types) with amount, timestamp, server-derived actor, optional comment, and a Reverse action (marks Reversed, does not delete).

### Requirement 11.3: Milestones
SOL shall support custom Payment Milestones (type, amount or % of total, due date, paid flag, comment) in addition to the system deposit.

### Requirement 11.4: Credit Terms & Finance Lock
SOL shall support enabling/disabling Credit Terms per itinerary (any authorized role) and a Finance Lock (Finance/Admin only) that blocks Invoice generation and change-apply while engaged.

### Requirement 11.5: Cancellation Quote
SOL shall support requesting a Cancellation Quote per line (Finance/Admin only) ahead of an actual cancellation, using the configurable (currently 0%) cancellation-fee rate.

### Requirement 11.6: UX — Finance Surface
No frontend or prototype screen exists for full deposit/payment/milestone/credit-terms management. The prototype's Quote page has a "Finance" tab that renders only a "coming soon" placeholder. This is **net-new UI** this epic must design. (Partial UX evidence for payment history display — see 11.6.a — is a display sidebar, not the management surface.)

#### 11.6.a: Payment-History Sidebar Hardcoding (New — Prototype Discovery, Same Pattern as the Deposit-Split Conflict)
Do not adopt this fixed schedule as-is (same hardcoding pattern as the earlier deposit-split issue). If a real payment-history display is in scope, source it from the Payment Ledger (IB 11.2) and Milestones (IB 11.3), not a template constant (see Open Decisions).

---

## IB 12.N: Documents (Quote / Invoice / FCA)

### Requirement 12.1: Document Kinds
SOL shall support generating exactly three document kinds: `QUOTE` (Prepared..Confirmed, status-neutral), `INVOICE` (Approved..Confirmed; stamps First Invoice Date only on the first invoice; blocked by Finance Lock), `FCA` (Confirmed only, requires every billable line to be Ops-ready, Ops-gated).

### Requirement 12.2: Immutability & Staleness
Each generated document shall be an immutable, fully relational frozen snapshot; regenerating a kind inserts a new numbered row (`Q1`, `INV2`, `FCA1`), never mutating a prior one. A computed `Stale` flag shall be true when the document's frozen fingerprint no longer matches the itinerary's current fingerprint, or if any unresolved supplier rejection exists platform-wide.

### Requirement 12.3: Change-Aware Regeneration
While a post-booking change is open, regenerating a `QUOTE`/`INVOICE` shall derive each line's change status (`TO_ADD`/`TO_CHANGE`/`TO_CANCEL`/`CANCELLED`/none) and, for `TO_CHANGE`, a prior-price snapshot.

### Requirement 12.4: Per-Item Attachments
SOL shall support attaching/removing free-form per-line documents (title + description), separate from and unaffected by generated Quote/Invoice/FCA documents, with no recompute triggered.

### Requirement 12.5: UX — Document Presentation
**UX Reference**: the prototype's Quote page (grouped-by-supplier service table, price modal itemization, footer margin/total) is a reasonable starting reference for the client-facing Quote presentation. SOL shall present one canonical, fully-numeric line-item model across both the Builder (live) surface and the Quote/Invoice/FCA (frozen) surface — no display-string-only model, and no client-side reconciliation step needed between the two.

*(Technical note, not spec-authoritative — see Technical Tasks (Backend): architecture review during drafting found the current backend already implements this split (numeric `ItineraryItem` for Builder, frozen numeric `DocumentLine` for documents) with matching field vocabulary and supplier IDs on both — assessed as no new backend modeling needed. The prototype's own split is separately understood to be self-inflicted (its Quote model stores pre-formatted display strings only). Background for backend estimation, not a substitute for confirming the requirement is met.)*

#### 12.5.a: Second Quote Document Surface Discovered (Prototype Commits 2026-07-28 → 2026-07-30)
A second, richer Quote document surface has appeared in the prototype at `/quote-doc/:id`, distinct from the `/quote/:id` page referenced above: a paginated, print-style document with cover page, day-by-day itinerary, investment-breakdown, and terms sections. This is a plausible candidate UX reference for the real `QUOTE` document's rendered output (IB 12.1/12.2) and is not yet reflected anywhere in this epic's UX Reference section.

**Note — partially resolved (prototype update)**: `/quote-doc/:id` previously hardcoded a flat 30/70 deposit split. That half is now **resolved**: the latest prototype sync replaced it with a real per-supplier `DEPOSIT_RULES` table (e.g. Hemingways 30%/14 days, Elewana 25%/7 days, some suppliers 100% at booking) plus dynamically generated per-supplier inclusions text — consistent with IB 11.1's per-itinerary Deposit model rather than a document-template constant, and a reasonable UX reference for how per-supplier deposit terms should render.

Do **not** adopt the hardcoded "this proposal expires on {date}" language as a business rule — it remains a template constant, not sourced from any itinerary validity/expiry field in this epic. If a Quote document should show an expiry, source it from a real field (see Open Decisions).

---

## IB 13.N: Itinerary Versions, History & Computation Audit

### Requirement 13.1: Itinerary Versions
Every successful `changes/apply` shall write exactly one immutable, sequence-numbered (per-itinerary, starting at 1) full snapshot — header + lines + vouchers + payments — captured **after** the fold. An aborted/rejected apply writes no version.

### Requirement 13.2: History Log
SOL shall append one `ItineraryHistoryEntry` per meaningful action (System or User actor, stable Event Code, structured parameters), rendered into a human-readable message at read time (never a stored hardcoded string). `GET {id}/history` shall be newest-first, keyset-paged.

### Requirement 13.3: Computation Log
SOL shall append a full input/output trace per pricing engine invocation per recompute, for offline analysis only — never affecting a persisted price. Read-only preview (`SearchAndPrice`) writes no trace.

No retention/purge/partition policy exists yet for computation-log or soft-deleted staging scratch rows (carryover #8, #9) — a pre-production data-volume concern, not required for this epic's functional delivery.

---

## IB 14.N: Brochure Copy

### Requirement 14.1: Copy as Brochure
SOL shall support copying a Booking-type itinerary (with ≥1 committed New/Confirmed line) into a new Brochure-type, Draft-status itinerary: copying committed items/extras/pax/commercial spec at the copied margin, but dropping promotions, manual overrides, locks, supplier state, payments, vouchers, and documents. An open Pending Change on the source is **not** folded — only the committed baseline is copied.

#### 14.1.a: Same Lifecycle Ladder
A Brochure-type itinerary walks the identical standard lifecycle ladder — there is no separate Brochure-specific flow or convert-to-Booking route.

---

## IB 15.N: Authorization & Error Handling

### Requirement 15.1: Role Model
SOL shall enforce role-gated actions per the table below.

| Action group | Required role(s) |
|---|---|
| Create Itinerary / Search list | Admin ∨ Planner |
| Builder writes (lines/extras/travelers/header/pax/promotions/reprice) | Admin ∨ Planner ∨ Ops ∨ Finance |
| Supplier commands (holds) | Admin ∨ Planner ∨ Ops ∨ Finance |
| Lifecycle transitions (general) | Admin ∨ Sales ∨ Finance ∨ Ops |
| Cancel (itinerary-level) | Finance only |
| FCA generation / Ops-ready | Ops only (endpoint + in-rule) |
| Finance actions (deposit/milestones/payments/lock/cancellation-quote) | Admin ∨ Finance (endpoint), Finance re-checked in-rule for lock/record-payment/refund/credit-note |
| Credit terms enable/disable | Any authorized role |
| Voucher confirm/reject/prior | Admin ∨ Planner ∨ Ops ∨ Finance |
| Pending Change open/apply/cancel/revert/restore | Any authorized role |

**Note**: `Safari.Sales` requires per-tenant Cognito group provisioning before it grants anything real; a tenant with no provisioned group grants nobody that role in practice today. Flag to QA: test accounts must confirm Cognito provisioning per tenant before asserting Sales-gated behavior.

### Requirement 15.2: Error Contract
- Domain rule rejection → **409** with `{status, errors:[{ruleId, field, message}]}`.
- Request-shape validation failure → **422** (lifecycle endpoints specifically; other modules' plain validation failures remain **400**).
- Unknown or cross-tenant itinerary → **404** (never 403 — tenant filtering makes another tenant's row indistinguishable from nonexistent).
- Stale `version` on any write → **409**.

**Note** (carryover #19): some business-rule scenario text elsewhere cites 422 where the shipped code returns 400 for non-lifecycle `Result.Invalid` paths. QA shall assert against the rule above (lifecycle-specific 422 carve-out), not older scenario text.

---

## Inquiry Fields Table

| Field | Type | Comment | Mandatory (y/n) |
|-------|------|---------|-----------------|
| **ID** | PK | Not shown in UI | y |
| **Inquiry Number** | Varchar (computed) | `{Prefix}{Year:D2}{Seq:D6}`, e.g. `CPS26000123` — business term: "Itinerary Ref" (IB 1.1.c). No change from current shipped behavior. | — (system) |
| **CRM Ticket Reference** | Varchar, nullable | **Net-new field.** Business term: "Inquiry number/ref" — manually entered by the user at Inquiry creation (IB 1.1.d). Manual only this epic; HubSpot automation descoped/future. | n |
| **Prefix** | Varchar | Per-tenant `ItinerarySetting`, lazily seeded on first create | — (system) |
| **Sequence Number** | Int | Concurrency-safe per-tenant counter feeding Inquiry Number | — (system) |
| **Inquiry Year** | Int | Feeds Inquiry Number; year-suffix configurability via Settings (exact schema under Open Decisions — minor) | — (system) |

---

## Itinerary Fields Table

| Field | Type | Comment | Mandatory (y/n) |
|-------|------|---------|-----------------|
| **ID** | PK | Not shown in UI | y |
| **Inquiry** | FK | Parent Inquiry; `Inquiry(1) → Itinerary(many)` via `OptionNumber` | y |
| **Option Number** | Int | Sequential option under the Inquiry | y |
| **Agency** | FK | See [01-Agencies-Management-Epic](01-Agencies-Management-Epic.md) | y |
| **Agent** | FK | Optional specific Agent under the Agency | n |
| **Status** | Enum {Draft=0, Prepared=1, Quoted=2, Approved=3, Invoiced=4, InvoicePaid=5, Vouchered=6, Confirmed=7, Lost=8, Superseded=9, Cancelled=10} | See IB 8.1–8.2 for transition rules | y |
| **Type** | Enum {Booking, Brochure} | Brochure via Copy-as-Brochure (IB 14.N) | y |
| **Pending Status** | Enum {None=0, Draft=1, Quoted=2, Approved=3, Prepared=4, Invoiced=5} | Open-change ladder badge; numerically non-sequential by historical design | y |
| **Lost Reason** | Varchar | Required to Mark-Lost | n |
| **Title** | Varchar | Optional | n |
| **Presentment Currency** | Varchar | Modeled; FX is a 1:1 stub today | n |
| **Travel Date From / To** | Date | To defaults to From if left blank at create | y / n |
| **Lead Traveler First/Last Name** | Varchar | Computed `LeadTravelerName` | y |
| **Adults / Children / Infants Count** | Int | Derived snapshot from `PaxConfigEntries` | y |
| **Future Uplift Rate / Base Year** | Decimal / Int | Drives Hypothetical-line uplift (IB 6.3) | n |
| **CPS Margin %** | Decimal | Header fallback until AgencyGroup-scoped lookup is wired (IB 6.4.a — fix scoped, see below) | n |
| **TC Commission %** | Decimal | Travel-Counselor commission | n |
| **Travel Start / End** | Date | Recompute-derived from line dates | — (system) |
| **Total Net / Total Sell / Total Outstanding** | Decimal(18,2) | Recompute-derived roll-ups; no tax total (IB 6.5) | — (system) |
| **Supplier IDs** | List<Guid> | Distinct committed-line suppliers | — (system) |
| **Payment Status** | Enum | Draft/Deposit-Paid/Partially-Paid/Fully-Paid/Overpaid/Refund-Pending (confirm exact backend enum values at implementation — see Open Decisions) | y |
| **Credit Terms / Note / Updated At/By** | Bool/Varchar/Meta | See IB 11.4 | n |
| **Finance Locked** | Bool | Blocks Invoice + Apply while true | y |
| **First Invoice Date** | Date | Stamped once, on first Invoice only | — (system) |
| **Version** | Int (rowversion) | Optimistic concurrency on every write | — (system) |

---

## Itinerary Item (Line) Fields Table

| Field | Type | Comment | Mandatory (y/n) |
|-------|------|---------|-----------------|
| **ID** | PK | Stable across Fold (preserved, not re-keyed) | y |
| **Itinerary** | FK | XOR with Working Copy FK — exactly one set (DB CHECK) | y (XOR) |
| **Working Copy** | FK | Set only while staged | y (XOR) |
| **Parent Item** | FK (self) | For Extras | n |
| **Service Option** | FK (Catalog) | Null = manual/ad-hoc line | n |
| **Service Type** | Enum {Accommodation, Activity, Others, Transport, Flight, Fee} | | y |
| **Name** | Varchar | Required for manual lines | y (manual) |
| **Supplier** | FK | Snapshotted at pick time | y |
| **Status** | Enum {New=1, Confirmed=2, Cancelled=3} | See IB 8.3 | y |
| **Supplier Status** | Enum {None, NeedsRequest, AwaitingSupplier, Booked, Rejected} | Derived, not user-set (IB 10.2) | — (system) |
| **Rate Type** | Owned {ChargePer × TimeUnit} | Person/Unit × Night/Day/Stay | y |
| **Start Date / End Date** | Date | | y |
| **Units / Quantity** | Int | Duration / count | y |
| **Order** | Int | Manual sort position (IB 4.4) | y |
| **Price Breakdown** | Owned | Per-PaxType net/rack/sell cells; no tax | — (system) |
| **Rate Snapshot** | Owned | Frozen `RateRuleSnapshot` at pick/reprice time | — (system) |
| **Manual Net (per PaxType)** | Decimal | Overrides System Net (IB 4.3) | n |
| **Manual Total Sell** | Decimal | Overrides computed Sell, flat, bypasses discount (IB 4.3.a) | n |
| **Hypothetical** | Bool | Set when no rate resolves for a future date (IB 4.1.d) | — (system) |
| **Ops Ready** | Bool | Ops-only flag, requires Confirmed + Booked (IB 8.4) | n |
| **Locked** | Bool | Finance-driven lock, blocks builder edits on this line | n |

---

## Traveller Fields Table

| Field | Type | Comment | Mandatory (y/n) |
|-------|------|---------|-----------------|
| **ID** | PK | | y |
| **Itinerary** | FK | XOR with Working Copy FK | y (XOR) |
| **Working Copy** | FK | | y (XOR) |
| **Pax Type** | Enum {Adult, Child, Infant, Teen} | Teen only ever appears at line-assignment level, not global config | y |
| **Pax Seq** | Int | Monotonic → derives display Tag (e.g. `ADT1`) | — (system) |
| **Name** | Varchar | | n |
| **Age** | Int | Defaults: Adult 35, Child 10, Infant 1, Teen 16 | n |
| **Origin** | Varchar | Resident / Non-Resident (per prototype's Res/Non-Res split) | n |
| **Baseline Traveller** | FK (self) | Links a staged clone back to its committed origin | — (system) |

---

## Commercial (Supplier Facts) Fields Table

| Field | Type | Comment | Mandatory (y/n) |
|-------|------|---------|-----------------|
| **Itinerary + Line Key** | Composite unique | Stable across Fold, never re-keyed | y |
| **Requested State** | Owned | Supplier request snapshot | n |
| **Confirmed State** | Owned | Supplier confirmation snapshot | n |
| **Prior Requested** | Owned | For prior-version voucher race (IB 10.4.c) | n |
| **Supplier Aside** | Owned | Prior-version acknowledgment outcome | n |
| **Payment Terms** | Owned | Supplier-specific payment terms | n |
| **Holds** | Child collection | See Holds Fields Table | n |
| **Version** | Uint (rowversion) | Manual, not `BaseEntity`-inherited (no soft-delete) | — (system) |

---

## Voucher Fields Table

| Field | Type | Comment | Mandatory (y/n) |
|-------|------|---------|-----------------|
| **ID** | PK | | y |
| **Itinerary** | FK | | y |
| **Supplier** | FK | One voucher per supplier per round | n |
| **Status** | Enum {Draft, Sent, Confirmed, Rejected, Superseded} | | y |
| **Ver** | Int | Increments once per apply round (not per line) | — (system) |
| **Supersedes / Superseded By** | FK (self, chain) | | — (system) |
| **Booking Ref** | Varchar | | n |
| **Reason** | Varchar | Required for Reject | n (y for reject) |
| **Lines** | Child collection | `(ItemId, Action Confirm\|Cancel, Fp, Price)` unique per `(VoucherId, ItemId)` | y |

---

## Document Fields Table

| Field | Type | Comment | Mandatory (y/n) |
|-------|------|---------|-----------------|
| **ID** | PK | | y |
| **Itinerary** | FK | | y |
| **Kind** | Enum {Quote, Invoice, Fca} | No Version member — versioning is `ItineraryVersion`, separate | y |
| **Document Number** | Varchar | e.g. `Q1`, `INV2`, `FCA1` — display only, not load-bearing | n |
| **Fp (Fingerprint)** | Varchar | Drives the computed `Stale` flag | — (system) |
| **Frozen Header Snapshot** | Owned | Inquiry number, title, status, payment status, totals, due/paid | — (system) |
| **Deposit Snapshot** | Owned | Frozen deposit state at generation time | — (system) |
| **Lines** | Child collection | Incl. `ChangeStatus`/`CancelFee`/`Prior` amendment markers | y |
| **Milestones** | Child collection | Frozen milestone snapshot | n |
| **Travellers** | Child collection | Frozen traveler snapshot | n |

---

## Pending Change (Working Copy) Fields Table

| Field | Type | Comment | Mandatory (y/n) |
|-------|------|---------|-----------------|
| **ID** | PK | | y |
| **Itinerary** | FK | Unique per open copy (0 or 1 open at a time) | y |
| **Change Type** | Enum {PreBookingModif, PostBookingModif} | | y |
| **Is Open** | Bool | | y |
| **Trigger** | Enum {Seller, ClientRequest, Cancellation} | | y |
| **Staged Items / Travellers / Pax Config** | Child collections | Parented via `WorkingCopyId`, XOR against `ItineraryId` | n |
| **Staged Deposit** | Owned | Post-booking finance staging clone | n |

---

## User Stories

---

## Story: Create Itinerary

**As** Safari Planner
**I want to** create a new Itinerary against a CRM-ticket-referenced Inquiry
**So that** I can start building a priced trip proposal for an Agency's client

**Anchored on**: `itinerary-builder-demo/src/features/inquiries/CreateItineraryDialog.tsx` + `store.tsx` (code-verified, not inferred from story text) — see Open Decisions for the prototype-vs-backend divergences this surfaced.

### Pre-condition
Authorized Safari Planner/Admin on the Itineraries List screen

### Acceptance Criteria
- Clicking "Create" opens a Create Itinerary screen/modal reachable via a deep-linkable route (not just local component state)
- A single **"Inquiry (CRM ticket reference)"** field — free-text, pre-filled with an auto-suggested value, fully editable; UI copy: "Sourced from the CRM ticket... options inherit it (e.g. `HS-563528-2`)." **There is no New/Existing-Inquiry toggle and no dropdown to pick an existing inquiry** — confirmed absent from the prototype.
- Agency/Agent selection is a single combined field; selecting an Agent auto-derives its Agency; only active Agencies/Agents are selectable
- Lead Traveler first/last name required; Travel Date From required, To defaults to From if left blank and must be ≥ From (code-confirmed: both Lead Traveler fields are required/validated; `travelDateTo: travelDateTo || travelDateFrom`; an explicit "End date must be on or after start date" check exists)
using a **2–17 dropdown that defaults new entries to 8** (backend docs use Child default 10 — see Open Decisions).
- **Destinations are not captured on Create Itinerary** — settled current behavior. No Destinations UI, validation, or state; create persists `destinations: []`. (An earlier prototype sync briefly required a multi-select; that was removed.)
- Submitting with valid data creates the Itinerary in `Draft` status (set automatically server-side, not a user-facing field in this dialog) and navigates directly into the Builder for that itinerary
- Server-side (422) field errors map back onto the same form fields the client validated, converging into one error-display path
- ~~Leaving with unsaved changes triggers a discard-confirmation prompt~~ — **removed, confirmed wrong**: Cancel closes the dialog immediately in the prototype, with no dirty-check

### Functional Requirements
- **IB 1.1**: SOL shall support creating an Itinerary against an Inquiry, producing an Itinerary in `Draft` status. The prototype create flow is a single path keyed on a CRM ticket reference (free-text, editable) — it does not expose a distinct "select an existing Inquiry from a searchable list" UI path. Build the prototype's single-path create UX; backend still supports the Inquiry relation model.
- **IB 1.1.a**: On create, SOL shall auto-seed the global `PaxConfigEntry` set and corresponding `Traveller` placeholder rows from the submitted Adults/Children/Infants counts + child ages. The prototype captures Resident/Non-Resident sub-counts per pax type at creation — how that maps into auto-seeding / `Traveller.Origin` is under Open Decisions; build the Res/Non-Res capture UI as shown.
- **IB 1.1.b**: Destination/Location validation applies when destinations are submitted. Create Itinerary does **not** capture destinations (settled) — so this validation has no create-dialog UI to attach to. Destinations may still be managed elsewhere on the itinerary after create if/when that surface exists.
- **IB 1.1.c**: `Inquiry.InquiryNumber` (business term "Itinerary Ref") shall be allocated per-tenant, concurrency-safe, on Inquiry creation, format `{Prefix}{Year:D2}{Seq:D6}`. Prototype display format differs — build against the backend allocation rule; one-field vs two-field create UX is under Open Decisions.
- **IB 1.1.d**: SOL shall capture a `CrmTicketReference` (manual, free-text, nullable) on the Inquiry at creation — manual entry only this epic. The prototype's single "Inquiry (CRM ticket reference)" field is this same concept, and lines up with this requirement.
- **IB 1.2**: The Itinerary header shall consist of the fields defined in the Data Structure below.

### Business Rules
- Agency/Agent is a single combined field; selecting an Agent auto-derives its Agency; only active Agencies/Agents are selectable.
- Travel Date To defaults to Travel Date From if left blank, and must be ≥ From.
- **Destinations are not on Create Itinerary** (settled). Do not build a required Destinations multi-select on create.
- Pax counts are captured as Resident/Non-Resident sub-splits per pax type (Adults, Children, Infants) in the prototype, not flat counts (seeding mapping under Open Decisions).
- Child ages use a **2–17** dropdown. Prototype defaults new entries to **8**; backend auto-seed docs use Child **10**. Build the dropdown UI; which default is correct is under Open Decisions.
- `CrmTicketReference` is manual-entry only for this epic — HubSpot-automated population is explicitly out of scope (see IB 1.1.d, Out of Scope).
- **Reference model**: the prototype models Inquiry and Itinerary as **one flat record** with a single CRM-derived display reference; the backend has separate `InquiryNumber` + `CrmTicketReference`. Build create against the prototype's one visible CRM-ticket field for now; whether the real screen also surfaces the system Itinerary Ref is under Open Decisions. Backend entities remain the architecture model.

### Itinerary Fields Table
Scoped to what the prototype's create dialog actually captures or sets, per the code-verified anchor above. The full backend schema (including `Option Number`, `Status`, `Presentment Currency`, and the separate Inquiry entity with its own fields) remains documented in the master **Inquiry Fields Table** / **Itinerary Fields Table** sections earlier in this doc — those three fields are omitted below because they're confirmed absent from this create flow, not because they don't exist on the backend:

| Field | Type | Comment | Mandatory (y/n) |
|-------|------|---------|-----------------|
| **CRM Ticket Reference** | Varchar | Free-text, auto-suggested, editable — the prototype's one reference field; maps to the backend's `CrmTicketReference` (IB 1.1.d) | y |
| **Agency** | FK | See [01-Agencies-Management-Epic](01-Agencies-Management-Epic.md) | y |
| **Agent** | FK | Optional specific Agent under the Agency; auto-derives Agency when set | n |
| **Travel Date From / To** | Date | To defaults to From if left blank at create, must be ≥ From | y / n |
| **Lead Traveler First/Last Name** | Varchar | Computed `LeadTravelerName` | y |
Resident/Non-Resident sub-split per pax type, per the prototype — not a single flat count

**Omitted from this story, confirmed absent from the create flow (see master Fields Tables for backend truth)**:
- **Option Number** — system-assigned server-side, not modeled anywhere in the prototype's create flow or data model.
- **Status** — set automatically to `Draft`; not a user-facing field in the create dialog.
- **Presentment Currency** — not present in the prototype create dialog or Its itinerary data model; stays server-side unless product later surfaces it (Open Decisions).
- **Destination(s)** — omitted from Create Itinerary (settled). No UI/validation/state; create uses `destinations: []`.

---

## Story: View/Search Itinerary List

**As** Safari Planner/Sales/Finance/Ops
**I want to** view, search, sort, and filter the Itineraries List
**So that** I can find and manage itineraries efficiently

### Pre-condition
Authorized user on the Itineraries List screen

### Acceptance Criteria
- The list is a table with columns: Inquiry No., Itinerary Title, Agency/Agent, Safari Planner, Travel Dates, Status, Payment, Total, Balance, Last Updated, Actions
- Search is dynamic, begins after 3 characters, matches Inquiry No./Title/Agency/Agent/Lead Traveler/Safari Planner
- Any column may be sorted; columns without backend sort support are explicitly documented as "current page only" until server sort is added
- A Filters panel supports Status, Payment Status, Agency, Destination, Travel Dates, Created Dates, and a Hide Completed toggle; applied filters show as removable chips with overflow handling
- Zero itineraries at all shows a "no itineraries yet" empty state with a Create CTA
- Zero itineraries matching search/filters shows a distinct "no matches" empty state with a Clear Filters CTA
- Payment/Total/Balance/Last Updated columns show real values, not placeholders (implementation gap — see Open Decisions; non-blocking per program decision)

### Functional Requirements
- **IB 2.1**: SOL shall show the Itineraries List for authorized users as a three-level tree (Inquiry → Itinerary/Option → Sub-quote) with the columns listed in the Data Structure below.
- **IB 2.1.b**: The Hold Status column shall display the single nearest-expiring active hold.
- **IB 2.1.c**: The Margin column shall show CPS Margin %.
- **IB 2.1.d**: The list's row actions shall expose two distinct entry points — Open Builder (primary/authoring) and Open Quote (read-optimized, Quoted+ only).
- **IB 2.2**: SOL shall support dynamic search across Inquiry No., Itinerary Title, Agency, Agent, Lead Traveler Name, and Safari Planner.
- **IB 2.3**: SOL shall support sorting by any backend-declared sortable field.
- **IB 2.4**: SOL shall support filtering by Status, Payment Status, Agency, Destination, Travel Date From/To, Created On From/To, and a "Hide completed" toggle.
- **IB 2.5**: SOL shall support keyset pagination via the modeled `cursor` field.
- **IB 2.6**: SOL shall show distinct empty states for "no itineraries yet" vs. "no matches."

### Business Rules
- Search begins matching only after 3 characters are entered.
- Sortable fields are limited to the backend-declared `ItinerarySortBy` enum (`None, InquiryNumber, DateFrom, DateTo, LeadTravelerLastName, CreatedAt, Status`); columns without a backend sort key remain client-page-only sorted (current page only, max 50 rows) until added to the enum or server pagination ships.
- Filter chips render as removable, with a "+N more" overflow affordance.
- Hold Status resolution: fewest days left wins; an already-expired hold wins over any future one; count/per-service breakdown is secondary detail on hover/expand only (IB 2.1.b).
- Open Quote is available only for itineraries at `Quoted` status or later (IB 2.1.d); which view opens by default is governed by status-aware landing (IB 8.7).
- Payment/Total/Balance/Last-Updated/Hold Status/Margin are required columns (IB 2.1.a/2.1.b) — non-blocking per program decision (see Open Decisions); they still need to be built.

### Itinerary Fields Table
Hold Status and Margin are derived/list-only columns, not stored Itinerary fields — flagged as such below rather than presented as regular fields:

| Field | Type | Comment | Mandatory (y/n) |
|-------|------|---------|-----------------|
| **Inquiry (FK) / Option Number** | FK / Int | Drives Inquiry No. column and the three-level tree | y |
| **Title** | Varchar | Itinerary Title column | n |
| **Agency / Agent** | FK | Agency/Agent column | y / n |
| **Status** | Enum | Status column; drives ItinerarySortBy | y |
| **Travel Date From / To** | Date | Travel Dates column | y / n |
| **Payment Status** | Enum | Payment column (currently placeholder — IB 2.1.a) | y |
| **Total Net / Total Sell / Total Outstanding** | Decimal(18,2) | Total/Balance columns (currently placeholder — IB 2.1.a) | — (system) |
| **Hold Status** *(list-only, derived)* | Enum-like | Nearest-expiring active hold across the Itinerary's Holds (see Commercial Fields Table); **not yet on `ItineraryListItem`** | — (system) |
| **Margin** *(list-only, derived)* | Decimal | CPS Margin % — see Itinerary Fields Table `CPS Margin %` | — (system) |

---

## Story: Add Service Line

**As** Safari Planner
**I want to** add a service line of any type (Accommodation, Activity, Transport, Flight, or Fee/Other) to the itinerary
**So that** the client's trip components are priced and included, using each type's own configuration surface

### Pre-condition
Authorized Planner/Ops/Finance/Admin on an itinerary in Draft status (or with an open Pending Change)

### Acceptance Criteria

**Common to every service type**
- User selects a Supplier/Service via "Find a supplier or service" (IB 4.5), which establishes the configuration context below
- Unassigned travelers are visible in a distinct pool, separate from the per-room/per-vehicle/per-item assignment targets described per type below
- User can assign/unassign a traveler to/from a specific room, vehicle, or activity item as the line is configured; a room/vehicle/line exceeding its stated capacity is visually flagged, but is not hard-blocked from saving
 (see IB 5.2.a)
- Once the line has been added (see below), the user may request a supplier Hold on it if it's still an unlocked `New` line with no existing active hold covering its current fingerprint; the Hold's expiry is shown client-side from its stored expiry date
- A live price breakdown is shown before the line is committed
- User may select a Catalog Promotion or leave none; if an active promotion is already selected when adding another line, a confirmation dialog appears before proceeding
- Clicking "Add to itinerary" persists the line, triggers a recompute, and the line appears in the itinerary's line list with computed Net/Sell/Margin
- Attempting this action on a Quoted/Invoiced/Confirmed/Vouchered itinerary with no open Pending Change is rejected (409) with a message directing the user to return to Draft or open a Pending Change

**Accommodation**
- User selects Location and Supplier, sets stay dates (defaulting to itinerary travel dates, overridable), and meal basis
- User adds one or more rooms, each with a type (Single/Twin/Double/Triple/Family, each with a fixed capacity) and optional per-room date override; **a room is duplicated one-at-a-time via an explicit "Duplicate" action** — there is no quantity field that fans out multiple identical rooms (revised from an earlier sync — see IB 4.2.h)
- User assigns travelers to each room (from the itinerary's traveler roster, or the currently unassigned pool, or via a bulk **"Auto-assign"** action — IB 4.2.h); a room showing more assigned travelers than its capacity is flagged
- A live per-room price breakdown (by traveler-type rate cell × nights) is shown before committing
- User may add Extras (mandatory ones pre-selected/locked, optional ones toggleable, each with a quantity) and a Custom Extra

**Transportation**
- There is **no Transfer/Hire mode** (settled — IB 4.2.d). The panel is Location + Supplier + Service selection
- User adds one or more vehicles (type, capacity, rate) and assigns travelers per vehicle, or uses "auto-assign travelers across vehicles"

**Flight**
- User selects a Catalog Flight service by route (e.g. "Nairobi – Amboseli") — there is no separate From/To location field pair, since the route is carried by the Service itself
- **One-way only** — the return-trip toggle has been removed (revised from an earlier sync — see IB 4.2.i). Departure time is now free-text entry, not fixed time-slot buttons.
- Charter/capacity is now shown **only when the selected Service's name matches "charter"**, rather than always shown for Flight lines (see IB 4.2.i); when shown, required-charter count is auto-computed from the itinerary's assigned traveler roster, not a manual counter
- If assigned pax doesn't cleanly fit the selected charter capacity, the user is offered a **split** (multiple charters) or **squeeze** (over-capacity on one charter, with inducement-fee and supplier-approval messaging) resolution (IB 4.2.g). Build this overflow UX; inducement-fee pricing ownership is under Open Decisions.

**Activity**
- User selects Supplier/location and adds one or more dated activity items, each with per-item traveler assignment
- User may use "add all unassigned travelers" as a bulk action
- User may add Extras and select a Promotion (both in scope for Activity lines)

**Fee/Other**
- User selects Supplier/location and dates, then enters a flat qty × unit price, or itemized sub-lines

### Functional Requirements

**Common (all service types)**
- **IB 4.1**: SOL shall support adding, editing, and removing Itinerary lines (`ItineraryItem`) of type Accommodation, Activity, Transport, Flight, Fee, or Other — either Catalog-backed (snapshotting a `RateRuleSnapshot`) or manual/ad-hoc.
- **IB 4.1.a**: Every builder write shall be rejected with 409 unless `Itinerary.Status == Draft`, except when routed onto an open Pending Change.
- **IB 4.1.b / 4.1.b.i**: SOL shall support Extras as child lines, each with a quantity, auto-refreshing eligible extras when the Room (Service/ServiceOption) changes.
- **IB 4.1.c**: Changing a line's travel date shall re-evaluate its frozen rate snapshot or re-resolve from Catalog if outside the snapshot's validity window.
- **IB 4.1.d**: A line with no resolvable Catalog rate for a future date shall be marked `Hypothetical` and priced via uplift approximation, or `Invalid` if no prior rate exists.
- **IB 4.2.a**: SOL shall show a live per-line price breakdown (by traveler-type rate cell × nights/units) as rooms/vehicles/activity items are configured, before the line is committed.
- **IB 4.5**: "Find a supplier or service" is the single entry point for adding any service type.
- **IB 5.1**: SOL shall maintain a `Traveller` roster per itinerary, auto-seeded from pax config, that the per-line assignment below draws from.
- **IB 5.2**: SOL shall support assigning/unassigning specific Travellers to the newly added line (`PUT items/{itemId}/travellers`), unique per `(ItemId, TravellerId)`.
- **IB 3.2.a**: SOL shall surface a non-blocking `PAX_DIVERGENCE` warning (not an error) if the global pax target diverges from the actual assigned-traveler count on lines.
- **IB 10.3**: SOL shall support requesting a Hold on the added line once it is an unlocked `New` line with no active hold already covering its current fingerprint.
- **IB 6.1**: Every builder mutation dispatches the pricing engine before persisting. *(The compounding formula itself is out of scope for this story — see IB 6.2/6.N.)*

**Accommodation (IB 4.2 bullet, 4.2.b, 4.2.c, 4.2.h)**
- Supplier/location, stay dates, meal basis/Option at the Service level, rooms (type/capacity/date override; duplicated via an explicit action, not a quantity field — IB 4.2.h), pricing per room, Total (Client Price) per Service, traveler assignment per room (including bulk Auto-assign — IB 4.2.h), extras, promotions, supplier notes.
- The Accommodation selection model is Service → ServiceOption (basis) → Rate(s) (rooms), priced via the applicable ContractedRate (season) × Option × Rate cell (IB 4.2.b).
- Total (Client Price) per Service UI is confirmed in scope (IB 4.2.c).

**Transportation (IB 4.2 bullet, 4.2.d)**
There is **no Transfer/Hire mode** (IB 4.2.d). Configuration surface is supplier/location + Service selection, then vehicles

**Flight (IB 4.2 bullet, 4.2.e, 4.2.g, 4.2.i)**
- **One-way only** (return-trip toggle removed — IB 4.2.i), supplier/service, charter/capacity — now conditional on the Service name matching "charter" rather than always shown (IB 4.2.i) — with auto-computed required-charter count, per-PAX-band rates, extras, promotions. No separate From/To location fields — Flight services are defined/named by route in Catalog. Departure time is free-text entry, not fixed time-slot buttons (IB 4.2.i).
- Required-charter pax now derives from the assigned traveler roster; a min/max-capacity overflow mode offers split (multiple charters) vs. squeeze (over-capacity, inducement-fee + supplier-approval) resolution (IB 4.2.g).

**Activity (IB 4.2 bullet, 4.2.f)**
- Supplier/location, one-or-more dated activity items, per-item traveler assignment, "add all unassigned travelers" bulk action. Extras/Promotions are confirmed in scope; the prototype's Days of Week field has been removed from scope.

**Fee/Other (IB 4.2 bullet)**
- Supplier/location, dates, flat qty × unit price, or itemized sub-lines.

### Business Rules

**Common**
- Builder Mutation Gate: rejection reason differs by context — "return to Draft to edit" (Quoted/Invoiced) vs. "use Pending Changes" (Confirmed/Vouchered) — IB 4.1.a.
- Two pax concepts coexist by design: the global trip-level `PaxConfig` (Adult/Child/Infant) and the per-line `ItemTraveller` assignment set (Adult/Child/Infant/**Teen** — Teen only ever appears at line level) — IB 3.2.b.
- A line/room/vehicle exceeding its stated capacity is visually flagged, but not hard-blocked from saving.
- Hold state is one-way `HELD ↔ RELEASED`; there is no persisted "expired" flag — expiry is derived client-side from `ExpiresAt`, and there is no dedicated expire endpoint (IB 10.3).
- Pricing itself (compounding, margin/commission/uplift, promotion computation) is deliberately out of scope for this story — see IB 6.N/7.N for that math; adding a line triggers a reprice, but this story only covers the configuration surface that triggers it, not the pricing rules themselves.
- If an active promotion is already selected when adding another line, a confirmation dialog appears before proceeding (IB 7.4).

**Accommodation**
- Basis (Option) applies at the Service level — there is no case where different PAX on the same stay need a different basis, so one Basis governs all rooms/guests on that Service (IB 4.2.b).
Build room selection against Service → ServiceOption → Rate(s). Explicit `rateId` on `AddItineraryItem` is under Open Decisions (IB 4.2.b).
- Extras: mandatory ones are pre-selected/locked, optional ones toggleable, each with a quantity; adding a different room instance of the same Service/Option leaves eligible extras unchanged (only quantities/prices recalculate) — IB 4.1.b.i.
- Pricing is per room — each room is priced as its own Service (IB 4.2, business clarification).
- Rooms are added one-at-a-time via "Duplicate," not a quantity multiplier; capacity math is per-row (IB 4.2.h) — this reverses the earlier quantity-field description in this doc.

**Transportation**
There is **no Transfer/Hire mode** (IB 4.2.d). Do not build a mode toggle; the configuration surface is Location + Supplier + Service.
Vehicles are configured with type/capacity/rate. Exact per-vehicle pricing model is under Open Decisions (IB 4.2.d).

**Flight**
- The route (e.g. "Nairobi – Amboseli") is carried by the selected Catalog Service itself — confirmed intentional, not a missing field (IB 4.2.e).
**One-way only** — no return-trip toggle (IB 4.2.i). Round-trip intent for a later epic is under Open Decisions.
- Charter/capacity section now conditional on the Service name matching "charter," rather than always shown for Flight lines (IB 4.2.i).
- Required-charter pax is derived from the assigned traveler roster, not entered manually (IB 4.2.g).
Split-vs-squeeze overflow handling (inducement fee, supplier approval) is current prototype UX (IB 4.2.g). Build the overflow UX; whether inducement fee is priced by `IOfferEngine` is under Open Decisions.

**Activity**
- Extras and Promotions are confirmed in scope for Activity lines, not intentionally omitted (IB 4.2.f).

### Itinerary Item (Line) Fields Table
One shared schema across all service types, discriminated by `Service Type`:

| Field | Type | Comment | Mandatory (y/n) |
|-------|------|---------|-----------------|
| **ID** | PK | Stable across Fold (preserved, not re-keyed) | y |
| **Service Option (FK)** | FK (Catalog) | Null = manual/ad-hoc line | n |
| **Service Type** | Enum {Accommodation, Activity, Others, Transport, Flight, Fee} | Discriminates which type-specific Acceptance Criteria/rules above apply | y |
| **Supplier** | FK | Snapshotted at pick time | y |
| **Rate Type** | Owned {ChargePer × TimeUnit} | Person/Unit × Night/Day/Stay — e.g. per-room (Accommodation), per-vehicle (Transport), per-PAX-band (Flight) | y |
| **Start Date / End Date** | Date | Stay/transfer/flight/activity dates | y |
| **Units / Quantity** | Int | Vehicle count, activity-item count, or flat qty, depending on type. **Not used for rooms** — Accommodation rooms are now added one-per-line via a "Duplicate" action rather than a quantity multiplier (IB 4.2.h) | y |
| **Order** | Int | Manual sort position (IB 4.4) | y |
| **Price Breakdown** | Owned | Per-PaxType net/rack/sell cells; no tax | — (system) |
| **Rate Snapshot** | Owned | Frozen `RateRuleSnapshot` at pick/reprice time | — (system) |
| **Hypothetical** | Bool | Set when no rate resolves for a future date | — (system) |

**Note**: rooms, vehicles, activity items, and extras are all configured **within** a line via the Catalog `Rate[]`/`ServiceOption[]`/`ContractedRate[]` shape (IB 4.2.b) rather than as their own separate entity/fields table — there is no dedicated "Room," "Vehicle," "Activity Item," or "Extra Line" fields table distinct from the Itinerary Item shown above, for any service type.

### Traveller Fields Table
| Field | Type | Comment | Mandatory (y/n) |
|-------|------|---------|-----------------|
| **Pax Type** | Enum {Adult, Child, Infant, Teen} | Teen only ever appears at line-assignment level | y |
| **Pax Seq** | Int | Monotonic → derives display Tag (e.g. `ADT1`) | — (system) |
| **Name** | Varchar | | n |
| **Age** | Int | Defaults: Adult 35, Child 10, Infant 1, Teen 16 | n |
| **Origin** | Varchar | Resident / Non-Resident | n |

**Note**: the per-line assignment itself (`PUT items/{itemId}/travellers`) is a join between `Traveller` and `ItineraryItem` referenced narratively in the doc as `ItemTraveller` (IB 3.2.b) — there is no dedicated `ItemTraveller` fields table today (see Open Decisions).

### Holds (Inferred Fields)
No dedicated Holds Fields Table exists in this doc (see Open Decisions) — the Commercial (Supplier Facts) Fields Table's `Holds` child collection points to one that isn't defined. Inferred from the IB 10.3 narrative and UX Reference only, not confirmed against a real schema:

| Field | Type | Comment | Mandatory (y/n) |
|-------|------|---------|-----------------|
| **Status** | Enum {Held, Released} | One-way; no persisted "expired" value | y |
| **Expires At** | DateTime | "Expired" is derived client-side, not a stored status | n |
| **Reference** | Varchar | | n |
| **Comment** | Varchar | | n |

---

## Story: Update Service Line

**As** Safari Planner
**I want to** update an existing service line of any type (Accommodation, Activity, Transport, Flight, or Fee/Other)
**So that** I can correct or adjust a service's details as trip requirements change, with pricing recomputed accordingly

### Pre-condition
Authorized Planner/Ops/Finance/Admin on an itinerary in Draft status (or with an open Pending Change), viewing an existing line

### Acceptance Criteria

**Common to every service type**
- User opens an existing line's configuration panel, pre-populated with its current values
- User can reassign travelers on the line — moving a traveler between rooms/vehicles/activity items, or between an assigned target and the unassigned pool; a room/vehicle/line exceeding its stated capacity is visually flagged, but is not hard-blocked from saving
per IB 5.2.a. Same accepted accessibility gap
- If the line already carries an active supplier Hold, the user can release it (one-way; a new Hold must be requested afterward if needed again); if unlocked and `New` with no active hold, the user can request one
- Changing the line's travel date re-evaluates its frozen rate snapshot if the new date stays within the snapshotted rate plan's validity window; if it falls outside that window, SOL re-resolves a fresh rate from Catalog
- A live price breakdown reflects each change before it's saved, and saving triggers a recompute
- Attempting this action on a Quoted/Invoiced/Confirmed/Vouchered itinerary with no open Pending Change is rejected (409) with a message directing the user to return to Draft or open a Pending Change

**Accommodation**
- User may change the room(s) (type/date override), duplicate an existing room via the "Duplicate" action (not a quantity field — IB 4.2.h), the meal basis/Option, or the assigned travelers per room (individually or via bulk "Auto-assign" — IB 4.2.h); a room showing more assigned travelers than its capacity is flagged
- Changing to a different Room Service/Option triggers a full refresh of eligible Extras (mandatory ones re-selected/locked, optional ones re-exposed); changing only dates on the same Room Service/Option leaves eligible Extras unchanged, only recalculating prices

**Transportation**
There is no Transfer/Hire mode (IB 4.2.d); the user may change the vehicle(s)

**Flight**
same Open Decisions item as Add Service Line

**Activity**
- User may add, remove, or reconfigure dated activity items and their per-item traveler assignments

**Fee/Other**
- User may change the qty × unit price, or the itemized sub-lines

### Functional Requirements

**Common (all service types)**
- **IB 4.1**: SOL shall support editing Itinerary lines (`ItineraryItem`) of type Accommodation, Activity, Transport, Flight, Fee, or Other — either Catalog-backed or manual/ad-hoc.
- **IB 4.1.a**: Every builder write — including an edit — shall be rejected with 409 unless `Itinerary.Status == Draft`, except when routed onto an open Pending Change.
- **IB 4.1.b / 4.1.b.i**: Editing a line's Room (Service/ServiceOption) auto-refreshes eligible Extras; editing only quantity/dates on the same Room Service/Option leaves eligible Extras unchanged.
- **IB 4.1.c**: Changing a line's travel date shall re-evaluate its frozen rate snapshot, or re-resolve from Catalog if the new date falls outside the snapshot's validity window.
- **IB 4.1.d**: If an edit leaves a line with no resolvable Catalog rate for a future date, SOL shall mark it `Hypothetical` and price it via uplift approximation, or `Invalid` if no prior rate exists.
- **IB 4.2.a**: SOL shall show a live per-line price breakdown as the edit is made, before it's saved.
- **IB 5.2**: SOL shall support assigning/unassigning specific Travellers to the existing line (`PUT items/{itemId}/travellers`), unique per `(ItemId, TravellerId)` — reassignment is an edit to an already-added line, same contract as Add Service Line.
- **IB 3.2.a**: SOL shall surface a non-blocking `PAX_DIVERGENCE` warning if reassignment leaves the global pax target diverging from actual assigned-traveler counts on lines.
- **IB 10.3**: SOL shall support requesting a Hold on the line (if unlocked `New` with no active hold) or releasing an existing Hold on it.
- **IB 6.1**: Saving an edit dispatches the pricing engine before persisting. *(The compounding formula itself is out of scope for this story — see IB 6.2/6.N.)*

**Accommodation (IB 4.2 bullet, 4.2.b, 4.2.c, 4.2.h)** — same configuration surface as Add Service Line, applied to an existing line: rooms (duplicated via an explicit action, not quantity), basis at the Service level, pricing per room, Total (Client Price) per Service, bulk Auto-assign.

**no Transfer/Hire mode** (settled — IB 4.2.d)

**Flight (IB 4.2 bullet, 4.2.e, 4.2.g, 4.2.i)** — same configuration surface as Add Service Line: route-based service (unchanged once picked), one-way only, charter/capacity conditional on Service name matching "charter" and re-derived from the assigned roster, split-vs-squeeze overflow re-evaluated on edit.

**Activity (IB 4.2 bullet, 4.2.f)** — same configuration surface as Add Service Line: dated activity items, Extras/Promotions in scope.

**Fee/Other (IB 4.2 bullet)** — same configuration surface as Add Service Line: flat qty × unit price, or itemized sub-lines.

### Business Rules

**Common**
- Builder Mutation Gate applies identically to edits: rejection reason differs by context — "return to Draft to edit" (Quoted/Invoiced) vs. "use Pending Changes" (Confirmed/Vouchered) — IB 4.1.a.
- Rate re-evaluation on date change (IB 4.1.c): same validity window → keep the frozen snapshot; outside the window → fresh pick + re-snapshot from Catalog.
- Reassignment uses the same two-pax-model design as Add Service Line: the global `PaxConfig` and the per-line `ItemTraveller` set (with Teen only at line level) remain distinct concepts — IB 3.2.b.
- A room/vehicle/line exceeding its stated capacity after reassignment is visually flagged, but not hard-blocked from saving.
- Hold release is one-way; there is no persisted "expired" flag and no dedicated expire endpoint — same rule as Add Service Line (IB 10.3).
- Pricing itself (compounding, margin/commission/uplift, promotion computation) is deliberately out of scope for this story — see IB 6.N/7.N; editing a line triggers a reprice, but this story only covers the configuration surface that triggers it.

**Accommodation**
- Extras eligibility refresh is keyed to the Room Service/Option, not to the line generally — changing dates alone does not reset Extras (IB 4.1.b.i).
listed under Open Decisions (IB 4.2.b).
- Adding another room to an existing line uses "Duplicate," not a quantity edit (IB 4.2.h) — this reverses the earlier quantity-based description in this doc.

**Transportation**
There is no Transfer/Hire mode to edit (IB 4.2.d). Per-vehicle pricing model question applies to edits too (Open Decisions).

**Flight**
inducement-fee pricing scope under Open Decisions (same as Add Service Line).
- One-way only — there is no return-trip toggle to edit (IB 4.2.i); charter/capacity is only editable when the Service name matches "charter."

### Itinerary Item (Line) Fields Table
Identical schema to Add Service Line's table — editing a line does not change its shape, only its field values:

| Field | Type | Comment | Mandatory (y/n) |
|-------|------|---------|-----------------|
| **ID** | PK | Stable across Fold (preserved, not re-keyed) | y |
| **Service Option (FK)** | FK (Catalog) | Null = manual/ad-hoc line | n |
| **Service Type** | Enum {Accommodation, Activity, Others, Transport, Flight, Fee} | Not changeable via edit — changing type means removing and re-adding | y |
| **Supplier** | FK | Re-snapshotted if the edit changes the picked Catalog Service | y |
| **Rate Type** | Owned {ChargePer × TimeUnit} | Person/Unit × Night/Day/Stay | y |
| **Start Date / End Date** | Date | Editable; triggers IB 4.1.c re-evaluation | y |
| **Units / Quantity** | Int | Editable (vehicle/activity-item count, or flat qty). **Not used for rooms** — an existing room is duplicated via an explicit action, not a quantity edit (IB 4.2.h) | y |
| **Order** | Int | Manual sort position (IB 4.4); not affected by this story | y |
| **Price Breakdown** | Owned | Recomputed on every save | — (system) |
| **Rate Snapshot** | Owned | Refreshed per IB 4.1.c on date-change-outside-window | — (system) |
| **Hypothetical** | Bool | Re-evaluated on every edit (IB 4.1.d) | — (system) |

### Traveller Fields Table
Identical to Add Service Line's table — reassignment reads/writes the same `Traveller` roster, it doesn't change its shape:

| Field | Type | Comment | Mandatory (y/n) |
|-------|------|---------|-----------------|
| **Pax Type** | Enum {Adult, Child, Infant, Teen} | Teen only ever appears at line-assignment level | y |
| **Pax Seq** | Int | Monotonic → derives display Tag (e.g. `ADT1`) | — (system) |
| **Name** | Varchar | | n |
| **Age** | Int | Defaults: Adult 35, Child 10, Infant 1, Teen 16 | n |
| **Origin** | Varchar | Resident / Non-Resident | n |

**Note**: as with Add Service Line, there is no dedicated `ItemTraveller` fields table for the per-line assignment join itself (see Open Decisions).

### Holds (Inferred Fields)
Same gap as Add Service Line — no dedicated Holds Fields Table exists in this doc (see Open Decisions):

| Field | Type | Comment | Mandatory (y/n) |
|-------|------|---------|-----------------|
| **Status** | Enum {Held, Released} | Changes one-way on release; no persisted "expired" value | y |
| **Expires At** | DateTime | "Expired" is derived client-side, not a stored status | n |
| **Reference** | Varchar | | n |
| **Comment** | Varchar | | n |

---

## Story: Split Itinerary

**As** Safari Planner
**I want to** split an existing itinerary option into a new option under the same Inquiry
**So that** I can create a variant proposal — e.g. a multi-family booking needing separate quotes — without rebuilding from scratch

Splitting *under* a confirmed Itinerary to produce a **Sub-quote** is out of scope for this story (Sub-quote data model under Open Decisions — IB 1.3).

### Pre-condition
Authorized Planner/Ops/Finance/Admin viewing an existing Itinerary (option) with at least one committed New/Confirmed line

### Acceptance Criteria
- User triggers "Split" from an existing Itinerary option (list row action or itinerary detail action)
- Split creates a new sibling Option under the same Inquiry with committed items/travellers/pricing carried forward. Whether the UI pre-selects all lines or offers a subset checklist is under Open Decisions — build the Option-level split action; defer the subset-picker detail to that call.
- The new option is created under the same Inquiry, with the next sequential Option Number
- The new option starts as `Booking`-type (not `Brochure`-type, unlike Copy-as-Brochure), `Draft` status
per the Open Decisions item on copy-all vs subset
- Not copied: promotions, manual overrides, locks, supplier state, payments, vouchers, and documents — same drop-list as Copy-as-Brochure
- Any open Pending Change on the source is not folded into the split — only the committed baseline is copied
- Submitting a split navigates the user into the Builder for the new option
- Attempting this action on a source with no committed New/Confirmed line, or without authorization, is rejected with a clear error rather than creating an empty option

### Functional Requirements
- **IB 1.3**: SOL shall support Split (Option-level) as a first-class server-side operation that creates a new sibling Itinerary under the same Inquiry, with committed items/travellers/pricing carried forward from the source — not a client-side composition over the plain create flow.
- The new option shall be `Booking`-type, `Draft` status.

### Business Rules
- Split must be implemented server-side, not assembled client-side — the plain create flow (IB 1.1) does not carry lines/pax/pricing forward on its own, so a client-only implementation would mean reimplementing that copy logic in the frontend.
- The new option's Option Number shall be the next sequential number under the same Inquiry.
- `Type` on the split result is `Booking`.
- Copy-all vs subset selection for Split is under Open Decisions; build the Option-level split action regardless.
- Working assumption (by analogy with Copy-as-Brochure, IB 14.1): promotions, manual overrides, locks, supplier state, payments, vouchers, and documents are not copied; an open Pending Change is not folded in; the new option starts at Draft on the same lifecycle ladder.

*(Technical note, not spec-authoritative — see Technical Tasks (Backend): architecture review during drafting identified `CopyAsBrochureHandler`/`BrochureFactory` as an existing pattern with next-option-number computation and deep-copy mechanics Split could reuse. Background for backend estimation only — none of the business rules above are settled by that implementation detail.)*

### Itinerary Fields Table
No new fields are needed beyond what already exists (see the full **Itinerary Fields Table** earlier in this doc for the complete schema):

| Field | Type | Comment | Mandatory (y/n) |
|-------|------|---------|-----------------|
| **Inquiry** | FK | Parent Inquiry; the split result is a new sibling row under the same Inquiry | y |
| **Option Number** | Int | Next sequential number under the same Inquiry | y |
| **Type** | Enum {Booking, Brochure} | Split result is always `Booking` | y |
| **Status** | Enum | New option starts at `Draft` | y |

---

## UX Reference — Prototype Walkthrough & Reconciliation

This section maps the `itinerary-builder-demo` prototype's screens to the Functional Requirements above, and calls out where the prototype's UX should be **followed** vs where its underlying data/status model should be **overridden** by the real backend contract.

**Sync note**: this section reflects the prototype's git history through 2026-07-30. Re-check before relying on it if significant time has passed since.

### Screen Flow
`Inquiries List` → `Create Itinerary` (dialog) → `Builder` (`/build/:id`) → `Quote` (`/quote/:id`, optional detour) → `Quote Document` (`/quote-doc/:id`, paginated print-style cover/day-by-day/investment-breakdown/terms document — see IB 12.5.a) → `Summary` (`/summary/:id`, lifecycle control center)

### Follow this UX pattern as-is
- Inquiries List: search, filter drawer with live-count preview, filter chips with overflow, hierarchical **three-level** row display (Inquiry → Itinerary/Option → Sub-quote — see Key Entities and IB 1.3), once re-based on the real FK model instead of string parsing.
- Builder: left icon-rail per service type, center configuration panel with a persistent live Pricing section, right pane with cross-catalog quick search and a reorderable added-services list.
- Guest/Traveler assignment: **drag-and-drop only for MVP, platform-wide** (see IB 5.2.a). The prototype's per-service-type divergence as of the 2026-07-30 sync — Accommodation's added keyboard-accessible dropdown, Transportation's dropdown-only pattern — is superseded by this decision; follow the drag-and-drop guest-chip pattern only, not either prototype variant. The resulting lack of a keyboard-accessible path is a known, accepted MVP accessibility tradeoff, not an oversight.
- Summary: Summary-view / By-Day toggle for final review; sticky lifecycle-action footer; a **Vouchers** sub-view and a Cost/Sell/Everything price-display toggle (see IB 10.4.d and IB 6.2.c).
- Manual price override: reason-gated modal + visible audit entry (must be made durably persisted, not session-only).
- Quote Document (`/quote-doc/:id`): paginated print-style presentation (cover, day-by-day, investment breakdown, terms) is a reasonable reference for the real `QUOTE` document's rendered output. The per-supplier deposit terms (`DEPOSIT_RULES` table) are a good UX reference (IB 12.5.a). The hardcoded "proposal expires" language is **not** a good reference and must not be carried forward as-is (IB 12.5.a — Open Decisions). A separate payment-history sidebar hardcoding (fixed 3-instalment 25/35/40% schedule, fake refs) has the same problem — see IB 11.6.a.

### Override / reconcile before implementation
| Prototype behavior | Real requirement | Why |
|---|---|---|
| 12-value status enum incl. `TRAVEL_IN_PROGRESS`/`COMPLETED` | Backend's 11-value enum (IB 8.1) | Prototype invented two statuses with no backend equivalent |
| Inquiry↔Itinerary relationship encoded as a dash-suffixed string | Real FK: `Inquiry(1) → Itinerary(many)` via `OptionNumber` | Prototype has no `parentId`; fragile string parsing |
| Two parallel, disconnected pricing/data models (Builder's `AddedService`, numeric; Quote's `QuoteGroup/QuoteService`, string-formatted currency) | One canonical, fully-numeric line-item model across Builder and Quote/Invoice/FCA (IB 12.5) | The prototype's split is self-inflicted (string-formatted Quote model) — see IB 12.5's technical note for the current backend's implementation of this |
| Placeholder pricing constants (flat $390/night, $220/vehicle, 1.3× net:rack ratio, 10% flat agent commission) | Net-to-Sell pricing per IB 6.2 (compounding formula is the build target; independent finance sign-off under Open Decisions) | Prototype math is invented for demo purposes only, not a business rule source |
| "Days" only appear as a read-only derived view in Summary | Lines carry their own dates; there is no first-class "Day" entity anywhere (matches backend) | Confirms the backend's flat-ordered-lines model is correct; do not introduce a Day entity |
| Reorder's "Update date ranges?" dialog | Either wire real date-shift logic or remove the implied promise | Currently a no-op in the prototype despite implying an action |
| Lifecycle reason capture via `window.prompt()`, discarded after submit | Persisted reason fields (Lost Reason exists; confirm equivalents for Supersede/Cancel/Reopen) | Native prompt is not production UX and doesn't persist |
| Quote page's `PriceModal` "Save" button | Either remove or wire to a real persistence action | Currently closes the modal only, implies saving something it doesn't |
| No Pending Changes / Finance / Documents screens (all "coming soon" or absent) | Net-new UI required per IB 9.5, IB 11.6, IB 12.5 | Prototype never reached this depth of the domain |

---

## Technical Tasks (Frontend)

- Build Itinerary Detail/Builder page (`/itinerary/itineraries/{id}`) — currently does not exist; only Create + List ship today
- Integrate the full `SOL.Itinerary.Api` contract (~70 endpoints) beyond today's 2 (create, search)
Leave `DestinationMultiSelect` unused for Create Itinerary (destinations removed from create — settled); supersede or reuse only if destinations return on another surface
- Add Payment/Total/Balance/Last-Updated real data + sort support to the Itineraries List (currently placeholder "—")
- Implement cursor-based pagination on the Itineraries List (`cursor` field already modeled, unused)
- Design and build: line-item builder (5 service-type panels), traveler assignment UI, pricing/override panel, Pending Changes diff panel, Finance panel, Voucher/Hold management UI, Document generation/preview UI, History/Audit log viewer
- Resolve `createdBy` id-vs-display-name inconsistency with backend (currently patched client-side only for optimistic rows)
- Implement the traveler-assignment interaction pattern as drag-and-drop only, platform-wide, per the resolved MVP decision (IB 5.2.a) — no keyboard-accessible alternative for MVP; this is an accepted accessibility tradeoff, not an open design question
- Evaluate whether a shared `packages/types` itinerary contract package is warranted given the scope of this epic (currently an empty stub)

## Technical Tasks (Backend)

- Close carryover #5: add an `AgencyId → AgencyGroupId` lookup (same shape as existing commission/credit-terms lookups) and wire `OfferEngineService.GatherAsync` to call the existing `IMarginRuleLookupService.GetForScopeAsync` instead of reading `itinerary.CpsMarginPercent` directly — architecture review during drafting assessed this as a lookup fix, not a redesign (background for estimation, re-verify at implementation); blocked on an SME ruling for Agency↔AgencyGroup multi-group precedence
- Verify carryover #4 (rate/component snapshot fidelity) against the actual requirement (IB 6.6) before closing it — architecture review during drafting found `RateRuleSnapshot`/`ItineraryItemRateComponent` (migration `RateSnapshotFidelity`) already implementing this, but treat that as a starting point for verification, not a substitute for it
- Build the Split Itinerary endpoint (IB 1.3) as a dedicated backend endpoint following the `CopyAsBrochureHandler`/`BrochureFactory` pattern (next-option-number + deep-copy of committed items/travellers/pricing), with different copy semantics (subset of lines, non-Brochure type)
- Fix per-line pax taxonomy pricing (carryover #11): scope the change to `OfferEngineService.GatherAsync`/`BuildRateContext` so pax refs are derived per-line (`ItemTravellers`) instead of itinerary-wide; no `PUT items/{itemId}/travellers` contract change needed
- Resolve SME-dependent gaps listed under Open Decisions: #6 (hypothetical base-net source), #7 (multi-member promotion night targeting), `modifierType` combination/priority ordering
- Expose financial summary fields (Payment/Total/Balance/Last-Updated) on the `POST itineraries/search` response for the frontend list
Confirm exact `PaymentStatus` enum values for the Itinerary Fields Table (see Open Decisions)
- Confirm persisted-reason requirements for Supersede/Cancel/Reopen transitions (only Lost Reason confirmed persisted today)
- Backlog item (non-blocking, not part of carryover #4): Catalog has no free-of-charge concept — `IsFreeOfCharge` is always false

## Technical Tasks (QA)

- Build test suites around the lifecycle transition table (IB 8.2) — every valid transition + every invalid pair, per role
- Assert compounding (not additive) pricing math per IB 6.2 across all line types
- Test the Builder Mutation Gate (409 on non-Draft without open change) across every mutation endpoint
- Test Pending Change auto-open/auto-close (pre-booking) vs never-auto-close (post-booking) behavior explicitly
- Test the voucher-confirmation abort path (`ConfirmVouchers=false` → whole apply aborts, no partial write)
- Test cross-tenant access returns 404, not 403, throughout
- Test optimistic-concurrency 409s on stale `version` for every write endpoint
- Confirm Cognito role-provisioning prerequisites before asserting `Safari.Sales`-gated scenarios

---

## Related & Blocked Items

| Item | Status | Notes |
|------|--------|-------|
| Backend Phases 0–6 (engines, builder, lifecycle, supplier commercial, finance, documents, amendments/versions) | DONE (per openspec specs) | Primary technical foundation for this epic |
| Frontend Create Itinerary + Itineraries List | DONE (partial scope) | Header-only create; no builder/detail/lifecycle UI yet |
| `itinerary-builder-demo` UX prototype | REFERENCE ONLY | Not a data-model source of truth; see reconciliation table above |
| [01-Agencies-Management-Epic](01-Agencies-Management-Epic.md) | IN PROGRESS | Agency/Agent selection dependency for itinerary creation |
| [02-Manage-Suppliers-Epic](02-Manage-Suppliers-Epic.md) | IN PROGRESS | Supplier/Property data + Agency Group margin dependency (IB 6.4.a) |
AgencyGroup-scoped Margin Rules integration | Required (carryover #5); multi-group precedence under Open Decisions |
| Real Cancellation/Change fee configuration | Deferred (commercial) | `CancellationEngine`/`PolicyEngine` default to 0%; real rates out of scope this epic (see Open Decisions) |
| Tax Engine | OUT OF SCOPE (post-all-phases) | Hard-zero stub platform-wide |
| Currency FX Engine | OUT OF SCOPE (post-all-phases) | 1:1 identity stub |
| CRM (HubSpot) Integration Epic | **RECOMMENDED — NOT YET CREATED** | Follow-up epic to automate `CrmTicketReference` population (IB 1.1.d) once HubSpot integration is prioritized; no CRM adapter/webhook exists today |

---

## Open Decisions (non-blocking backlog)

This is the **only** place in this epic where undecided items appear. The main body above states current prototype/doc behavior as the buildable draft. Items here do not invent settlements — they track genuine stakeholder or architecture calls still needed. None of these gate delivery of the rest of this epic except where noted.

**Program note**: clint confirmed that correctness-affecting items (margin fallback, promo-targeting heuristic, per-night differential, hypothetical-line base-net source) ship as-is until separately prioritized — SOL can produce a wrong number for some inputs until each is closed. Spec authority: shipped backend code is background for estimation, not automatic settlement of a business requirement.

| Decision | Owner | Current main-body stance | Why it remains open |
|----------|-------|--------------------------|---------------------|
| Transport per-vehicle pricing model | Architecture / Catalog | Transportation configures Location + Supplier + Service, then vehicles (type/capacity/rate); no Transfer/Hire mode | Needs review of how Transport services are loaded in the database before confirming the pricing model (IB 4.2.d) |
| Flight round-trip vs one-way-only | Business / product | Flight lines are **one-way only** (return-trip toggle removed); free-text time; charter section conditional on Service name matching "charter" | Confirm whether round-trip is genuinely out of scope for this epic or a prototype simplification (IB 4.2.i) |
| Sub-quote data modeling | Business / architecture | Split at Inquiry → new Option; Split under a confirmed Itinerary → Sub-quote (terminal). Option-level Split story is in scope; Sub-quote is described but not buildable yet | Sub-quote (terminal level under a confirmed Option) needs a product decision on data shape before backend build (IB 1.3) |
| Split Option-level: copy-all vs planner-chosen subset | Product | Option-level Split copies committed items/travellers/pricing into a new sibling Option | Whether the UI presents all lines pre-selected or a subset checklist is not confirmed (Split Itinerary story) |
| "Promotions" vs "Specials" terminology | Business / design | This epic uses **Promotion** / `PromotionInstance` (backend types). Prototype UI labels read "Special(s)" | Confirm whether Specials is the intended doc/UI-wide term or UI-only wording (IB 7.4.a) |
| "Net/Rack/Sell" vs "Cost/Sell" + Cost/Sell/Everything toggle | Business / design | This epic uses **Net/Rack/Sell** (backend field names). Prototype pricing UI labels "Cost/Sell"; Summary has a Cost/Sell/Everything display-mode toggle | Confirm terminology mapping (is Cost = Net?) and whether the toggle is the intended Summary UX (IB 6.2.b, 6.2.c) |
| Vouchers Summary / "Issue voucher" vs auto-raise | Business / product | Backend requirement: vouchers auto-raise at Invoiced→Vouchered (no manual send). Prototype Summary adds a Vouchers sub-view with per-supplier cards, value-display toggle, and an "Issue voucher" action | Confirm whether "Issue voucher" maps to the auto-raise model or introduces a manual action not in the backend requirement (IB 10.4.d) |
| Quote "proposal expires on {date}" language | Business / product | Deposit half of `/quote-doc/:id` is resolved (per-supplier `DEPOSIT_RULES`). Do **not** adopt hardcoded proposal-expiry language as a business rule | Still a template constant, not sourced from any documented itinerary field — is proposal-expiry even in this epic's model, and if so from which field? (IB 12.5.a) |
| Payment-history sidebar fixed 3-instalment schedule | Business / product | Do not build against the prototype's fixed 25/35/40% fake schedule; real history must come from Payment Ledger / Milestones | Same hardcoding pattern as the resolved deposit split (IB 11.6.a) |
| Hypothetical-line base-net source | SME | Lines with no Catalog rate for a future date are marked Hypothetical and priced via uplift-adjusted approximation (never silent $0) | Exact source for "most recent available rate" / historical-projected rate spec not defined by business (IB 4.1.d) |
| Agency↔AgencyGroup multi-group margin precedence | SME | AgencyGroup-scoped margin is the required resolution path (ships with known fallback risk until fixed) | Many-to-many with no primary-group flag — needs ruling before 6.4.a fix signs off (IB 6.4.a) |
| Multi-member promotion night targeting | SME | Free-night / multi-member promo targeting uses best-effort heuristic | No confirmed business-rule oracle (IB 7.x carryover #7) |
| Catalog-backed Extras sequencing | Product / program | Extras support quantity; Catalog-backed Extras are a real requirement | Priority/sequencing for this epic vs later (IB 4.1.b) |
| Accommodation `rateId` on `AddItineraryItem` | Architecture | Stay = Service → ServiceOption (basis) → one or more Rates (rooms); rooms use Duplicate (not quantity); room types use stable ids in prototype | Confirm whether explicit `rateId` is a quick contract addition or a deeper change (IB 4.2.b) |
| Flight split-vs-squeeze / inducement fee scope | Architecture / business | Required-charter count derives from assigned roster; overflow offers split vs squeeze with inducement-fee / supplier-approval messaging in the prototype | Whether inducement fee is Catalog/booking-side only or must be priced by `IOfferEngine` (IB 4.2.g) |
| Overnight transfers | Business | N/A under current Transportation surface (no Transfer/Hire mode) | Was open before mode removal; reopen only if Transfer/Hire returns |
| Supplier list display field subset | Business / design | Supplier list shows name plus additional detail (Preferred, Head Office, Closeout, etc.) | Exact subset of badge/detail fields not specified (IB 4.5.a) |
| Create Itinerary: child-age default (8 vs 10) | Business / design | Create flow uses Resident/Non-Resident pax sub-splits; child ages via 2–17 dropdown. Backend auto-seed defaults document Child **10** | Prototype defaults new child ages to **8** — which is correct? |
| Create Itinerary: Res/Non-Res split into `PaxConfigEntry` | Product / architecture | Prototype captures Res/Non-Res sub-counts at create | Whether auto-seeding accepts that split (seed `Traveller.Origin`) or Origin stays post-creation assignment (IB 1.1.a) |
| Create Itinerary: one reference field vs two | Product / design | Prototype: one CRM-ticket reference field. Backend: `InquiryNumber` (Itinerary Ref) + separate `CrmTicketReference` | Whether the real screen shows one field or two |
| Presentment Currency on create UI | Product / design | Not in prototype create dialog; modeled on backend | Surface at create vs server-side only |
| Itinerary Ref settings exact schema | Architecture (minor) | Prefix / year-suffix tenant-configurable in Settings | Confirm exact `ItinerarySetting` field names before FE build (IB 1.1.c) |
| Exact `PaymentStatus` enum values | Backend confirm | Draft / Deposit-Paid / Partially-Paid / Fully-Paid / Overpaid / Refund-Pending listed as working set | Confirm against backend source before treating Fields Table as final |
| Line reorder date-shifting | Product | Reorder changes `Order` only; does not auto-shift dates | Prototype's "Update date ranges?" dialog is a no-op stub — wire real shift or remove the promise (IB 4.4) |
| Lifecycle persisted reasons (Supersede/Cancel/Reopen) | Backend / product | Lost Reason persists for Mark-Lost; use backend 11-value status enum (not prototype's 12) | Confirm equivalent persisted-reason fields for Supersede/Cancel/Reopen (IB 8.6) |
| Rate/component snapshot fidelity verification | QA / business at delivery | Requirement stands: per-component `RateRuleSnapshot` fidelity (IB 6.6) | Verify against actual behavior at delivery; do not treat prior code-review notes as confirmation |
| Missing dedicated fields tables (`ItemTraveller`, override audit, Holds, History/Computation Log) | Backend confirm | Narratively documented; inferred field lists in stories where needed | Confirm real schemas before FE builds those surfaces |
| Dual-shape list API / `createdBy` display | Backend / FE | FE defensively tolerates alternate shapes; `createdBy` patched client-side for optimistic rows | Canonical list response shape and display-name contract |
| Hold Status / Margin on list response | Backend | Required list columns (IB 2.1.b/c) | Not yet on `ItineraryListItem` — same exposure gap as financial columns |
| Real cancellation/change fee schedules | Commercial (deferred) | Engines exist; default 0%; out of scope to configure real rates this epic | Commercial decision sets a real rate later |
| Net-to-Sell compounding formula sign-off | Business / finance | Documented compounding order is the current backend implementation and the build target for this epic | Independent business/finance confirmation that this is the intended formula (IB 6.2) |
| Frontend Builder/Detail/Lifecycle/Finance/Document UI | This epic (primary deliverable) | Only Create + List ship today; full builder surface is this epic's delivery | Blocking for end-to-end UX — tracked here as the epic's own primary build scope, not an undecided rule |
| Payment/Total/Balance/Last-Updated on list | FE / BE (non-blocking) | Required columns (IB 2.1.a); placeholders until search response exposes real values | Implementation gap to close |
| Per-line pax taxonomy pricing | BE (non-blocking) | Pricing should reflect each line's assigned travelers (IB 3.3) | Currently reads global pax config — ships as-is until reprioritized |
| Per-night weekday-differential pricing | BE (non-blocking) | Required (IB 6.7) | Representative-weekday rate used for whole stay today |
| Prototype vs backend status enum / dual pricing models | FE build rule | Use backend 11-value enum; one canonical numeric line-item model (IB 8.1, IB 12.5) | Prototype invented statuses and dual Builder/Quote models — override, do not copy |

**Settled design flips (current behavior in the main body — not open):** Destinations removed from Create Itinerary; Transfer/Hire mode removed from Transportation; Accommodation rooms use Duplicate (not quantity); drag-and-drop-only traveler assignment for MVP; deposit-split on `/quote-doc/:id` replaced with per-supplier `DEPOSIT_RULES`; HubSpot CRM auto-fill descoped; Status Dashboard deferred.

---

## Assumptions

1. The shipped `backend/openspec/specs/itinerary-*` capability specs and actual C# source are treated as ground truth over the older `backend/docs/itinerary_*.plan.md` planning documents wherever they disagree.
2. The `itinerary-builder-demo` prototype is a UX reference only; its status enum, pricing math, and dual Builder/Quote data model are not carried forward as-is.
3. Tax and Currency FX remain explicitly out of scope for this epic's delivery, per the platform-wide stub engines.
4. Single-currency (USD) presentation is assumed for this phase, consistent with both the current frontend and the prototype.
5. Agencies/Agents remain non-SOL-user parties this phase (per [01-Agencies-Management-Epic](01-Agencies-Management-Epic.md)); this epic does not add agent self-service itinerary creation.
6. Cancellation/change fees remain at their configured 0% default until a commercial decision sets a real rate.
7. A "day-by-day" itinerary view is a derived/read presentation only (as in the prototype's Summary "By Day" toggle and the backend's flat, dated-line model) — there is no first-class "Day" entity to build.
8. Mobile/tablet support is out of scope unless explicitly requested (current frontend and prototype are both desktop-oriented).
9. Multi-group Agency↔AgencyGroup margin precedence is under Open Decisions (IB 6.4.a) — the AgencyGroup-scoped margin fix itself can be scoped/built without that ruling; final sign-off waits on it.
10. The Inquiries List is a confirmed three-level tree (Inquiry → Itinerary/Option → Sub-quote); Sub-quote is described in this epic and not yet reflected in the backend's `Inquiry(1)→Itinerary(many)` data model — see IB 1.3 and Open Decisions.
11. The Status Dashboard (priority queue + trade-partner ranking) is explicitly deferred per business direction ("ignore for now, still under work") and is out of scope for this epic's delivery.
12. `CrmTicketReference` on `Inquiry` is manually entered only for this epic; HubSpot-automated population is out of scope per clint's direction and is expected to land in a later, dedicated CRM-integration epic (IB 1.1.d).
13. Per clint's direction, the User Stories section focuses story-level detail on Create Itinerary, View/Search Itinerary List, Add Service Line, Update Service Line, and Split Itinerary — a scoping choice on narrative depth, not a statement that other flows (traveler assignment, lifecycle, amendments, holds/vouchers, documents, brochure copy, history/audit) are out of scope; their Functional Requirements (IB 3.N, 5.N, 8.N–14.N) remain fully documented. Open items from trimmed stories live only under Open Decisions.

---

## Integration Points

| System | Direction | Purpose |
|--------|-----------|---------|
| **Catalog module** (`SOL.Catalog.Api`) | Catalog → Itinerary (via `SOL.Common.Api` interfaces only) | Rate rules, margin rules, commission rules, promotions, pax bands, contracted rates, currency/FX lookups — never a direct DbContext/entity reference across modules |
| **Agencies/Agents module** | Agencies → Itinerary | Agency/Agent selection at creation; Agency Group margin resolution (IB 6.4.a; multi-group precedence under Open Decisions) |
| **Suppliers module** | Suppliers → Itinerary | Supplier selection, deactivation hides suppliers from Itinerary Builder search/selection (per [02-Manage-Suppliers-Epic](02-Manage-Suppliers-Epic.md)) |
| **AWS Cognito** | Cognito → SOL | Role provisioning (`Safari.Sales` requires per-tenant provisioning); Safari Planner/assigned-staff identity |
| **Xero** | SOL → Xero (manual, future automation) | Financial processing downstream of Itinerary Invoices, consistent with the Suppliers epic's current manual-sync pattern |
| **AgentZone** | N/A this phase | Agents do not access Itinerary Builder directly this phase |

---

## Glossary

| Term | Definition |
|------|-----------|
| **Apply** | Committing a Pending Change: recompute, re-voucher, fold, settle, version, close |
| **Aside (Supplier Aside)** | Commercial record of a prior-version voucher acknowledgment that doesn't affect money/status |
| **Booking-type / Brochure-type** | Two `Itinerary.Type` values; Brochure created via Copy-as-Brochure, same lifecycle ladder |
| **CRM Ticket Reference** | Net-new, nullable, free-text field on `Inquiry`; business term "Inquiry number/ref" — manually entered CRM ticket number, distinct from `InquiryNumber` (IB 1.1.d) |
| **Commercial** | The standalone supplier-facts aggregate (requests/confirmations/holds), keyed by a stable Line Key |
| **Compounding pricing** | Purchase → Contracted Sell → Uplifted Sell, each factor multiplied in sequence, rounded once at the end |
| **FCA** | Final Confirmation/Activity document — Ops-only, requires Confirmed status + every line Ops-ready |
| **Fold** | Re-parenting a Working Copy's staged lines into committed state at Apply, preserving stable IDs |
| **Fp (Fingerprint)** | A computed hash used to detect document/commercial staleness |
| **Hypothetical line** | A future-dated line with no resolvable Catalog rate, priced via uplift approximation off a prior rate |
| **IB** | Itinerary Builder module code (this epic) |
| **Itinerary Ref** | Business term for `Inquiry.InquiryNumber` (`{Prefix}{Year:D2}{Seq:D6}`, e.g. `CPS26000123`); not a separate field (IB 1.1.c) |
| **Line / Item** | A single priced `ItineraryItem` — Accommodation, Activity, Transport, Flight, Fee, or Other |
| **Line Key** | The stable key for a Commercial record, never rotated at Fold |
| **Pending Change / Working Copy** | The staged, not-yet-committed edit container; pre-booking (auto-managed) or post-booking (Amendment ladder) |
| **PO** | Localization resource file (`.po`) used for rendered messages |
| **Recompute** | The pricing engine dispatch that runs before every persist |
| **Rule ID** | A stable backend validation-rule token (e.g. `R-LC-07`) surfaced in 409 error bodies |
| **SME** | Subject Matter Expert — stakeholder for Open Decisions that need expert input |
| **Stale (document)** | A generated document whose frozen fingerprint no longer matches current itinerary state |
| **Sub-quote** | A terminal variant created by splitting under a confirmed Itinerary (option); cannot itself be split further (IB 1.3) |
| **Uplift** | The future-year price adjustment applied only to Hypothetical (no-contracted-rate) lines |
| **Voucher** | A per-supplier confirmation document, auto-raised at Vouchered and on qualifying amendments |
| **XOR staging discriminator** | The nullable-FK pattern (`ItineraryId` xor `WorkingCopyId`) distinguishing committed from staged rows |

---

## Key Stakeholder Contacts

No named stakeholders were supplied for this epic. Recommend confirming Epic Owner and Key Stakeholders with the same contacts referenced in [01-Agencies-Management-Epic](01-Agencies-Management-Epic.md) / [02-Manage-Suppliers-Epic](02-Manage-Suppliers-Epic.md), since this epic is functionally downstream of both (Agency/Agent and Supplier data).
