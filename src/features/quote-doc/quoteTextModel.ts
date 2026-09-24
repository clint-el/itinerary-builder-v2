import {
  GENERAL_LEDGER_EXCLUSIONS,
  GENERAL_LEDGER_INCLUSIONS,
} from '@/features/quote-doc/quoteLedgerModel'
import type { QuoteTextContent } from '@/shared/lib/types'

/** Persisted shape before TipTap — still accepted on read for localStorage migration. */
export type LegacyQuoteTextContent = {
  generalInclusions?: string[]
  generalExclusions?: string[]
  notes?: string
  standingCommercial?: string
}

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function linesToBulletHtml(lines: string[]) {
  if (!lines.length) return ''
  return `<ul>${lines.map((line) => `<li><p>${escapeHtml(line)}</p></li>`).join('')}</ul>`
}

export function plainToParagraphHtml(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return ''
  return trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('')
}

export function hasRichTextContent(html: string | undefined) {
  if (!html) return false
  const stripped = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim()
  return stripped.length > 0
}

export const DEFAULT_GENERAL_CANCELLATION_POLICY = [
  'Cancellations must be submitted in writing to your safari planner.',
  'Services remain provisional until deposit is received and suppliers confirm.',
  'After confirmation, refunds follow each supplier’s policy below; non-refundable supplier costs and reasonable agency fees may apply.',
  'Comprehensive travel insurance including cancellation cover is strongly recommended.',
].join('\n')

export function defaultQuoteText(): QuoteTextContent {
  return {
    generalInclusionsHtml: linesToBulletHtml(GENERAL_LEDGER_INCLUSIONS),
    generalExclusionsHtml: linesToBulletHtml(GENERAL_LEDGER_EXCLUSIONS),
    notesHtml: '',
    standingCommercialHtml: plainToParagraphHtml(
      'Rates are subject to statutory increases, park fees, and fuel surcharges beyond our control.',
    ),
    generalCancellationPolicyHtml: plainToParagraphHtml(DEFAULT_GENERAL_CANCELLATION_POLICY),
  }
}

function isModernQuoteText(value: QuoteTextContent | LegacyQuoteTextContent): value is QuoteTextContent {
  return 'generalInclusionsHtml' in value
}

export function resolveQuoteText(
  draft?: QuoteTextContent | LegacyQuoteTextContent | null,
  frozen?: QuoteTextContent | LegacyQuoteTextContent | null,
): QuoteTextContent {
  const base = frozen ?? draft
  const defaults = defaultQuoteText()
  if (!base) return defaults

  if (isModernQuoteText(base)) {
    return {
      generalInclusionsHtml: hasRichTextContent(base.generalInclusionsHtml)
        ? base.generalInclusionsHtml
        : defaults.generalInclusionsHtml,
      generalExclusionsHtml: hasRichTextContent(base.generalExclusionsHtml)
        ? base.generalExclusionsHtml
        : defaults.generalExclusionsHtml,
      notesHtml: base.notesHtml ?? '',
      standingCommercialHtml: hasRichTextContent(base.standingCommercialHtml)
        ? base.standingCommercialHtml
        : defaults.standingCommercialHtml,
      generalCancellationPolicyHtml: hasRichTextContent(base.generalCancellationPolicyHtml)
        ? base.generalCancellationPolicyHtml!
        : defaults.generalCancellationPolicyHtml,
    }
  }

  return {
    generalInclusionsHtml: linesToBulletHtml(
      base.generalInclusions?.length ? base.generalInclusions : GENERAL_LEDGER_INCLUSIONS,
    ),
    generalExclusionsHtml: linesToBulletHtml(
      base.generalExclusions?.length ? base.generalExclusions : GENERAL_LEDGER_EXCLUSIONS,
    ),
    notesHtml: plainToParagraphHtml(base.notes ?? ''),
    standingCommercialHtml: hasRichTextContent(base.standingCommercial)
      ? plainToParagraphHtml(base.standingCommercial!)
      : defaults.standingCommercialHtml,
    generalCancellationPolicyHtml: defaults.generalCancellationPolicyHtml,
  }
}
