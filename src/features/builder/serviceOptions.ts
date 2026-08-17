import { CATALOG } from '@/shared/lib/catalogs'
import {
  ACTIVITY_OPTIONS_BY_SERVICE,
  ACTIVITY_OPTION_DEFS,
  BASIS_OPTIONS_BY_SERVICE,
  BASIS_OPTION_DEFS,
  OTHER_OPTIONS_BY_SERVICE,
  VEHICLE_OPTIONS_BY_SERVICE,
  VEHICLE_OPTION_DEFS,
  type ActivityTypeOption,
  type BasisOption,
  type OtherTypeOption,
  type VehicleTypeOption,
} from '@/shared/lib/catalogs'
import {
  CHARTER_FLIGHT_OPTION,
  FLIGHT_SERVICE_OPTIONS,
  type FlightServiceOption,
} from './builderUtils'

/** Canonical option shape used for Included / Excluded across all service lines. */
export type ServiceOptionInclusions = {
  id: string
  label: string
  included: string
  excluded: string
}

function basisToInclusion(o: BasisOption): ServiceOptionInclusions {
  return { id: o.id, label: o.label, included: o.included, excluded: o.excluded }
}

function vehicleToInclusion(o: VehicleTypeOption): ServiceOptionInclusions {
  return { id: o.id, label: o.type, included: o.included, excluded: o.excluded }
}

function activityToInclusion(o: ActivityTypeOption): ServiceOptionInclusions {
  return { id: o.id, label: o.name, included: o.included, excluded: o.excluded }
}

function otherToInclusion(o: OtherTypeOption): ServiceOptionInclusions {
  return { id: o.id, label: o.name, included: o.included, excluded: o.excluded }
}

function flightToInclusion(o: FlightServiceOption): ServiceOptionInclusions {
  return { id: o.id, label: o.name, included: o.included, excluded: o.excluded }
}

/**
 * Map a Catalog flight `service` string onto a `FLIGHT_SERVICE_OPTIONS` key.
 * Only exact / documented aliases — no fuzzy invention.
 */
function flightScheduleKey(catalogService: string): string | null {
  if (catalogService in FLIGHT_SERVICE_OPTIONS) return catalogService
  if (catalogService === 'Scheduled Economy (Y Class)') return 'Scheduled Economy'
  if (catalogService === 'Charter Flight' || catalogService === 'Charter flight') {
    return 'Private Charter'
  }
  if (catalogService === 'Scheduled flight') return 'Scheduled Economy'
  return null
}

/**
 * Flight Options keyed by flight `CatalogItem.id` (not by route display name).
 * Charter catalog rows get the synthetic charter option so inclusions still resolve.
 */
function buildFlightOptionsByCatalogId(): Record<string, ServiceOptionInclusions[]> {
  const out: Record<string, ServiceOptionInclusions[]> = {}
  for (const item of CATALOG.flight) {
    const key = flightScheduleKey(item.service)
    const scheduled = key ? FLIGHT_SERVICE_OPTIONS[key] ?? [] : []
    out[item.id] =
      scheduled.length > 0
        ? scheduled.map(flightToInclusion)
        : [flightToInclusion(CHARTER_FLIGHT_OPTION)]
  }
  return out
}

/**
 * Single catalog-id → options index. Built once from the per-tab maps so lookup
 * is O(1) with no "first match wins" scan. A sixth service type later is another
 * merge into this object — not a new probe branch.
 */
const OPTIONS_BY_CATALOG_ID: Record<string, ServiceOptionInclusions[]> = {
  ...Object.fromEntries(
    Object.entries(BASIS_OPTIONS_BY_SERVICE).map(([id, opts]) => [
      id,
      opts.map(basisToInclusion),
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(VEHICLE_OPTIONS_BY_SERVICE).map(([id, opts]) => [
      id,
      opts.map(vehicleToInclusion),
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(ACTIVITY_OPTIONS_BY_SERVICE).map(([id, opts]) => [
      id,
      opts.map(activityToInclusion),
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(OTHER_OPTIONS_BY_SERVICE).map(([id, opts]) => [
      id,
      opts.map(otherToInclusion),
    ]),
  ),
  ...buildFlightOptionsByCatalogId(),
}

function warnUnresolved(message: string) {
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(`[serviceOptions] ${message}`)
  }
}

/** Options for a Catalog row id (`CatalogItem.id` / draft.serviceId). */
export function optionsForService(catalogServiceId: string): ServiceOptionInclusions[] {
  if (!catalogServiceId) return []
  return OPTIONS_BY_CATALOG_ID[catalogServiceId] ?? []
}

/**
 * Resolve Included / Excluded for an Option under a Catalog service row.
 * Requires a real `catalogServiceId` — no silent global/orphan fallback.
 * `optionId` may be the stable option id or its display label within that service.
 */
export function resolveServiceOption(
  catalogServiceId: string,
  optionId: string,
): ServiceOptionInclusions | null {
  if (!catalogServiceId) return null
  if (!optionId) return null

  const opts = OPTIONS_BY_CATALOG_ID[catalogServiceId]
  if (!opts) {
    warnUnresolved(`unknown catalog serviceId "${catalogServiceId}" — option lookup skipped`)
    return null
  }

  const found =
    opts.find((o) => o.id === optionId) || opts.find((o) => o.label === optionId) || null
  if (!found) {
    warnUnresolved(
      `option "${optionId}" is not on catalog service "${catalogServiceId}"`,
    )
  }
  return found
}

/**
 * Basis options for an accommodation catalog row.
 * When no service is picked yet, returns the shared def list for the select UI only —
 * inclusions still require resolveServiceOption(serviceId, …) with a real id.
 */
export function basisOptionsForService(catalogServiceId: string): BasisOption[] {
  if (!catalogServiceId) return BASIS_OPTION_DEFS
  return BASIS_OPTIONS_BY_SERVICE[catalogServiceId] ?? []
}

export function vehicleOptionsForService(catalogServiceId: string): VehicleTypeOption[] {
  if (!catalogServiceId) return []
  return VEHICLE_OPTIONS_BY_SERVICE[catalogServiceId] ?? []
}

export function activityOptionsForService(catalogServiceId: string): ActivityTypeOption[] {
  if (!catalogServiceId) return []
  return ACTIVITY_OPTIONS_BY_SERVICE[catalogServiceId] ?? []
}

export function otherOptionsForService(catalogServiceId: string): OtherTypeOption[] {
  if (!catalogServiceId) return []
  return OTHER_OPTIONS_BY_SERVICE[catalogServiceId] ?? []
}

/** Flat defs still used by AddServiceOverlay defaults — not a per-service lookup. */
export { ACTIVITY_OPTION_DEFS, VEHICLE_OPTION_DEFS }
