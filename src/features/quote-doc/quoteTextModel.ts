import {
  GENERAL_LEDGER_EXCLUSIONS,
  GENERAL_LEDGER_INCLUSIONS,
} from '@/features/quote-doc/quoteLedgerModel'
import type { QuoteTextContent } from '@/shared/lib/types'

export function defaultQuoteText(): QuoteTextContent {
  return {
    generalInclusions: [...GENERAL_LEDGER_INCLUSIONS],
    generalExclusions: [...GENERAL_LEDGER_EXCLUSIONS],
    notes: '',
    standingCommercial:
      'Rates are subject to statutory increases, park fees, and fuel surcharges beyond our control.',
  }
}

export function resolveQuoteText(
  draft?: QuoteTextContent | null,
  frozen?: QuoteTextContent | null,
): QuoteTextContent {
  const base = frozen ?? draft ?? defaultQuoteText()
  return {
    generalInclusions: [...(base.generalInclusions?.length ? base.generalInclusions : GENERAL_LEDGER_INCLUSIONS)],
    generalExclusions: [...(base.generalExclusions?.length ? base.generalExclusions : GENERAL_LEDGER_EXCLUSIONS)],
    notes: base.notes ?? '',
    standingCommercial: base.standingCommercial ?? defaultQuoteText().standingCommercial,
  }
}

export function parseQuoteTextLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export function quoteTextLinesToText(lines: string[]): string {
  return lines.join('\n')
}
