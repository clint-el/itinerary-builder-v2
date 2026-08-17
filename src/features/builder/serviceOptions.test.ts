import { describe, expect, it, vi } from 'vitest'
import { optionsForService, resolveServiceOption } from './serviceOptions'

describe('service option inclusions', () => {
  it('resolves options by CatalogItem.id (draft.serviceId), not display-name service', () => {
    expect(resolveServiceOption('acc-hemingways-nairobi', 'bb')?.included).toMatch(/Breakfast/i)
    expect(resolveServiceOption('trn-hemingways-transfers', 'land-cruiser')?.excluded).toBeTruthy()
    expect(resolveServiceOption('flt-coastal-scheduled', 'econ-morning')?.label).toBe(
      'Morning Flight',
    )
    expect(resolveServiceOption('act-mara-walking', 'game-drive')?.included).toBeTruthy()
    expect(resolveServiceOption('oth-amref', 'conservancy-fee')?.excluded).toBeTruthy()
  })

  it('resolves display labels only within that catalog service’s options', () => {
    expect(resolveServiceOption('trn-nairobi-airport', 'Land Cruiser')?.id).toBe('land-cruiser')
    expect(resolveServiceOption('act-mara-walking', 'Game drive')?.id).toBe('game-drive')
  })

  it('lists options for a known catalog id and nothing for an unknown one', () => {
    expect(optionsForService('acc-hemingways-nairobi').map((o) => o.id)).toEqual(
      expect.arrayContaining(['bb', 'fb', 'hb', 'ro']),
    )
    // City hotel does not expose safari package bases.
    expect(optionsForService('acc-hemingways-nairobi').map((o) => o.id)).not.toContain('gp')
    expect(optionsForService('acc-elewana-loisaba').map((o) => o.id)).toEqual(
      expect.arrayContaining(['gp', 'fi', 'gd']),
    )
    expect(optionsForService('flt-coastal-scheduled').map((o) => o.id)).toEqual(
      expect.arrayContaining(['econ-morning', 'econ-afternoon']),
    )
    expect(optionsForService('no-such-service')).toEqual([])
  })

  it('returns null (and does not fall back globally) for unknown option ids', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveServiceOption('acc-hemingways-nairobi', 'nope')).toBeNull()
    expect(resolveServiceOption('trn-nairobi-airport', 'hovercraft')).toBeNull()
    expect(resolveServiceOption('', 'bb')).toBeNull()
    expect(resolveServiceOption('unknown-id', 'bb')).toBeNull()
    warn.mockRestore()
  })

  it('scopes activity options to the catalog product', () => {
    expect(optionsForService('act-governors-balloon').map((o) => o.id)).toEqual(['hot-air-balloon'])
    expect(optionsForService('act-cheli-peacock-kenya').map((o) => o.id)).toContain(
      'giraffe-centre-entrance',
    )
    expect(optionsForService('act-cheli-peacock-kenya').map((o) => o.id)).not.toContain(
      'hot-air-balloon',
    )
  })
})
