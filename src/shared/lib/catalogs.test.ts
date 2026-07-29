import { describe, expect, it } from 'vitest'
import {
  roomTypeCapacity,
  roomTypeId,
  roomTypeLabel,
  roomTypeOptions,
} from './catalogs'

describe('room type catalog', () => {
  it('stores stable ids and resolves their display metadata', () => {
    expect(roomTypeLabel('hemingways-double-suite')).toBe('Double Suite')
    expect(roomTypeCapacity('hemingways-double-suite')).toBe(2)
  })

  it('normalizes legacy display labels to stable ids', () => {
    expect(roomTypeId('BB Double Deluxe Suite')).toBe('hemingways-double-suite')
    expect(roomTypeId('GPKG Family Tent')).toBe('elewana-family-tent')
  })

  it('keeps the current non-Hemingways or unknown product selectable', () => {
    expect(roomTypeOptions('elewana-stable-cottage')[0]).toMatchObject({
      id: 'elewana-stable-cottage',
      name: 'GPKG Stable Cottage',
    })
    expect(roomTypeOptions('Supplier Legacy Room')[0]).toMatchObject({
      id: 'Supplier Legacy Room',
      name: 'Supplier Legacy Room',
    })
  })
})
