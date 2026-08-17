import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ExtrasTab } from './ExtrasTab'

const catalog = [
  {
    id: 'conservancy',
    title: 'Park/Conservancy Fees',
    price: 100,
    mandatory: true,
    tabs: ['accommodation' as const],
  },
  {
    id: 'lunch',
    title: 'Lunch',
    price: 45,
    tabs: ['accommodation' as const],
  },
  {
    id: 'dinner',
    title: 'Dinner',
    price: 60,
    tabs: ['accommodation' as const],
  },
]

describe('ExtrasTab merge logic', () => {
  it('always shows mandatory extras even when they are not in extraIds', () => {
    render(
      <ExtrasTab
        selected={[]}
        catalog={catalog}
        extraIds={[]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onCustom={vi.fn()}
      />,
    )
    expect(screen.getAllByText('Mandatory').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Park/Conservancy Fees')).toBeTruthy()
    expect(screen.queryByText('No extras selected.')).toBeNull()
  })

  it('moves a selected optional extra out of Available into Selected', () => {
    render(
      <ExtrasTab
        selected={[{ id: 'lunch', title: 'Lunch', price: 45 }]}
        catalog={catalog}
        extraIds={['lunch']}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onCustom={vi.fn()}
      />,
    )
    expect(screen.getByText('Selected')).toBeTruthy()
    expect(screen.getAllByText('Lunch').length).toBeGreaterThanOrEqual(1)
    const availableHeading = screen.getByText('Available extras')
    const availableSection = availableHeading.parentElement
    expect(availableSection?.textContent).toContain('Dinner')
    expect(availableSection?.textContent).not.toContain('Lunch')
  })

  it('renders Activity availableHint and emptyAvailableMessage when passed', () => {
    render(
      <ExtrasTab
        selected={[{ id: 'conservancy', title: 'Park/Conservancy Fees', price: 100, mandatory: true }]}
        catalog={[catalog[0]]}
        extraIds={['conservancy']}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onCustom={vi.fn()}
        availableHint="Linked to selected activities"
        emptyAvailableMessage="No more extras for these activities."
      />,
    )
    expect(screen.getByText('Linked to selected activities')).toBeTruthy()
    expect(screen.getByText('No more extras for these activities.')).toBeTruthy()
  })
})
