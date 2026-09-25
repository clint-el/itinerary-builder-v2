import { describe, expect, it } from 'vitest'
import {
  hasRichTextContent,
  linesToBulletHtml,
  plainToParagraphHtml,
  resolveQuoteText,
} from '@/features/quote-doc/quoteTextModel'

describe('quoteTextModel', () => {
  it('migrates legacy line-based inclusions into bullet HTML', () => {
    const resolved = resolveQuoteText({
      generalInclusions: ['Full board', 'Park fees'],
      generalExclusions: ['Flights'],
      notes: 'VIP arrival',
      standingCommercial: 'Rates may change.',
    })

    expect(resolved.generalInclusionsHtml).toContain('<ul>')
    expect(resolved.generalInclusionsHtml).toContain('Full board')
    expect(resolved.notesHtml).toContain('<p>VIP arrival</p>')
    expect(resolved.standingCommercialHtml).toContain('Rates may change.')
  })

  it('keeps modern TipTap HTML as-is', () => {
    const html = '<p><strong>NET rates</strong> only.</p>'
    const resolved = resolveQuoteText({
      generalInclusionsHtml: linesToBulletHtml(['One']),
      generalExclusionsHtml: linesToBulletHtml(['Two']),
      notesHtml: html,
      standingCommercialHtml: plainToParagraphHtml('Footer copy'),
    })

    expect(resolved.notesHtml).toBe(html)
    expect(resolved.generalCancellationPolicyHtml).toContain('Cancellations must be submitted')
  })

  it('seeds default general payment terms when unset', () => {
    const resolved = resolveQuoteText({
      generalInclusionsHtml: linesToBulletHtml(['One']),
      generalExclusionsHtml: linesToBulletHtml(['Two']),
      notesHtml: '',
      standingCommercialHtml: plainToParagraphHtml('Footer'),
    })
    expect(resolved.generalPaymentTermsHtml).toContain('US dollars')
  })

  it('seeds default general cancellation policy when unset', () => {
    const resolved = resolveQuoteText({
      generalInclusionsHtml: linesToBulletHtml(['One']),
      generalExclusionsHtml: linesToBulletHtml(['Two']),
      notesHtml: '',
      standingCommercialHtml: plainToParagraphHtml('Footer'),
    })
    expect(resolved.generalCancellationPolicyHtml).toContain('travel insurance')
  })

  it('preserves general cancellation policy HTML', () => {
    const resolved = resolveQuoteText({
      generalInclusionsHtml: linesToBulletHtml(['One']),
      generalExclusionsHtml: linesToBulletHtml(['Two']),
      notesHtml: '',
      standingCommercialHtml: '',
      generalCancellationPolicyHtml: '<p>All bookings subject to our standard terms.</p>',
    })
    expect(resolved.generalCancellationPolicyHtml).toContain('standard terms')
  })

  it('detects empty rich text', () => {
    expect(hasRichTextContent('')).toBe(false)
    expect(hasRichTextContent('<p></p>')).toBe(false)
    expect(hasRichTextContent('<p>Hello</p>')).toBe(true)
  })
})
