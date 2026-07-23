import { SEED_ITINERARIES, SEED_QUOTE_GROUPS } from './catalogs'
import { quoteGroupsTotal, rootCpsNumber } from './helpers'
import type { AddedService, GuestDetail, Itinerary, QuoteGroup } from './types'

const VERSION_KEY = 'sol-demo-version'
const ITINERARIES_KEY = 'sol-demo-itineraries'
const SERVICES_KEY = 'sol-demo-services'
const QUOTE_KEY = 'sol-demo-quote-groups'
const GUESTS_KEY = 'sol-demo-guests'
const CURRENT_VERSION = '3'

type ServicesMap = Record<string, AddedService[]>
type QuoteMap = Record<string, QuoteGroup[]>
type GuestsMap = Record<string, GuestDetail[]>

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function ensureSeeded() {
  const version = localStorage.getItem(VERSION_KEY)
  if (version !== CURRENT_VERSION) {
    const existing = readJson<Itinerary[] | null>(ITINERARIES_KEY, null)
    const userCreated =
      existing?.filter((it) => !SEED_ITINERARIES.some((s) => s.id === it.id)) ?? []
    const merged = [...SEED_ITINERARIES]
    for (const u of userCreated) {
      if (!merged.some((m) => m.id === u.id)) merged.push(u)
    }
    writeJson(ITINERARIES_KEY, merged)
    if (!localStorage.getItem(SERVICES_KEY)) writeJson(SERVICES_KEY, {})
    if (!localStorage.getItem(QUOTE_KEY)) writeJson(QUOTE_KEY, { CPS5679: structuredClone(SEED_QUOTE_GROUPS) })
    if (!localStorage.getItem(GUESTS_KEY)) writeJson(GUESTS_KEY, {})
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION)
    return
  }
  if (!readJson<Itinerary[] | null>(ITINERARIES_KEY, null)?.length) {
    writeJson(ITINERARIES_KEY, SEED_ITINERARIES)
  }
  if (localStorage.getItem(SERVICES_KEY) == null) writeJson(SERVICES_KEY, {})
  if (localStorage.getItem(QUOTE_KEY) == null) writeJson(QUOTE_KEY, { CPS5679: structuredClone(SEED_QUOTE_GROUPS) })
  if (localStorage.getItem(GUESTS_KEY) == null) writeJson(GUESTS_KEY, {})
}

export function listItineraries(): Itinerary[] {
  ensureSeeded()
  return readJson<Itinerary[]>(ITINERARIES_KEY, SEED_ITINERARIES)
}

export function getItinerary(id: string): Itinerary | undefined {
  return listItineraries().find((it) => it.id === id)
}

export function upsertItinerary(itinerary: Itinerary) {
  const list = listItineraries()
  const idx = list.findIndex((it) => it.id === itinerary.id)
  if (idx >= 0) list[idx] = itinerary
  else list.unshift(itinerary)
  writeJson(ITINERARIES_KEY, list)
}

export function deleteItinerary(id: string) {
  writeJson(
    ITINERARIES_KEY,
    listItineraries().filter((it) => it.id !== id),
  )
  const services = readJson<ServicesMap>(SERVICES_KEY, {})
  delete services[id]
  writeJson(SERVICES_KEY, services)
  const quotes = readJson<QuoteMap>(QUOTE_KEY, {})
  delete quotes[id]
  writeJson(QUOTE_KEY, quotes)
  const guests = readJson<GuestsMap>(GUESTS_KEY, {})
  delete guests[id]
  writeJson(GUESTS_KEY, guests)
}

export function getServices(itineraryId: string): AddedService[] {
  ensureSeeded()
  return readJson<ServicesMap>(SERVICES_KEY, {})[itineraryId] ?? []
}

export function setServices(itineraryId: string, services: AddedService[]) {
  ensureSeeded()
  const map = readJson<ServicesMap>(SERVICES_KEY, {})
  map[itineraryId] = services
  writeJson(SERVICES_KEY, map)
  // Only drive itinerary total from builder services when there is no quote yet.
  const quotes = readJson<QuoteMap>(QUOTE_KEY, {})[itineraryId]
  if (quotes && quotes.length > 0) return
  const current = getItinerary(itineraryId)
  if (!current) return
  const total = services.reduce((sum, s) => sum + (s.price || 0), 0)
  upsertItinerary({
    ...current,
    totalUsd: total,
    balanceUsd: balanceAfterTotalChange(current, total),
    updatedAt: new Date().toISOString(),
  })
}

export function getQuoteGroups(itineraryId: string): QuoteGroup[] {
  ensureSeeded()
  const map = readJson<QuoteMap>(QUOTE_KEY, {})
  if (map[itineraryId]) return map[itineraryId]
  if (itineraryId === 'CPS5679' || itineraryId === 'CPS5680') {
    return structuredClone(SEED_QUOTE_GROUPS)
  }
  return []
}

export function setQuoteGroups(itineraryId: string, groups: QuoteGroup[]) {
  ensureSeeded()
  const map = readJson<QuoteMap>(QUOTE_KEY, {})
  map[itineraryId] = groups
  writeJson(QUOTE_KEY, map)
  syncItineraryTotalFromQuotes(itineraryId, groups)
}

export function getGuestDetails(itineraryId: string): GuestDetail[] {
  ensureSeeded()
  return readJson<GuestsMap>(GUESTS_KEY, {})[itineraryId] ?? []
}

export function setGuestDetails(itineraryId: string, guests: GuestDetail[]) {
  ensureSeeded()
  const map = readJson<GuestsMap>(GUESTS_KEY, {})
  map[itineraryId] = guests
  writeJson(GUESTS_KEY, map)
}

export function nextInquiryId(existing: Itinerary[] = listItineraries()): string {
  const nums = existing.map((it) => rootCpsNumber(it.reference)).filter((n) => n > 0)
  const max = nums.length ? Math.max(...nums) : 5687
  return `CPS${max + 1}`
}

/** Preserve amount already paid when recalculating balance from a new total. */
export function balanceAfterTotalChange(
  current: Pick<Itinerary, 'totalUsd' | 'balanceUsd'>,
  nextTotal: number,
): number {
  const paid = Math.max(0, (current.totalUsd || 0) - (current.balanceUsd || 0))
  return Math.round((nextTotal - paid) * 100) / 100
}

export function syncItineraryTotalFromQuotes(itineraryId: string, groups: QuoteGroup[]) {
  const current = getItinerary(itineraryId)
  if (!current) return
  const total = quoteGroupsTotal(groups)
  upsertItinerary({
    ...current,
    totalUsd: total,
    balanceUsd: balanceAfterTotalChange(current, total),
    updatedAt: new Date().toISOString(),
  })
}
