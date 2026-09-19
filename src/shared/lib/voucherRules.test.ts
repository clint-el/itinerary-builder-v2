import { describe, expect, it } from 'vitest'
import {
  applyVoucherLineSubmit,
  evaluateVoucherToken,
  payableEntityIdOf,
  raiseVouchers,
} from './lifecycleRules'
import { payableEntityFromSupplierName } from './payableEntities'
import {
  buildVouchers,
  isPayableVoucherLine,
  linesFromServices,
  voucherIssueSignature,
} from '@/features/summary/summaryModel'
import type { AddedService, Itinerary, VoucherMeta } from './types'

const baseService = (overrides: Partial<AddedService> = {}): AddedService => ({
  id: 'svc-1',
  tab: 'accommodation',
  title: 'Stay',
  subtitle: '',
  meta: '',
  details: [],
  price: 1000,
  priceLabel: '$1,000',
  net: 800,
  rack: 1000,
  netLabel: '$800',
  rackLabel: '$1,000',
  margin: 200,
  marginPct: 20,
  marginColor: '#15803D',
  fg: '#171717',
  bg: '#fff',
  initial: 'S',
  expanded: false,
  draft: {
    supplier: 'Hemingways Nairobi',
    payableEntityId: 'pe-hemingways-ke',
    startDate: '2026-06-01',
    endDate: '2026-06-03',
  },
  lineStatus: 'Confirmed',
  supplierStatus: 'Waiting',
  ...overrides,
})

describe('PR-F02 legal entity grouping', () => {
  it('merges two Hemingways properties into one voucher', () => {
    const services = [
      baseService({ id: 'a', draft: { supplier: 'Hemingways Nairobi', payableEntityId: 'pe-hemingways-ke', startDate: '2026-06-01', endDate: '2026-06-02' } }),
      baseService({ id: 'b', draft: { supplier: 'Hemingways Watamu', payableEntityId: 'pe-hemingways-ke', startDate: '2026-06-03', endDate: '2026-06-04' } }),
    ]
    const lines = linesFromServices(services, [])
    const cards = buildVouchers(lines, 'cost', 'CPS100', services, [], [], '', {}, {}, {})
    expect(cards).toHaveLength(1)
    expect(cards[0].entityId).toBe('pe-hemingways-ke')
    expect(cards[0].propertyNames.length).toBe(2)
  })

  it('splits Elewana Kenya vs Tanzania into two vouchers', () => {
    const services = [
      baseService({ id: 'a', draft: { supplier: 'Elewana Loisaba', payableEntityId: 'pe-elewana-ke', startDate: '2026-06-01', endDate: '2026-06-02' } }),
      baseService({ id: 'b', draft: { supplier: 'Elewana Serengeti', payableEntityId: 'pe-elewana-tz', startDate: '2026-06-05', endDate: '2026-06-06' } }),
    ]
    const lines = linesFromServices(services, [])
    const cards = buildVouchers(lines, 'cost', 'CPS100', services, [], [], '', {}, {}, {})
    expect(cards).toHaveLength(2)
  })
})

describe('PR-F04 zero-value exclusion', () => {
  it('omits $0 lines from voucher grouping', () => {
    const services = [
      baseService({ net: 0, rack: 0, price: 0 }),
      baseService({ id: 'b', draft: { supplier: 'Mara Serena', payableEntityId: 'pe-serena', startDate: '2026-06-05', endDate: '2026-06-06' }, net: 500, rack: 650, price: 650 }),
    ]
    const lines = linesFromServices(services, [])
    expect(lines.filter(isPayableVoucherLine)).toHaveLength(1)
    const cards = buildVouchers(lines, 'cost', 'CPS100', services, [], [], '', {}, {}, {})
    expect(cards).toHaveLength(1)
    expect(cards[0].entityId).toBe('pe-serena')
  })
})

describe('PR-F23 re-issue token state', () => {
  it('new token is ok after re-issue clears submittedAt', () => {
    const meta: VoucherMeta = {
      issued: true,
      issuedTo: ['a@b.com'],
      tokens: [{ token: 'newtok', recipientEmail: 'a@b.com', createdAt: '2026-01-01', expiresAt: '2027-01-01' }],
      resendCount: 0,
      version: 2,
      submittedAt: undefined,
    }
    const state = evaluateVoucherToken(meta, 'newtok', '2026-06-01T00:00:00.000Z')
    expect(state.state).toBe('ok')
  })
})

describe('PR-F32 extra/parent rules', () => {
  it('blocks extra held when parent not held', () => {
    const services = [baseService()]
    const lines: Parameters<typeof applyVoucherLineSubmit>[4] = [
      { lineId: 'svc-1#0', serviceId: 'svc-1', isExtra: false },
      { lineId: 'svc-1#1', serviceId: 'svc-1', isExtra: true, parentLineId: 'svc-1#0' },
    ]
    const ticks = { 'svc-1#0': false, 'svc-1#1': true }
    const result = applyVoucherLineSubmit(services, {}, {}, 'pe-hemingways-ke', lines, ticks, {}, '2026-01-01')
    expect(result.voucherLineAnswers['svc-1#1'].outcome).toBe('rejected')
  })
})

describe('PR-F36 superseded notify-only', () => {
  it('evaluateVoucherToken returns superseded for old token', () => {
    const meta: VoucherMeta = {
      issued: true,
      issuedTo: ['a@b.com'],
      tokens: [
        { token: 'old', recipientEmail: 'a@b.com', createdAt: '2026-01-01', expiresAt: '2027-01-01', supersededAt: '2026-01-02' },
      ],
      resendCount: 0,
      version: 2,
    }
    expect(evaluateVoucherToken(meta, 'old', '2026-06-01').state).toBe('superseded')
  })
})

describe('payableEntityOf', () => {
  it('resolves entity id from draft', () => {
    expect(payableEntityIdOf(baseService())).toBe('pe-hemingways-ke')
    expect(payableEntityFromSupplierName('AirKenya Wilson1').id).toBe('pe-airkenya')
  })
})

describe('voucherIssueSignature', () => {
  it('changes when line commercial facts change', () => {
    const services = [baseService()]
    const lines = linesFromServices(services, [])
    const sig1 = voucherIssueSignature(lines, [], [])
    const lines2 = linesFromServices([baseService({ net: 900 })], [])
    const sig2 = voucherIssueSignature(lines2, [], [])
    expect(sig1).not.toBe(sig2)
  })
})

describe('raiseVouchers entity keys', () => {
  it('keys supplierVouchers by entity id', () => {
    const itinerary: Itinerary = {
      id: 'CPS1',
      reference: 'CPS1',
      itineraryRef: 'ITN-1',
      title: 'T',
      agency: 'A',
      agent: 'Ag',
      safariPlanner: 'P',
      destination: 'Kenya',
      travelDateFrom: '2026-06-01',
      travelDateTo: '2026-06-10',
      createdAt: '2026-01-01',
      status: 'INVOICED',
      paymentStatus: 'UNPAID',
      totalUsd: 1000,
      balanceUsd: 1000,
      updatedAt: '2026-01-01',
    }
    const { supplierVouchers } = raiseVouchers([baseService()], itinerary)
    expect(supplierVouchers['pe-hemingways-ke']).toBe('Raised')
  })
})
