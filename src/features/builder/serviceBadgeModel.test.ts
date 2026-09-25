import { describe, expect, it } from 'vitest'
import { holdPhaseForHolds, serviceListBadge } from '@/features/builder/serviceBadgeModel'
import type { AddedService, Hold } from '@/shared/lib/types'

function svc(partial: Partial<AddedService> & Pick<AddedService, 'id' | 'tab'>): AddedService {
  return {
    title: partial.id,
    ...partial,
  } as AddedService
}

describe('holdPhaseForHolds', () => {
  it('ignores released holds', () => {
    const holds: Hold[] = [
      { id: '1', status: 'Released', price: 0, date: '', ref: '', comment: '' },
    ]
    expect(holdPhaseForHolds(holds)).toBe('none')
  })

  it('prefers expired over held', () => {
    const holds: Hold[] = [
      { id: '1', status: 'Held', price: 0, date: '', ref: '', comment: '' },
      { id: '2', status: 'Expired', price: 0, date: '', ref: '', comment: '' },
    ]
    expect(holdPhaseForHolds(holds)).toBe('expired')
  })
})

describe('serviceListBadge', () => {
  it('shows no hold yet for accommodation without holds', () => {
    expect(serviceListBadge(svc({ id: 'a1', tab: 'accommodation' }))?.label).toBe('No hold yet')
  })

  it('shows on hold when a held record exists', () => {
    const badge = serviceListBadge(
      svc({
        id: 'a1',
        tab: 'accommodation',
        draft: {
          holds: [{ id: 'h1', status: 'Held', price: 100, date: '1 Jan', ref: 'R1', comment: '' }],
        },
      }),
    )
    expect(badge?.label).toBe('On hold')
  })

  it('shows supplier badge when waiting on confirmation', () => {
    const badge = serviceListBadge(
      svc({
        id: 't1',
        tab: 'transportation',
        lineStatus: 'Confirmed',
        supplierStatus: 'Waiting',
      }),
    )
    expect(badge?.label).toBe('Awaiting supplier reply')
  })

  it('hides badge for non-accommodation without supplier engagement', () => {
    expect(serviceListBadge(svc({ id: 'f1', tab: 'flight' }))).toBeNull()
  })
})
