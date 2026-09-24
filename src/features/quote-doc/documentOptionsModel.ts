import type {
  InvoiceLifecycleStage,
  InvoiceRenderingDepth,
  Itinerary,
  QuotePresentation,
} from '@/shared/lib/types'

export type DocumentLayoutMode = 'itemised' | 'packaged'

const B2B_AGENCY_MARKERS = ['black tomato', 'zoo groups', 'cps', 'travel counsellors']

export function layoutModeFromPresentation(presentation: QuotePresentation): DocumentLayoutMode {
  return presentation === 'B2B_ITEMISED' ? 'itemised' : 'packaged'
}

/** BR-I56 — derived from agency profile, not a document-options toggle. */
export function isTravelCounsellorsAgency(itinerary: Pick<Itinerary, 'agency'>): boolean {
  return /travel counsellors/i.test(itinerary.agency ?? '')
}

/** TC always uses rolled-up B2B itemised — packaged layout is not offered (BR-I56). */
export function effectiveLayoutMode(
  itinerary: Pick<Itinerary, 'agency'>,
  requested: DocumentLayoutMode,
): DocumentLayoutMode {
  return isTravelCounsellorsAgency(itinerary) ? 'itemised' : requested
}

/** Direct client bookings have no agency; packaged output uses B2C disclosure rules. */
export function isB2cChannel(itinerary: Pick<Itinerary, 'agency'>): boolean {
  const agency = itinerary.agency?.trim() ?? ''
  if (!agency) return true
  return !B2B_AGENCY_MARKERS.some((marker) => agency.toLowerCase().includes(marker))
}

export function presentationFromLayoutMode(
  layoutMode: DocumentLayoutMode,
  itinerary: Pick<Itinerary, 'agency'>,
): QuotePresentation {
  if (layoutMode === 'itemised') {
    return isB2cChannel(itinerary) ? 'B2C_PACKAGED' : 'B2B_ITEMISED'
  }
  return isB2cChannel(itinerary) ? 'B2C_PACKAGED' : 'B2B_PACKAGED'
}

/** First invoice before any payment → deposit; once paid down, balance invoice → full. */
export function deriveInvoiceLifecycleStage(
  itinerary: Pick<Itinerary, 'paymentStatus' | 'balanceUsd' | 'totalUsd'>,
): InvoiceLifecycleStage {
  const total = itinerary.totalUsd ?? 0
  const balance = itinerary.balanceUsd ?? total
  const paid = Math.max(0, total - balance)

  if (balance <= 0) return 'full'
  if (paid > 0) return 'full'
  return 'deposit'
}

export function deriveRenderingDepth(travelCounsellors: boolean): InvoiceRenderingDepth {
  return travelCounsellors ? 'rolled_up' : 'full'
}

export type ResolvedInvoiceDocumentOptions = {
  layoutMode: DocumentLayoutMode
  presentation: QuotePresentation
  lifecycleStage: InvoiceLifecycleStage
  renderingDepth: InvoiceRenderingDepth
  travelCounsellors: boolean
  showTerms: boolean
}

export function resolveInvoiceDocumentOptions(
  itinerary: Pick<Itinerary, 'agency' | 'paymentStatus' | 'balanceUsd' | 'totalUsd'>,
  input: { layoutMode: DocumentLayoutMode },
): ResolvedInvoiceDocumentOptions {
  const travelCounsellors = isTravelCounsellorsAgency(itinerary)
  const layoutMode = effectiveLayoutMode(itinerary, input.layoutMode)
  return {
    layoutMode,
    presentation: travelCounsellors ? 'B2B_ITEMISED' : presentationFromLayoutMode(layoutMode, itinerary),
    lifecycleStage: deriveInvoiceLifecycleStage(itinerary),
    renderingDepth: deriveRenderingDepth(travelCounsellors),
    travelCounsellors,
    showTerms: true,
  }
}

export type ResolvedQuoteDocumentOptions = {
  layoutMode: DocumentLayoutMode
  presentation: QuotePresentation
  showTerms: boolean
}

export function resolveQuoteDocumentOptions(
  itinerary: Pick<Itinerary, 'agency'>,
  input: { layoutMode: DocumentLayoutMode },
): ResolvedQuoteDocumentOptions {
  const travelCounsellors = isTravelCounsellorsAgency(itinerary)
  const layoutMode = effectiveLayoutMode(itinerary, input.layoutMode)
  return {
    layoutMode,
    presentation: travelCounsellors ? 'B2B_ITEMISED' : presentationFromLayoutMode(layoutMode, itinerary),
    showTerms: true,
  }
}

export function documentLayoutLabel(mode: DocumentLayoutMode): string {
  return mode === 'itemised' ? 'Itemised' : 'Packaged'
}

function lifecycleStageLabel(stage: InvoiceLifecycleStage): string {
  return stage === 'full' ? 'Full' : 'Deposit'
}

export function invoiceDocumentOptionsSummary(options: ResolvedInvoiceDocumentOptions): string {
  if (options.travelCounsellors) {
    return `Travel Counsellors · Rolled up · ${lifecycleStageLabel(options.lifecycleStage)}`
  }
  return [documentLayoutLabel(options.layoutMode), lifecycleStageLabel(options.lifecycleStage)].join(' · ')
}

export function invoiceCoverKindLabel(travelCounsellors: boolean): string {
  return travelCounsellors ? 'Travel Counsellors Invoice' : 'Safari Invoice'
}

export function quotationCoverKindLabel(travelCounsellors: boolean, packaged: boolean): string {
  if (travelCounsellors) return 'Travel Counsellors Quotation'
  if (packaged) return 'Packaged quotation'
  return 'Quotation'
}
