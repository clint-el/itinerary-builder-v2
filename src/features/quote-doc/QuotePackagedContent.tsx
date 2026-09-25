import {
  buildLedgerPaymentTerms,
  balanceDueDate,
  bookingAgentBlock,
  fmtLedgerDateLong,
  fmtLedgerAmount,
  fmtLedgerUsd,
  bookedByContact,
  guestDetailLines,
  paxComposition,
  type LedgerCancellationRow,
  type LedgerOptionRow,
} from '@/features/quote-doc/quoteLedgerModel'
import { RichTextDocumentContent } from '@/features/quote-doc/RichTextDocumentContent'
import { QuoteTextSupplement } from '@/features/quote-doc/quoteTextBlocks'
import {
  PaxSplitCell,
  PaymentPosRow,
  paymentDueRowLabel,
} from '@/features/quote-doc/documentTotalsBlocks'
import {
  BookedByMetaRow,
  BookingAgentSection,
  BookingConsultantRow,
  GuestDetailsSection,
  InvoicedToProfile,
} from '@/features/quote-doc/quoteCoverMeta'
import {
  invoiceCoverKindLabel,
  quotationCoverKindLabel,
} from '@/features/quote-doc/documentOptionsModel'
import { lifecycleStageLabel } from '@/features/invoice-doc/invoiceSnapshotModel'
import {
  GeneralCancellationPolicySection,
  GeneralPaymentTermsSection,
  PerSupplierPaymentTermsTable,
  SupplierCancellationPolicyCard,
} from '@/features/invoice-doc/invoiceTermsSections'
import { CpsRemittancePages, RemittanceLedgerHeader } from '@/features/invoice-doc/CpsRemittancePages'
import { remittanceStartPage } from '@/features/invoice-doc/cpsRemittanceModel'
import type { QuoteRenderModel } from '@/features/quote-doc/quoteSnapshotModel'
import type { Guest, GuestDetail, InvoiceLifecycleStage, Itinerary } from '@/shared/lib/types'
import { cn } from '@/shared/lib/utils'

const PAGE_W = 794
const PAGE_H = 1123
const MAROON = '#580B0B'
/** Itemised schedule columns without unit price or amount (packaged page 2). */
const GRID_SCHEDULE_PACKAGED =
  'grid grid-cols-[52px_118px_minmax(0,1fr)_56px_26px_50px] gap-x-2'

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
  lifecycleStage?: InvoiceLifecycleStage
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
  lead,
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
  lifecycleStage = 'deposit',
}: QuotePackagedContentProps) {
  const inclusionsHtml = renderModel.quoteText.generalInclusionsHtml
  const exclusionsHtml = renderModel.quoteText.generalExclusionsHtml
  const guestLines = guestDetailLines(guests, guestDetails)
  const {
    scheduleGroups,
    paxPriceSplit,
    categoryTotals,
    sellTotal,
    depositTotal,
    depositBalance,
    depositPctOfSell,
    priceMode,
    paymentPosition,
  } = renderModel
  const categoryGrid = categoryTotals
  const balanceDue = balanceDueDate(itinerary.travelDateFrom || '')
  const depositPctLabel = `${depositPctOfSell}%`
  const depositTotalLabel = fmtLedgerUsd(depositTotal)
  const depositBalanceLabel = fmtLedgerUsd(depositBalance)
  const perPerson = totalGuests > 0 ? sellTotal / totalGuests : 0
  const pos = paymentPosition
  const quoteText = renderModel.quoteText
  const coverTotalLabel = documentKind === 'invoice' ? 'Booking total' : 'Safari total'
  const pageAttr = documentKind === 'invoice' ? 'data-inv-page' : 'data-qd-page'
  const pageProps = (n: number) => ({ [pageAttr]: String(n) })

  return (
    <>
      <section
        {...pageProps(1)}
        className={cn(
          documentKind === 'invoice' ? 'inv-page' : 'qd-page',
          'flex shrink-0 flex-col overflow-hidden bg-white shadow-[0_12px_32px_rgba(0,0,0,0.35)]',
        )}
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
                {documentKind === 'invoice'
                  ? invoiceCoverKindLabel(travelCounsellors)
                  : quotationCoverKindLabel(travelCounsellors, true)}
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
            {documentKind === 'invoice' ? (
              <>
                <MetaColumn title="Document">
                  <MetaRow label="Invoice number" value={versionLabel || '—'} mono />
                  <MetaRow label="Reference" value={itinerary.reference} mono />
                  <MetaRow label="Invoice date" value={issuedOn} mono />
                  <MetaRow label="Stage" value={lifecycleStageLabel(lifecycleStage)} accent />
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
                <MetaColumn title="Invoiced to" last>
                  <InvoicedToProfile
                    profile={
                      renderModel.invoiceAddressee ?? {
                        type: 'agency',
                        legalName: '—',
                        addressLines: [],
                      }
                    }
                  />
                </MetaColumn>
              </>
            ) : (
              <>
                <MetaColumn title="Document">
                  <MetaRow label="Reference" value={itinerary.reference} mono />
                  <MetaRow label="Version" value={versionLabel || '—'} mono />
                  <MetaRow label="Issued" value={issuedOn} mono />
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
                  <MetaRow label="Duration" value={`${daysCount} d · ${nightsCount} n`} mono />
                  <MetaRow label="Countries" value={countries} />
                </MetaColumn>
                <MetaColumn title="PAX details" last>
                  <MetaRow label="Guests" value={String(totalGuests || '—')} mono />
                  <MetaRow label="Composition" value={paxComposition(adults, children, infants)} mono />
                  <MetaRow label="Lead guest" value={lead} />
                  <BookedByMetaRow contact={bookedByContact(itinerary)} />
                </MetaColumn>
              </>
            )}
          </div>

          {documentKind === 'invoice' ? (
            <BookingConsultantRow contact={bookedByContact(itinerary)} />
          ) : null}

          <div className={cn('mt-8', documentKind === 'quote' && 'grid grid-cols-2 gap-7')}>
            {documentKind === 'quote' ? (
              <BookingAgentSection block={bookingAgentBlock(itinerary)} />
            ) : null}
            <GuestDetailsSection lines={guestLines} />
          </div>

          <div className="mt-8 flex items-center justify-between gap-5 border border-[#101010] px-[22px] py-5">
            <div>
              <SectionLabel>{coverTotalLabel}</SectionLabel>
              <div className="mt-1 text-[11.5px] text-[#555555]">
                {totalGuests || '—'} guest{totalGuests === 1 ? '' : 's'}
              </div>
            </div>
            <div className="font-['IBM_Plex_Mono'] text-[32px] font-semibold tracking-[-0.5px]">
              {fmtLedgerUsd(sellTotal)}
            </div>
          </div>

          <div className="flex-1" />
          <PageFooter left="info@chelipeacock.com · +254 730 721 000" right={`1 / ${totalPages}`} />
        </div>
      </section>

      <section
        {...pageProps(2)}
        className={cn(
          documentKind === 'invoice' ? 'inv-page' : 'qd-page',
          'flex shrink-0 flex-col overflow-hidden bg-white shadow-[0_12px_32px_rgba(0,0,0,0.35)]',
        )}
        style={{ width: PAGE_W, minHeight: PAGE_H }}
      >
        <PackagedHeader title="Schedule of services" refLabel={refLabel} />
        <div className="flex flex-1 flex-col px-14 pb-8 pt-[30px]">
          <div className="flex items-baseline justify-end gap-4">
            <span className="text-[10px] font-semibold uppercase tracking-[1.4px] text-[#931115]">
              No line prices
            </span>
          </div>

          <div
            className={cn(
              GRID_SCHEDULE_PACKAGED,
              'mt-4 border-b border-t border-[#101010] py-[7px] text-[8.5px] font-semibold uppercase tracking-[0.9px] text-[#8A8A8A]',
            )}
          >
            <span>Date</span>
            <span>Supplier</span>
            <span>Service</span>
            <span className="text-center">Pax</span>
            <span className="text-center">Qty</span>
            <span className="text-center">Duration</span>
          </div>

          {scheduleGroups.length ? (
            scheduleGroups.map((group) => (
              <div key={group.name}>
                <div className="border-b border-[#EDEDED] py-2 pb-1">
                  <span className="text-[9.5px] font-semibold uppercase tracking-[1.3px]" style={{ color: MAROON }}>
                    {group.name}
                  </span>
                </div>
                {group.rows.map((row, i) => (
                  <div
                    key={`${group.name}-${i}`}
                    className={cn(
                      GRID_SCHEDULE_PACKAGED,
                      'border-b border-[#F5F5F5] py-[5px] text-[10.5px] leading-snug',
                    )}
                  >
                    <span className="text-[#6E6E6E]">{row.date}</span>
                    <span className="font-semibold text-[#3D3D3D]">{row.supplier}</span>
                    <span className="text-[#3D3D3D]">{row.service}</span>
                    <span className="text-center text-[#6E6E6E]">{row.pax}</span>
                    <span className="text-center text-[#6E6E6E]">{row.qty}</span>
                    <span className="text-center text-[#6E6E6E]">{row.duration}</span>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <p className="py-8 text-[13px] text-[#8A8A8A]">No services have been added to this itinerary yet.</p>
          )}

          <div className="flex-1" />
          <PageFooter
            left="Per-line unit price and amount are not shown on packaged documents."
            right={`2 / ${totalPages}`}
            bordered
          />
        </div>
      </section>

      <section
        {...pageProps(3)}
        className={cn(
          documentKind === 'invoice' ? 'inv-page' : 'qd-page',
          'flex shrink-0 flex-col overflow-hidden bg-white shadow-[0_12px_32px_rgba(0,0,0,0.35)]',
        )}
        style={{ width: PAGE_W, height: PAGE_H }}
      >
        <PackagedHeader
          title={documentKind === 'invoice' ? 'Totals and payment position' : 'Totals and payment'}
          refLabel={refLabel}
        />
        <div className="flex flex-1 flex-col px-14 pb-8 pt-[34px]">
          {documentKind === 'quote' ? (
            <div className="grid grid-cols-6 border border-[#101010]">
              {categoryGrid.map((cat, i) => (
                <div
                  key={cat.name}
                  className={cn(
                    'col-span-2 px-4 py-3.5',
                    i % 3 !== 2 && 'border-r border-[#E4E4E4]',
                    i >= 3 && 'border-t border-[#E4E4E4]',
                  )}
                >
                  <div className="text-[9px] font-semibold uppercase tracking-[1.2px] text-[#8A8A8A]">{cat.name}</div>
                  <div className="mt-1 font-['IBM_Plex_Mono'] text-[15px] font-medium">{fmtLedgerAmount(cat.amount)}</div>
                </div>
              ))}
            </div>
          ) : null}

          <div
            className={cn(
              'flex items-end justify-between gap-5 border border-[#101010] bg-[#101010] px-[22px] py-[18px] text-white',
              documentKind === 'quote' && 'mt-[22px]',
            )}
          >
            <div>
              <div className="text-[9.5px] font-semibold uppercase tracking-[1.6px] text-[#B5B5B5]">
                {documentKind === 'invoice' ? 'Booking total' : 'Safari total'}
              </div>
              <div className="mt-1 text-[11px] text-[#B5B5B5]">
                {totalGuests} guest{totalGuests === 1 ? '' : 's'}
                {documentKind === 'quote' && priceMode === 'pp' && totalGuests
                  ? ` · ${fmtLedgerUsd(perPerson)} per person`
                  : ''}
              </div>
            </div>
            <div className="font-['IBM_Plex_Mono'] text-[34px] font-semibold tracking-[-0.8px]">
              {fmtLedgerAmount(sellTotal)}
            </div>
          </div>

          {documentKind === 'invoice' && pos ? (
            <div className="mt-7">
              <SectionLabel>Payment position</SectionLabel>
              <div className="mt-3 flex flex-col gap-2">
                <PaymentPosRow label="Total Safari Cost" value={fmtLedgerUsd(pos.total)} tone="neutral" />
                <PaymentPosRow label="Deposit Paid" value={fmtLedgerUsd(pos.paid)} tone="paid" />
                {pos.amountDueImmediately > 0 ? (
                  <PaymentPosRow
                    label={paymentDueRowLabel('Deposit due', pos.depositDueDate)}
                    value={fmtLedgerUsd(pos.amountDueImmediately)}
                    tone="urgent"
                  />
                ) : null}
                {pos.futureAmountDue != null && pos.futureAmountDue > 0 ? (
                  <PaymentPosRow
                    label={paymentDueRowLabel('Balance payment due', pos.futureDueDate)}
                    value={fmtLedgerUsd(pos.futureAmountDue)}
                    tone="future"
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          {documentKind === 'quote' ? (
            <div className="mt-7">
              <SectionLabel>Payment schedule</SectionLabel>
              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_200px_110px] gap-x-3 border-b border-[#F0F0F0] py-2 text-[8.5px] font-semibold uppercase tracking-[0.9px] text-[#8A8A8A]">
                <span>Instalment</span>
                <span>Basis</span>
                <span className="text-right">Amount</span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_200px_110px] gap-x-3 border-b border-[#F5F5F5] py-2 text-[11.5px]">
                <span className="font-semibold">Deposit on acceptance</span>
                <span className="text-[11px] text-[#6E6E6E]">Supplier terms · {depositPctLabel} of total</span>
                <span className="text-right font-medium">{depositTotalLabel}</span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_200px_110px] gap-x-3 border-b border-[#F5F5F5] py-2 text-[11.5px]">
                <span className="font-semibold">Balance</span>
                <span className="text-[11px] text-[#6E6E6E]">60 days before arrival · {balanceDue}</span>
                <span className="text-right font-medium">{depositBalanceLabel}</span>
              </div>
            </div>
          ) : null}

          {documentKind === 'quote' ? (
            <p className="mt-6 text-[11px] leading-relaxed text-[#8A8A8A]">
              Unit rate types differ across the itinerary — per person per day, per person per unit, per unit — so the
              per-person figure is an average across the party rather than a rate charged to any one guest.
            </p>
          ) : null}

          <div className={documentKind === 'invoice' ? 'mt-7' : 'mt-6'}>
            <SectionLabel>Guest price split</SectionLabel>
            <div className="mt-2 grid grid-cols-4 gap-3">
              <PaxSplitCell label="Total adults" value={String(paxPriceSplit.totalAdults)} />
              <PaxSplitCell label="Total children" value={String(paxPriceSplit.totalChildren)} />
              <PaxSplitCell label="Price per adult" value={fmtLedgerUsd(paxPriceSplit.totalAdultPrice)} />
              <PaxSplitCell label="Price per child" value={fmtLedgerUsd(paxPriceSplit.totalChildPrice)} />
            </div>
          </div>

          <div className="flex-1" />
          <PageFooter
            left={
              documentKind === 'invoice'
                ? 'Payment figures reflect the itinerary at invoice generation'
                : (totalsFooterLeft ?? `Quote valid until ${validUntil}`)
            }
            right={`3 / ${totalPages}`}
            bordered
          />
        </div>
      </section>

      <section
        {...pageProps(4)}
        className={cn(
          documentKind === 'invoice' ? 'inv-page' : 'qd-page',
          'flex shrink-0 flex-col overflow-hidden bg-white shadow-[0_12px_32px_rgba(0,0,0,0.35)]',
        )}
        style={{ width: PAGE_W, minHeight: PAGE_H }}
      >
        <PackagedHeader title="Inclusions and exclusions" refLabel={refLabel} />
        <div className="flex flex-1 flex-col px-14 pb-8 pt-[34px]">
          {documentKind === 'invoice' ? (
            <>
              <div className="mb-[18px] grid grid-cols-2 gap-8">
                <div>
                  <SectionLabel>General inclusions</SectionLabel>
                  <RichTextDocumentContent html={quoteText.generalInclusionsHtml} variant="bullets" className="mt-3" />
                </div>
                <div>
                  <SectionLabel>General exclusions</SectionLabel>
                  <RichTextDocumentContent html={quoteText.generalExclusionsHtml} variant="bullets" className="mt-3" />
                </div>
              </div>
              <QuoteTextSupplement quoteText={quoteText} />
              {optionRows.length ? (
                <div className="mt-[26px]">
                  <SectionLabel>Supplier Service options</SectionLabel>
                  <div className="mt-2 border border-[#101010]">
                    <div className="grid grid-cols-[108px_88px_88px_1fr_1fr] gap-3 border-b border-[#EFEFEF] px-4 py-[7px] text-[8.5px] font-semibold uppercase tracking-[0.9px] text-[#8A8A8A]">
                      <span>Supplier</span>
                      <span>Service</span>
                      <span>Basis</span>
                      <span>Includes</span>
                      <span>Excludes</span>
                    </div>
                    {optionRows.map((row, i) => (
                      <div
                        key={`${row.supplier}-${i}`}
                        className="grid grid-cols-[108px_88px_88px_1fr_1fr] gap-3 border-b border-[#EFEFEF] px-4 py-[11px] text-[11px] last:border-b-0"
                      >
                        <span className="font-semibold">{row.supplier}</span>
                        <span className="text-[#525252]">{row.service}</span>
                        <span className="text-[#525252]">{row.option}</span>
                        <span className="text-[#525252]">{row.includes}</span>
                        <span className="text-[#8A8A8A]">{row.excludes}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="flex-1" />
              <PageFooter left="Per-supplier option detail from service contracts" right={`4 / ${totalPages}`} bordered />
            </>
          ) : (
            <>
              <h2 className="m-0 mb-[18px] text-[21px] font-semibold tracking-[-0.3px]">
                Safari Inclusions &amp; Exclusions
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
              <QuoteTextSupplement quoteText={quoteText} />
              <p className="mt-3.5 text-[11px] leading-relaxed text-[#8A8A8A]">
                These items are not included in bed and breakfast, half board or day room bookings. Inclusions and
                exclusions specific to each supplier service option are set out below.
              </p>
              <div className="mt-[26px]">
                <SectionLabel>Supplier Service options</SectionLabel>
                <div className="mt-2 grid grid-cols-[120px_88px_88px_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 border-b border-[#F0F0F0] py-2 text-[8.5px] font-semibold uppercase tracking-[0.9px] text-[#8A8A8A]">
                  <span>Supplier</span>
                  <span>Service</span>
                  <span>Basis</span>
                  <span>Includes</span>
                  <span>Excludes</span>
                </div>
                {optionRows.length ? (
                  optionRows.map((row) => (
                    <div
                      key={`${row.supplier}-${row.service}-${row.option}`}
                      className="grid grid-cols-[120px_88px_88px_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 border-b border-[#F5F5F5] py-2.5 text-[11px] leading-snug"
                    >
                      <span className="font-semibold">{row.supplier}</span>
                      <span className="text-[#3D3D3D]">{row.service}</span>
                      <span className="text-[#3D3D3D]">{row.option}</span>
                      <span className="text-[#3D3D3D]">{row.includes}</span>
                      <span className="text-[#3D3D3D]">{row.excludes}</span>
                    </div>
                  ))
                ) : (
                  <p className="py-4 text-[12px] text-[#8A8A8A]">Add services to populate per-option inclusions.</p>
                )}
              </div>
              <div className="flex-1" />
              <PageFooter left="Full per-option terms continue on request" right={`4 / ${totalPages}`} bordered />
            </>
          )}
        </div>
      </section>

      {showTerms ? (
        <section
          {...pageProps(5)}
          className={cn(
            documentKind === 'invoice' ? 'inv-page' : 'qd-page',
            'flex shrink-0 flex-col overflow-hidden bg-white shadow-[0_12px_32px_rgba(0,0,0,0.35)]',
          )}
          style={{ width: PAGE_W, minHeight: PAGE_H }}
        >
          <PackagedHeader title="Payment terms and cancellation" refLabel={refLabel} />
          <div className="flex flex-1 flex-col px-14 pb-8 pt-[34px]">
            {documentKind === 'invoice' ? (
              <>
                <GeneralPaymentTermsSection quoteText={quoteText} />
                <PerSupplierPaymentTermsTable paymentTerms={paymentTerms} />
                <GeneralCancellationPolicySection quoteText={quoteText} />
                <div className="mt-7">
                  <SectionLabel>Supplier cancellation policies</SectionLabel>
                  <div className="mt-2 flex flex-col gap-4">
                    {cancellationRows.length ? (
                      cancellationRows.map((row) => (
                        <SupplierCancellationPolicyCard key={row.supplier} row={row} />
                      ))
                    ) : (
                      <p className="text-[12px] text-[#8A8A8A]">
                        Supplier cancellation policies appear once suppliers are on the itinerary.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex-1" />
                <PageFooter
                  left="Per-supplier terms and cancellation policies as held at invoice generation"
                  right={`5 / ${totalPages}`}
                  bordered
                />
              </>
            ) : (
              <>
                <h2 className="m-0 mb-1.5 text-[21px] font-semibold tracking-[-0.3px]">
                  Supplier Payment Terms &amp; Cancellation Policies
                </h2>
                <p className="m-0 mb-5 text-[11px] leading-relaxed text-[#8A8A8A]">
                  Each supplier sets its own terms for the travel dates quoted. The payment schedule on page 3 takes the
                  strictest of them — the highest deposit and the earliest balance date across the itinerary — so a
                  single deposit settles every booking.
                </p>
                <SectionLabel>Payment terms</SectionLabel>
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_128px_62px_96px_62px] gap-x-3 border-b border-[#F0F0F0] py-2 text-[8.5px] font-semibold uppercase tracking-[0.9px] text-[#8A8A8A]">
                  <span>Supplier / term</span>
                  <span>Travel dates</span>
                  <span className="text-right">Deposit</span>
                  <span className="text-right">Balance due</span>
                  <span className="text-right">Tax code</span>
                </div>
                {paymentTerms.rows.map((row) => (
                  <div
                    key={row.supplier}
                    className="grid grid-cols-[minmax(0,1fr)_128px_62px_96px_62px] gap-x-3 border-b border-[#F5F5F5] py-2.5 text-[11px] leading-snug"
                  >
                    <span>
                      <b>{row.supplier}</b>
                      <br />
                      <span className="text-[#8A8A8A]">{row.term}</span>
                    </span>
                    <span className="font-['IBM_Plex_Mono'] text-[10px] text-[#3D3D3D]">{row.travelDates}</span>
                    <span className="text-right font-['IBM_Plex_Mono']">{row.deposit}</span>
                    <span className="text-right text-[#3D3D3D]">{row.balanceDue}</span>
                    <span className="text-right text-[10px] text-[#8A8A8A]">{row.taxCode}</span>
                  </div>
                ))}
                <div className="grid grid-cols-[minmax(0,1fr)_128px_62px_96px_62px] gap-x-3 border-t border-[#101010] py-2 text-[11px]">
                  <span className="font-semibold">Applied to this itinerary</span>
                  <span className="text-[10px] text-[#8A8A8A]">Strictest across suppliers</span>
                  <span className="text-right font-['IBM_Plex_Mono'] font-semibold">{paymentTerms.appliedDeposit}</span>
                  <span className="text-right font-semibold">{paymentTerms.appliedBalance}</span>
                  <span />
                </div>
                <div className="mt-[26px]">
                  <SectionLabel>Supplier cancellation policies</SectionLabel>
                  <div className="mt-2 grid grid-cols-[148px_124px_104px_minmax(0,1fr)] gap-x-3.5 border-b border-[#F0F0F0] py-2 text-[8.5px] font-semibold uppercase tracking-[0.9px] text-[#8A8A8A]">
                    <span>Supplier / contract</span>
                    <span>Policy</span>
                    <span>Travel dates</span>
                    <span>Charge if cancelled</span>
                  </div>
                  {cancellationRows.length ? (
                    cancellationRows.map((row) => (
                      <div
                        key={row.supplier}
                        className="grid grid-cols-[148px_124px_104px_minmax(0,1fr)] gap-x-3.5 border-b border-[#F5F5F5] py-[11px] text-[11px] leading-snug"
                      >
                        <span>
                          <b>{row.supplier}</b>
                          <br />
                          <span className="text-[#8A8A8A]">{row.description}</span>
                        </span>
                        <span>
                          {row.policy}
                          <br />
                          <span
                            className={cn(
                              'text-[10px]',
                              row.refundableTone === 'blue' ? 'text-[#0369A1]' : 'text-[#931115]',
                            )}
                          >
                            {row.refundableLabel}
                          </span>
                        </span>
                        <span className="pt-px font-['IBM_Plex_Mono'] text-[10px] text-[#6E6E6E]">{row.travelDates}</span>
                        <span className="flex flex-col gap-1">
                          {row.charges.map((charge) => (
                            <div key={charge.label} className="grid grid-cols-[minmax(0,1fr)_62px] gap-x-2.5 leading-snug">
                              <span className="text-[#3D3D3D]">{charge.label}</span>
                              <span className="text-right font-['IBM_Plex_Mono'] font-medium">{charge.amount}</span>
                            </div>
                          ))}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="py-4 text-[12px] text-[#8A8A8A]">
                      Supplier cancellation policies appear once suppliers are on the itinerary.
                    </p>
                  )}
                </div>
                <p className="mt-4 text-[11px] leading-relaxed text-[#8A8A8A]">
                  Charges are a percentage of the service value unless shown as a cash amount. Where a policy is marked
                  non-refundable, no part of the service value is recoverable once the first charge band begins. Days are
                  counted against the travel date of the service concerned, not the start of the safari.
                </p>
                <div className="flex-1" />
                <PageFooter
                  left="Terms are those held against each supplier contract at the date of this quote"
                  right={`5 / ${totalPages}`}
                  bordered
                />
              </>
            )}
          </div>
        </section>
      ) : null}

      {documentKind === 'invoice' ? (
        <CpsRemittancePages
          refLabel={refLabel}
          totalPages={totalPages}
          startPage={remittanceStartPage(true, showTerms)}
          pageAttr={pageAttr}
          Header={RemittanceLedgerHeader}
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
