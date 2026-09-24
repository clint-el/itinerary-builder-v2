import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildInvoiceSnapshot,
  buildPaymentPosition,
  clientPaymentsOnSell,
  invoiceNumberFor,
  isInvoiceStale,
} from '@/features/invoice-doc/invoiceSnapshotModel'
import { itineraryCommercialFp } from '@/shared/lib/lifecycleRules'
import { linesForRateBasis } from '@/features/quote-doc/quoteRateBasisModel'
import { plainToParagraphHtml } from '@/features/quote-doc/quoteTextModel'
import { buildDepositSummary, buildSummaryPricing, linesFromServices } from '@/features/summary/summaryModel'
import {
  ensureSeeded,
  getInvoice,
  getItinerary,
  saveInvoice,
} from '@/shared/lib/storage'
import type { AddedService, Itinerary } from '@/shared/lib/types'

function baseItinerary(overrides: Partial<Itinerary> = {}): Itinerary {
  return {
    id: 'TEST-INV',
    reference: 'CPS7777',
    itineraryRef: 'ITN-7777',
    title: 'Invoice Safari',
    agency: 'Black Tomato',
    agent: 'Agent',
    safariPlanner: 'Planner',
    destination: 'Kenya',
    travelDateFrom: '2026-11-01',
    travelDateTo: '2026-11-08',
    createdAt: '2026-01-01',
    status: 'APPROVED',
    paymentStatus: 'PARTIALLY_PAID',
    totalUsd: 10000,
    balanceUsd: 5000,
    updatedAt: '2026-01-01',
    adults: 2,
    children: 0,
    infants: 0,
    ...overrides,
  }
}

function service(id: string, rack: number, net: number): AddedService {
  return {
    id,
    tab: 'accommodation',
    title: 'Lodge',
    subtitle: 'Suite',
    meta: '1 Nov 2026',
    details: [],
    price: rack,
    priceLabel: `$${rack}`,
    net,
    rack,
    netLabel: `$${net}`,
    rackLabel: `$${rack}`,
    margin: rack - net,
    marginPct: 20,
    marginColor: '#0B7A48',
    fg: '#059669',
    bg: '#D1FAE5',
    initial: 'A',
    expanded: true,
    draft: {},
  }
}

describe('invoiceSnapshotModel', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('freezes general cancellation policy on quoteText', () => {
    const itinerary = baseItinerary()
    const services = [service('s1', 10000, 7700)]
    const snap = buildInvoiceSnapshot({
      itinerary,
      services,
      quoteGroups: [],
      guestDetails: [],
      generatedBy: 'Planner',
      quoteText: {
        generalInclusionsHtml: '',
        generalExclusionsHtml: '',
        notesHtml: '',
        standingCommercialHtml: '',
        generalCancellationPolicyHtml: plainToParagraphHtml('Standard agency cancellation applies.'),
      },
    })
    expect(snap.quoteText?.generalCancellationPolicyHtml).toContain('Standard agency cancellation')
  })

  it('builds deposit invoice with full total and payment position', () => {
    const itinerary = baseItinerary()
    const services = [service('s1', 10000, 7700)]
    const snap = buildInvoiceSnapshot({
      itinerary,
      services,
      quoteGroups: [],
      guestDetails: [],
      stage: 'deposit',
      generatedBy: 'Planner',
    })
    expect(snap.invoiceNumber).toBe('CPS7777-INV')
    expect(snap.sellTotal).toBe(7700)
    expect(snap.lifecycleStage).toBe('deposit')
    expect(snap.paymentPosition.total).toBe(7700)
    expect(snap.paymentPosition.paid).toBe(3850)
    expect(snap.paymentPosition.balance).toBe(3850)
    expect(snap.paymentPosition.paid + snap.paymentPosition.balance).toBe(7700)
  })

  it('updates in place with same invoice number and revision log', () => {
    const itinerary = baseItinerary()
    const services = [service('s1', 10000, 7700)]
    const first = buildInvoiceSnapshot({
      itinerary,
      services,
      quoteGroups: [],
      guestDetails: [],
      stage: 'deposit',
      generatedBy: 'Planner',
    })
    saveInvoice(first)

    const changed = [service('s1', 12000, 9240)]
    const second = buildInvoiceSnapshot({
      itinerary,
      services: changed,
      quoteGroups: [],
      guestDetails: [],
      stage: 'deposit',
      generatedBy: 'Planner',
      existing: first,
    })
    saveInvoice(second)

    expect(second.invoiceNumber).toBe(first.invoiceNumber)
    expect(second.id).toBe(first.id)
    expect(second.sellTotal).toBe(9240)
    expect(second.revisions).toHaveLength(1)
    expect(second.revisions[0].summary).toContain('9,240')
  })

  it('marks invoice stale when fingerprint changes', () => {
    const itinerary = baseItinerary()
    const services = [service('s1', 10000, 7700)]
    const snap = buildInvoiceSnapshot({
      itinerary,
      services,
      quoteGroups: [],
      guestDetails: [],
      stage: 'full',
      generatedBy: 'Planner',
    })
    expect(isInvoiceStale(snap, snap.fingerprint)).toBe(false)
    expect(isInvoiceStale(snap, itineraryCommercialFp([service('s1', 11000, 8470)]))).toBe(true)
  })

  it('seeds CPS5681 with an invoice on first load', () => {
    ensureSeeded()
    const invoice = getInvoice('CPS5681')
    expect(invoice).toBeDefined()
    expect(invoice?.invoiceNumber).toBe('CPS5681-INV')
    expect(getItinerary('CPS5681')?.invoiceFingerprint).toBe(invoice?.fingerprint)
    expect(getItinerary('CPS5681')?.firstInvoiceDate).toBe('2026-07-05')
  })

  it('full stage puts outstanding balance on balance payment due', () => {
    const itinerary = baseItinerary({ balanceUsd: 3000 })
    const services = [service('s1', 10000, 7700)]
    const lines = linesForRateBasis(linesFromServices(services, []), 'nett')
    const pricing = buildSummaryPricing(lines, 2)
    const deposits = buildDepositSummary(lines, pricing.sellNumber)
    const pos = buildPaymentPosition(itinerary, pricing.sellNumber, deposits, 'full', '2026-09-01')
    expect(pricing.sellNumber).toBe(7700)
    expect(pos.amountDueImmediately).toBe(0)
    expect(pos.futureAmountDue).toBe(2310)
    expect(pos.paid + (pos.futureAmountDue ?? 0)).toBe(7700)
    expect(pos.futureDueDate).toBeTruthy()
  })

  it('clientPaymentsOnSell scales ledger when booking total differs from sell', () => {
    const itinerary = baseItinerary({ totalUsd: 10000, balanceUsd: 5000 })
    const { paid, balance } = clientPaymentsOnSell(itinerary, 7700)
    expect(paid).toBe(3850)
    expect(balance).toBe(3850)
    expect(paid + balance).toBe(7700)
  })

  it('invoiceNumberFor uses reference suffix', () => {
    expect(invoiceNumberFor(baseItinerary())).toBe('CPS7777-INV')
  })

  it('derives Total Adults/Children price split from itinerary pax composition (BR-I58)', () => {
    const itinerary = baseItinerary({ adults: 2, children: 1 })
    const services = [service('s1', 10000, 7700)]
    const snap = buildInvoiceSnapshot({
      itinerary,
      services,
      quoteGroups: [],
      guestDetails: [],
      stage: 'deposit',
      generatedBy: 'Planner',
    })
    expect(snap.paxPriceSplit.totalAdults).toBe(2)
    expect(snap.paxPriceSplit.totalChildren).toBe(1)
    expect(snap.paxPriceSplit.totalAdultPrice + snap.paxPriceSplit.totalChildPrice).toBeCloseTo(snap.sellTotal, 2)
  })

  it('B2C_PACKAGED invoices never carry per-line prices (BR-I07)', () => {
    const itinerary = baseItinerary()
    const services = [service('s1', 10000, 7700)]
    const snap = buildInvoiceSnapshot({
      itinerary,
      services,
      quoteGroups: [],
      guestDetails: [],
      stage: 'deposit',
      generatedBy: 'Planner',
      presentation: 'B2C_PACKAGED',
    })
    expect(snap.presentation).toBe('B2C_PACKAGED')
    expect(snap.includesRows?.every((row) => !('amount' in row))).toBe(true)
  })

  it('B2B_ITEMISED defaults to full rendering depth with no rolled-up rows', () => {
    const itinerary = baseItinerary()
    const services = [service('s1', 10000, 7700)]
    const snap = buildInvoiceSnapshot({
      itinerary,
      services,
      quoteGroups: [],
      guestDetails: [],
      stage: 'deposit',
      generatedBy: 'Planner',
    })
    expect(snap.renderingDepth).toBe('full')
    expect(snap.rolledUpRows).toBeUndefined()
  })

  it('rolled-up rendering depth produces Gross/Commission/Net rows (BR-I57)', () => {
    const itinerary = baseItinerary()
    const services = [service('s1', 10000, 7700)]
    const snap = buildInvoiceSnapshot({
      itinerary,
      services,
      quoteGroups: [],
      guestDetails: [],
      stage: 'deposit',
      generatedBy: 'Planner',
      renderingDepth: 'rolled_up',
    })
    expect(snap.renderingDepth).toBe('rolled_up')
    expect(snap.rolledUpRows?.length).toBeGreaterThan(0)
  })

  it('Travel Counsellors invoices force rolled-up rendering regardless of the depth input (BR-I56)', () => {
    const itinerary = baseItinerary()
    const services = [service('s1', 10000, 7700)]
    const snap = buildInvoiceSnapshot({
      itinerary,
      services,
      quoteGroups: [],
      guestDetails: [],
      stage: 'deposit',
      generatedBy: 'Planner',
      renderingDepth: 'full',
      travelCounsellors: true,
    })
    expect(snap.travelCounsellors).toBe(true)
    expect(snap.renderingDepth).toBe('rolled_up')
    expect(snap.rolledUpRows?.length).toBeGreaterThan(0)
  })
})
