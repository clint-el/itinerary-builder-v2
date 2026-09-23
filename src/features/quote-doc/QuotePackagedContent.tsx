import {
  buildLedgerPaymentTerms,
  fmtLedgerDateLong,
  fmtLedgerAmount,
  fmtLedgerUsd,
  bookedByContact,
  bookingAgentBlock,
  guestDetailLines,
  invoiceRecipientProfile,
  paxComposition,
  type LedgerCancellationRow,
  type LedgerOptionRow,
} from '@/features/quote-doc/quoteLedgerModel'
import { RichTextDocumentContent } from '@/features/quote-doc/RichTextDocumentContent'
import { QuoteTextSupplement } from '@/features/quote-doc/quoteTextBlocks'
import { rateBasisTag } from '@/features/quote-doc/quoteRateBasisModel'
import { isB2C } from '@/features/quote-doc/quotePackagedModel'
import {
  BookedByMetaRow,
  BookingAgentSection,
  BookingConsultantRow,
  GuestDetailsSection,
  InvoicedToProfile,
} from '@/features/quote-doc/quoteCoverMeta'
import {
  CpsRemittancePages,
  RemittanceLedgerHeader,
} from '@/features/invoice-doc/CpsRemittancePages'
import { remittanceStartPage } from '@/features/invoice-doc/cpsRemittanceModel'
import type { QuoteRenderModel } from '@/features/quote-doc/quoteSnapshotModel'
import type { Guest, GuestDetail, Itinerary } from '@/shared/lib/types'
import { cn } from '@/shared/lib/utils'

const PAGE_W = 794
const PAGE_H = 1123
const MAROON = '#580B0B'

export type QuotePackagedContentProps = {
  itinerary: Itinerary
  renderModel: QuoteRenderModel
  refLabel: string
  versionLabel: string
  coverTitle: string
  issuedOn: string
  validUntil: string
  daysCount: number
  nightsCount: number
  totalGuests: number
  adults: number
  children: number
  infants: number
  lead: string
  countries: string
  guests: Guest[]
  guestDetails: GuestDetail[]
  showTerms: boolean
  totalPages: number
  paymentTerms: ReturnType<typeof buildLedgerPaymentTerms>
  cancellationRows: LedgerCancellationRow[]
  optionRows: LedgerOptionRow[]
  totalsFooterLeft?: string
  /** When set to invoice, the third meta column shows Invoiced to (agent profile) instead of Booking. */
  documentKind?: 'quote' | 'invoice'
  travelCounsellors?: boolean
}

export function QuotePackagedContent({
  itinerary,
  renderModel,
  refLabel,
  versionLabel,
  coverTitle,
  issuedOn,
  validUntil,
  daysCount,
  nightsCount,
  totalGuests,
  adults,
  children,
  infants,
  countries,
  guests,
  guestDetails,
  showTerms,
  totalPages,
  paymentTerms,
  cancellationRows,
  optionRows,
  totalsFooterLeft,
  documentKind = 'quote',
  travelCounsellors = false,
}: QuotePackagedContentProps) {
  const inclusionsHtml = renderModel.quoteText.generalInclusionsHtml
  const exclusionsHtml = renderModel.quoteText.generalExclusionsHtml
  const guestLines = guestDetailLines(guests, guestDetails)
  const { includesRows, packagedCategoryRows, paxPriceSplit, rateBasis } = renderModel
  const categoryRows = packagedCategoryRows ?? []
  const categoryGrossTotal = categoryRows.reduce((sum, row) => sum + row.grossPrice, 0)
  const categoryNetTotal = categoryRows.reduce((sum, row) => sum + row.netAmount, 0)
  const rateTag = rateBasisTag(rateBasis)
  const bookingName = coverTitle
  const b2c = isB2C(renderModel.presentation)
  const audienceLabel = b2c ? 'B2C' : 'B2B'

  return (
    <>
      <section
        data-qd-page="1"
        className="qd-page flex shrink-0 flex-col overflow-hidden bg-white shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
        style={{ width: PAGE_W, height: PAGE_H }}
      >
        <div className="flex h-[296px] shrink-0 flex-col justify-between p-9 px-14" style={{ background: MAROON }}>
          <div className="flex items-start justify-between gap-6">
            <img
              src="/assets/CPS.png"
              alt="Cheli & Peacock Safaris"
              className="block h-auto w-44 brightness-0 invert"
            />
            <div className="text-right">
              <div className="text-[9.5px] font-semibold uppercase tracking-[1.6px] text-[#C79393]">
                {documentKind === 'invoice' ? 'Tour Package Invoice' : 'Packaged quotation'}
              </div>
              <div className="mt-0.5 font-['IBM_Plex_Mono'] text-lg font-medium text-white">{refLabel}</div>
            </div>
          </div>
          <h1 className="m-0 text-[38px] font-semibold leading-[1.1] tracking-[-0.8px] text-white">
            {coverTitle}
            <br />
            <span className="text-xl font-normal tracking-normal text-[#E9CFCF]">
              {daysCount} days · {nightsCount} nights
            </span>
          </h1>
        </div>

        <div className="flex flex-1 flex-col px-14 pb-9 pt-[26px]">
          <div className="grid grid-cols-3 border-t border-[#101010]">
            <MetaColumn title="Document">
              <MetaRow label="Reference" value={itinerary.reference} mono />
              <MetaRow label="Version" value={versionLabel || '—'} mono />
              <MetaRow label="Document date" value={issuedOn} mono />
              <MetaRow label="Valid until" value={validUntil} mono accent />
            </MetaColumn>
            <MetaColumn title="Travel dates" bordered>
              <MetaRow
                label="Arrival"
                value={itinerary.travelDateFrom ? fmtLedgerDateLong(itinerary.travelDateFrom) : 'TBC'}
                mono
              />
              <MetaRow
                label="Departure"
                value={itinerary.travelDateTo ? fmtLedgerDateLong(itinerary.travelDateTo) : 'TBC'}
                mono
              />
              <MetaRow label="Nights" value={String(nightsCount)} mono />
              <MetaRow label="Countries" value={countries} />
            </MetaColumn>
            {documentKind === 'invoice' ? (
              <MetaColumn title="Invoiced to" last>
                <InvoicedToProfile profile={invoiceRecipientProfile(itinerary, travelCounsellors)} />
              </MetaColumn>
            ) : (
              <MetaColumn title="Booking" last>
                <MetaRow label="Name" value={bookingName} />
                <MetaRow label="Guests" value={String(totalGuests || '—')} mono />
                <MetaRow label="Composition" value={paxComposition(adults, children, infants)} mono />
                <BookedByMetaRow contact={bookedByContact(itinerary)} />
              </MetaColumn>
            )}
          </div>

          {documentKind === 'invoice' ? (
            <BookingConsultantRow contact={bookedByContact(itinerary)} />
          ) : null}

          <div className="mt-8 grid grid-cols-2 gap-7">
            <BookingAgentSection block={bookingAgentBlock(itinerary)} />
            <GuestDetailsSection lines={guestLines} />
          </div>

          {documentKind === 'quote' ? (
            <div className="mt-8 rounded border border-[#101010] px-[22px] py-5">
              <SectionLabel>Presentation</SectionLabel>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[#3D3D3D]">
                This is a packaged {audienceLabel} quote. Service descriptions follow on the next page; line prices are
                not shown. Package totals appear on page 3.
                {b2c ? ' No operator commission or net figures appear anywhere on this document.' : ''}
              </p>
            </div>
          ) : null}

          <div className="flex-1" />
          <PageFooter left="info@chelipeacock.com · +254 730 721 000" right={`1 / ${totalPages}`} />
        </div>
      </section>

      <section
        data-qd-page="2"
        className="qd-page flex shrink-0 flex-col overflow-hidden bg-white shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
        style={{ width: PAGE_W, minHeight: PAGE_H }}
      >
        <PackagedHeader title="Includes" refLabel={refLabel} />
        <div className="flex flex-1 flex-col px-14 pb-8 pt-[30px]">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="m-0 text-[21px] font-semibold tracking-[-0.3px]">Trip includes</h2>
            <span className="text-[10px] font-semibold uppercase tracking-[1.4px] text-[#931115]">
              Descriptions only — no line prices
            </span>
          </div>

          <div className="mt-4 grid grid-cols-[72px_minmax(0,1fr)] gap-x-4 border-b border-t border-[#101010] py-[7px] text-[8.5px] font-semibold uppercase tracking-[0.9px] text-[#8A8A8A]">
            <span>Date</span>
            <span>Description</span>
          </div>

          {includesRows.length ? (
            includesRows.map((row) => (
              <div
                key={row.lineId}
                className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-4 border-b border-[#F5F5F5] py-[7px] text-[11px] leading-snug"
              >
                <span className="font-['IBM_Plex_Mono'] text-[#6E6E6E]">{row.date}</span>
                <span className="text-[#3D3D3D]">{row.description}</span>
              </div>
            ))
          ) : (
            <p className="py-8 text-[13px] text-[#8A8A8A]">No services have been added to this itinerary yet.</p>
          )}

          <div className="flex-1" />
          <PageFooter
            left="Chronological service sequence — complimentary and zero-priced services included"
            right={`2 / ${totalPages}`}
            bordered
          />
        </div>
      </section>

      <section
        data-qd-page="3"
        className="qd-page flex shrink-0 flex-col overflow-hidden bg-white shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
        style={{ width: PAGE_W, height: PAGE_H }}
      >
        <PackagedHeader title="Package totals" refLabel={refLabel} />
        <div className="flex flex-1 flex-col px-14 pb-8 pt-[34px]">
          <p className="m-0 mb-6 text-[11px] leading-relaxed text-[#8A8A8A]">
            {rateTag}
            {documentKind === 'quote' ? ' · per-line pricing is not shown on packaged quotes' : ' · per-line pricing is not shown'}
          </p>

          <div
            className={cn(
              'grid grid-cols-[minmax(0,1fr)_120px_120px] gap-x-4 border-b border-t border-[#101010] py-[7px]',
              'text-[8.5px] font-semibold uppercase tracking-[0.9px] text-[#8A8A8A]',
            )}
          >
            <span>Description</span>
            <span className="text-right">Gross price</span>
            <span className="text-right">Net amount</span>
          </div>

          {categoryRows.length ? (
            categoryRows.map((row) => (
              <div
                key={row.description}
                className="grid grid-cols-[minmax(0,1fr)_120px_120px] gap-x-4 border-b border-[#F5F5F5] py-[7px] text-[11px] leading-snug"
              >
                <span className="font-semibold text-[#3D3D3D]">{row.description}</span>
                <span className="text-right font-['IBM_Plex_Mono'] font-medium">
                  {fmtLedgerAmount(row.grossPrice)}
                </span>
                <span className="text-right font-['IBM_Plex_Mono'] font-medium">
                  {fmtLedgerAmount(row.netAmount)}
                </span>
              </div>
            ))
          ) : (
            <p className="py-8 text-[13px] text-[#8A8A8A]">No services have been added to this itinerary yet.</p>
          )}

          {categoryRows.length ? (
            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_120px_120px] gap-x-4 border border-[#101010] bg-[#101010] px-4 py-[14px] text-white">
              <span className="text-[12px] font-semibold uppercase tracking-[0.8px]">Safari total</span>
              <span className="text-right font-['IBM_Plex_Mono'] text-[15px] font-semibold">
                {fmtLedgerAmount(categoryGrossTotal)}
              </span>
              <span className="text-right font-['IBM_Plex_Mono'] text-[15px] font-semibold">
                {fmtLedgerAmount(categoryNetTotal)}
              </span>
            </div>
          ) : null}

          <div className="mt-8">
            <SectionLabel>Passenger price split</SectionLabel>
            <div className="mt-2 grid grid-cols-4 gap-3">
              <PaxSplitCell label="Total adults" value={String(paxPriceSplit.totalAdults)} />
              <PaxSplitCell label="Total children" value={String(paxPriceSplit.totalChildren)} />
              <PaxSplitCell label="Total adult price" value={fmtLedgerUsd(paxPriceSplit.totalAdultPrice)} />
              <PaxSplitCell label="Total child price" value={fmtLedgerUsd(paxPriceSplit.totalChildPrice)} />
            </div>
          </div>

          <p className="mt-8 text-[11px] leading-relaxed text-[#8A8A8A]">
            Category totals show gross and net amounts by service type.
            {documentKind === 'quote' ? ' Per-line pricing is not shown on packaged quotes.' : ' Per-line pricing is not shown.'}
          </p>

          <div className="flex-1" />
          <PageFooter
            left={totalsFooterLeft ?? `Quote valid until ${validUntil}`}
            right={`3 / ${totalPages}`}
            bordered
          />
        </div>
      </section>

      {showTerms ? (
        <section
          data-qd-page="4"
          className="qd-page flex shrink-0 flex-col overflow-hidden bg-white shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
          style={{ width: PAGE_W, minHeight: PAGE_H }}
        >
          <PackagedHeader title="Inclusions and terms" refLabel={refLabel} />
          <div className="flex flex-1 flex-col px-14 pb-8 pt-[34px]">
            <h2 className="m-0 mb-[18px] text-[21px] font-semibold tracking-[-0.3px]">
              General inclusions &amp; exclusions
            </h2>
            <div className="grid grid-cols-2 border border-[#101010]">
              <div className="border-r border-[#E4E4E4] px-5 py-[18px]">
                <div className="text-[9px] font-semibold uppercase tracking-[1.2px] text-[#931115]">
                  General inclusions
                </div>
                <RichTextDocumentContent html={inclusionsHtml} variant="plain" className="mt-3 text-[#3D3D3D]" />
              </div>
              <div className="px-5 py-[18px]">
                <div className="text-[9px] font-semibold uppercase tracking-[1.2px] text-[#931115]">
                  General exclusions
                </div>
                <RichTextDocumentContent html={exclusionsHtml} variant="plain" className="mt-3 text-[#3D3D3D]" />
              </div>
            </div>

            <QuoteTextSupplement quoteText={renderModel.quoteText} />

            {optionRows.length ? (
              <div className="mt-[26px]">
                <SectionLabel>By supplier service option</SectionLabel>
                <div className="mt-2 grid grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)] gap-x-3.5 border-b border-[#F0F0F0] py-2 text-[8.5px] font-semibold uppercase tracking-[0.9px] text-[#8A8A8A]">
                  <span>Supplier / option</span>
                  <span>Includes</span>
                  <span>Excludes</span>
                </div>
                {optionRows.map((row) => (
                  <div
                    key={`${row.supplier}-${row.option}`}
                    className="grid grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)] gap-x-3.5 border-b border-[#F5F5F5] py-2.5 text-[11px] leading-snug"
                  >
                    <span>
                      <b>{row.supplier}</b>
                      <br />
                      <span className="text-[#8A8A8A]">{row.option}</span>
                    </span>
                    <span className="text-[#3D3D3D]">{row.includes}</span>
                    <span className="text-[#3D3D3D]">{row.excludes}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-[26px]">
              <SectionLabel>Payment terms (summary)</SectionLabel>
              <div className="mt-2 text-[11px] text-[#3D3D3D]">
                Applied deposit {paymentTerms.appliedDeposit} · Balance due {paymentTerms.appliedBalance}
              </div>
            </div>

            {cancellationRows.length ? (
              <div className="mt-4">
                <SectionLabel>Cancellation (summary)</SectionLabel>
                <div className="mt-2 flex flex-col gap-2">
                  {cancellationRows.slice(0, 4).map((row) => (
                    <div key={row.supplier} className="text-[11px] leading-snug text-[#3D3D3D]">
                      <b>{row.supplier}</b> — {row.policy}
                      {row.description ? (
                        <p className="mt-0.5 text-[10.5px] text-[#6E6E6E]">{row.description}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex-1" />
            <PageFooter
              left="Terms are those held against each supplier contract at the date of this quote"
              right={`4 / ${totalPages}`}
              bordered
            />
          </div>
        </section>
      ) : null}

      {documentKind === 'invoice' ? (
        <CpsRemittancePages
          refLabel={refLabel}
          totalPages={totalPages}
          startPage={remittanceStartPage(true, showTerms)}
          pageAttr="data-qd-page"
          Header={PackagedHeader}
        />
      ) : null}
    </>
  )
}

function PackagedHeader({ title, refLabel }: { title: string; refLabel: string }) {
  return (
    <div className="flex h-[42px] shrink-0 items-center justify-between px-14" style={{ background: MAROON }}>
      <span className="text-[9.5px] font-semibold uppercase tracking-[2px] text-[#E9CFCF]">{title}</span>
      <span className="font-['IBM_Plex_Mono'] text-[11px] text-[#DFB9B9]">{refLabel}</span>
    </div>
  )
}

function MetaColumn({
  title,
  children,
  bordered,
  last,
}: {
  title: string
  children: React.ReactNode
  bordered?: boolean
  last?: boolean
}) {
  return (
    <div
      className={cn(
        'py-2.5',
        bordered && 'border-x border-[#E4E4E4] px-[18px]',
        last ? 'pl-[18px]' : 'pr-[18px]',
      )}
    >
      <div className="text-[9px] font-semibold uppercase tracking-[1.2px] text-[#931115]">{title}</div>
      <div className="mt-2 flex flex-col">{children}</div>
    </div>
  )
}

function MetaRow({
  label,
  value,
  mono,
  accent,
  bold,
}: {
  label: string
  value: string
  mono?: boolean
  accent?: boolean
  bold?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-2.5 border-b border-[#EFEFEF] py-[7px]">
      <span className={cn('text-[10.5px]', accent ? 'text-[#931115]' : 'text-[#8A8A8A]')}>{label}</span>
      <span
        className={cn(
          'text-[12.5px]',
          mono && "font-['IBM_Plex_Mono'] text-[13px] font-medium",
          accent && 'font-semibold text-[#931115]',
          bold && 'font-semibold',
        )}
      >
        {value}
      </span>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-[#101010] pb-1.5 text-[9px] font-semibold uppercase tracking-[1.2px] text-[#8A8A8A]">
      {children}
    </div>
  )
}

function PageFooter({ left, right, bordered }: { left: string; right: string; bordered?: boolean }) {
  return (
    <div
      className={cn(
        'flex justify-between text-[10.5px] text-[#8A8A8A]',
        bordered && 'border-t border-[#E4E4E4] pt-2.5',
      )}
    >
      <span>{left}</span>
      <span className="font-['IBM_Plex_Mono']">{right}</span>
    </div>
  )
}

function PaxSplitCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] px-3 py-2.5">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-[#8A8A8A]">{label}</div>
      <div className="mt-0.5 font-['IBM_Plex_Mono'] text-[13px] font-semibold">{value}</div>
    </div>
  )
}
