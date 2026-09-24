import { invoiceCoverKindLabel } from '@/features/quote-doc/documentOptionsModel'
import {
  buildLedgerPaymentTerms,
  fmtLedgerAmount,
  fmtLedgerDateLong,
  fmtLedgerUsd,
  bookedByContact,
  guestDetailLines,
  type LedgerCancellationRow,
  type LedgerOptionRow,
} from '@/features/quote-doc/quoteLedgerModel'
import { BookingConsultantRow, GuestDetailsSection, InvoicedToProfile } from '@/features/quote-doc/quoteCoverMeta'
import { RichTextDocumentContent } from '@/features/quote-doc/RichTextDocumentContent'
import { QuoteTextSupplement } from '@/features/quote-doc/quoteTextBlocks'
import {
  GeneralCancellationPolicySection,
  PerSupplierPaymentTermsTable,
  SupplierCancellationPolicyCard,
} from '@/features/invoice-doc/invoiceTermsSections'
import {
  CpsRemittancePages,
  RemittanceLedgerHeader,
} from '@/features/invoice-doc/CpsRemittancePages'
import { remittanceStartPage } from '@/features/invoice-doc/cpsRemittanceModel'
import {
  lifecycleStageLabel,
  type InvoiceRenderModel,
} from '@/features/invoice-doc/invoiceSnapshotModel'
import type { Guest, GuestDetail, Itinerary } from '@/shared/lib/types'
import {
  DottedTotalRow,
  PaxSplitCell,
  PaymentPosRow,
  paymentDueRowLabel,
} from '@/features/quote-doc/documentTotalsBlocks'
import { cn } from '@/shared/lib/utils'

const PAGE_W = 794
const PAGE_H = 1123
const MAROON = '#580B0B'
const GRID_SCHEDULE = 'grid grid-cols-[52px_118px_minmax(0,1fr)_56px_26px_50px_72px_84px] gap-x-2'
const GRID_ROLLED_UP = 'grid grid-cols-[minmax(0,1fr)_110px_110px_110px] gap-x-3'

export type InvoiceLedgerContentProps = {
  itinerary: Itinerary
  renderModel: InvoiceRenderModel
  refLabel: string
  invoiceNumber: string
  coverTitle: string
  issuedOn: string
  daysCount: number
  nightsCount: number
  totalGuests: number
  lead: string
  countries: string
  guests: Guest[]
  guestDetails: GuestDetail[]
  showTerms: boolean
  totalPages: number
  paymentTerms: ReturnType<typeof buildLedgerPaymentTerms>
  cancellationRows: LedgerCancellationRow[]
  optionRows: LedgerOptionRow[]
  pricingDiscounts: { label: string; amount: number }[]
  grossSell: number
  sellTotal: number
}

export function InvoiceLedgerContent({
  itinerary,
  renderModel,
  refLabel,
  invoiceNumber,
  coverTitle,
  issuedOn,
  daysCount,
  nightsCount,
  totalGuests,
  countries,
  guests,
  guestDetails,
  showTerms,
  totalPages,
  paymentTerms,
  cancellationRows,
  optionRows,
  pricingDiscounts,
  grossSell,
  sellTotal,
}: InvoiceLedgerContentProps) {
  const guestLines = guestDetailLines(guests, guestDetails)
  const {
    scheduleGroups,
    paymentPosition,
    lifecycleStage,
    quoteText,
    renderingDepth,
    travelCounsellors,
    rolledUpRows,
    paxPriceSplit,
  } = renderModel
  const pos = paymentPosition
  const rolledUp = renderingDepth === 'rolled_up'

  return (
    <>
      <section
        data-inv-page="1"
        className="inv-page flex shrink-0 flex-col overflow-hidden bg-white shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
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
                {invoiceCoverKindLabel(travelCounsellors)}
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
              <MetaRow label="Invoice number" value={invoiceNumber} mono />
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
              <InvoicedToProfile profile={renderModel.invoiceAddressee} />
            </MetaColumn>
          </div>

          <BookingConsultantRow contact={bookedByContact(itinerary)} />

          <div className="mt-8">
            <GuestDetailsSection lines={guestLines} />
          </div>

          <div className="mt-8 flex items-center justify-between gap-5 border border-[#101010] px-[22px] py-5">
            <div>
              <SectionLabel>Booking total</SectionLabel>
              <div className="mt-1 text-[11.5px] text-[#555555]">
                All prices in USD net · {totalGuests || '—'} guest{totalGuests === 1 ? '' : 's'}
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
        data-inv-page="2"
        className="inv-page flex shrink-0 flex-col overflow-hidden bg-white shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
        style={{ width: PAGE_W, minHeight: PAGE_H }}
      >
        <LedgerHeader title="Schedule of services" refLabel={refLabel} />
        <div className="flex flex-1 flex-col px-14 pb-8 pt-[30px]">
          <div className="flex items-baseline justify-end gap-4">
            <span className="text-[10px] font-semibold uppercase tracking-[1.4px] text-[#931115]">
              All prices in USD net
            </span>
          </div>

          {rolledUp ? (
            <>
              <div
                className={cn(
                  GRID_ROLLED_UP,
                  'mt-4 border-b border-t border-[#101010] py-[7px] text-[8.5px] font-semibold uppercase tracking-[0.9px] text-[#8A8A8A]',
                )}
              >
                <span>Description</span>
                <span className="text-right">Gross price</span>
                <span className="text-right">Commission</span>
                <span className="text-right">Net amount</span>
              </div>
              {rolledUpRows?.length ? (
                rolledUpRows.map((row) => (
                  <div
                    key={row.description}
                    className={cn(GRID_ROLLED_UP, 'border-b border-[#F5F5F5] py-[7px] text-[10.5px] leading-snug')}
                  >
                    <span className="text-[#3D3D3D]">{row.description}</span>
                    <span className="text-right font-medium">{fmtLedgerAmount(row.grossPrice)}</span>
                    <span className="text-right text-[#6E6E6E]">
                      {row.commission != null ? fmtLedgerAmount(row.commission) : '—'}
                    </span>
                    <span className="text-right font-medium">{fmtLedgerAmount(row.netAmount)}</span>
                  </div>
                ))
              ) : (
                <p className="py-8 text-[13px] text-[#8A8A8A]">No services have been added to this itinerary yet.</p>
              )}
              {travelCounsellors ? (
                <p className="mt-3 text-[11px] leading-relaxed text-[#8A8A8A]">
                  Commission reflects the 6% Travel Counsellors head-office rate on qualifying services.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <div
                className={cn(
                  GRID_SCHEDULE,
                  'mt-4 border-b border-t border-[#101010] py-[7px] text-[8.5px] font-semibold uppercase tracking-[0.9px] text-[#8A8A8A]',
                )}
              >
                <span>Date</span>
                <span>Supplier</span>
                <span>Service</span>
                <span className="text-center">Pax</span>
                <span className="text-center">Qty</span>
                <span className="text-center">Duration</span>
                <span className="text-right">Unit price</span>
                <span className="text-right">Amount</span>
              </div>

              {scheduleGroups.length ? (
                scheduleGroups.map((group) => (
                  <div key={group.name}>
                    <div className="flex items-baseline justify-between gap-2.5 border-b border-[#EDEDED] py-2 pb-1">
                      <span className="text-[9.5px] font-semibold uppercase tracking-[1.3px]" style={{ color: MAROON }}>
                        {group.name}
                      </span>
                      <span className="text-[11px] font-semibold" style={{ color: MAROON }}>
                        {fmtLedgerAmount(group.subtotal)}
                      </span>
                    </div>
                    {group.rows.map((row, i) => (
                      <div
                        key={`${group.name}-${i}`}
                        className={cn(GRID_SCHEDULE, 'border-b border-[#F5F5F5] py-[5px] text-[10.5px] leading-snug')}
                      >
                        <span className="text-[#6E6E6E]">{row.date}</span>
                        <span className="font-semibold text-[#3D3D3D]">{row.supplier}</span>
                        <span className="text-[#3D3D3D]">{row.service}</span>
                        <span className="text-center text-[#6E6E6E]">{row.pax}</span>
                        <span className="text-center text-[#6E6E6E]">{row.qty}</span>
                        <span className="text-center text-[#6E6E6E]">{row.duration}</span>
                        <span className="text-right text-[#6E6E6E]">{fmtLedgerAmount(row.unitPrice)}</span>
                        <span className="text-right font-medium text-[#3D3D3D]">{fmtLedgerAmount(row.amount)}</span>
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <p className="py-8 text-[13px] text-[#8A8A8A]">No services have been added to this itinerary yet.</p>
              )}
            </>
          )}

          <div className="flex-1" />
          <PageFooter
            left={
              rolledUp
                ? 'Gross/Commission/Net is agent-facing B2B disclosure — CPS internal cost is never shown.'
                : 'Cost and margin are never shown on the client document.'
            }
            right={`2 / ${totalPages}`}
            bordered
          />
        </div>
      </section>

      <section
        data-inv-page="3"
        className="inv-page flex shrink-0 flex-col overflow-hidden bg-white shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
        style={{ width: PAGE_W, height: PAGE_H }}
      >
        <LedgerHeader title="Totals and payment position" refLabel={refLabel} />
        <div className="flex flex-1 flex-col px-14 pb-8 pt-[34px]">
          <div>
            <DottedTotalRow label="Itinerary subtotal" amount={fmtLedgerAmount(grossSell)} />
            {pricingDiscounts.map((d) => (
              <DottedTotalRow
                key={d.label}
                label={d.label}
                amount={`−${fmtLedgerAmount(Math.abs(d.amount))}`}
                accent="#0369A1"
              />
            ))}
          </div>

          <div className="mt-5 flex items-end justify-between gap-5 border border-[#101010] bg-[#101010] px-[22px] py-[18px] text-white">
            <div>
              <div className="text-[9.5px] font-semibold uppercase tracking-[1.6px] text-[#B5B5B5]">Booking total</div>
              <div className="mt-1 text-[11px] text-[#B5B5B5]">
                All prices in USD net · {totalGuests} guest{totalGuests === 1 ? '' : 's'}
              </div>
            </div>
            <div className="font-['IBM_Plex_Mono'] text-[34px] font-semibold tracking-[-0.8px]">
              {fmtLedgerAmount(sellTotal)}
            </div>
          </div>

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

          <div className="mt-7">
            <SectionLabel>Guest price split</SectionLabel>
            <div className="mt-2 grid grid-cols-4 gap-3">
              <PaxSplitCell label="Total adults" value={String(paxPriceSplit.totalAdults)} />
              <PaxSplitCell label="Total children" value={String(paxPriceSplit.totalChildren)} />
              <PaxSplitCell label="Total adult price" value={fmtLedgerUsd(paxPriceSplit.totalAdultPrice)} />
              <PaxSplitCell label="Total child price" value={fmtLedgerUsd(paxPriceSplit.totalChildPrice)} />
            </div>
          </div>

          <div className="flex-1" />
          <PageFooter left="Payment figures reflect the itinerary at invoice generation" right={`3 / ${totalPages}`} bordered />
        </div>
      </section>

      <section
        data-inv-page="4"
        className="inv-page flex shrink-0 flex-col overflow-hidden bg-white shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
        style={{ width: PAGE_W, minHeight: PAGE_H }}
      >
        <LedgerHeader title="Inclusions and exclusions" refLabel={refLabel} />
        <div className="flex flex-1 flex-col px-14 pb-8 pt-[34px]">
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
              <SectionLabel>Service options</SectionLabel>
              <div className="mt-2 border border-[#101010]">
                <div className="grid grid-cols-[120px_100px_1fr_1fr] gap-3 border-b border-[#EFEFEF] px-4 py-[7px] text-[8.5px] font-semibold uppercase tracking-[0.9px] text-[#8A8A8A]">
                  <span>Supplier</span>
                  <span>Option</span>
                  <span>Includes</span>
                  <span>Excludes</span>
                </div>
                {optionRows.map((row, i) => (
                  <div
                    key={`${row.supplier}-${i}`}
                    className="grid grid-cols-[120px_100px_1fr_1fr] gap-3 border-b border-[#EFEFEF] px-4 py-[11px] text-[11px] last:border-b-0"
                  >
                    <span className="font-semibold">{row.supplier}</span>
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
        </div>
      </section>

      {showTerms ? (
        <section
          data-inv-page="5"
          className="inv-page flex shrink-0 flex-col overflow-hidden bg-white shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
          style={{ width: PAGE_W, minHeight: PAGE_H }}
        >
          <LedgerHeader title="Payment terms and cancellation" refLabel={refLabel} />
          <div className="flex flex-1 flex-col px-14 pb-8 pt-[34px]">
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
                  <p className="text-[12px] text-[#8A8A8A]">Supplier cancellation policies appear once suppliers are on the itinerary.</p>
                )}
              </div>
            </div>

            <div className="flex-1" />
            <PageFooter
              left="Per-supplier terms and cancellation policies as held at invoice generation"
              right={`5 / ${totalPages}`}
              bordered
            />
          </div>
        </section>
      ) : null}

      <CpsRemittancePages
        refLabel={refLabel}
        totalPages={totalPages}
        startPage={remittanceStartPage(false, showTerms)}
        pageAttr="data-inv-page"
        Header={RemittanceLedgerHeader}
      />
    </>
  )
}

function LedgerHeader({ title, refLabel }: { title: string; refLabel: string }) {
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
    <div className={cn('py-2.5', bordered && 'border-x border-[#E4E4E4] px-[18px]', last ? 'pl-[18px]' : 'pr-[18px]')}>
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
    <div className="flex items-baseline justify-between gap-2.5 border-b border-[#EFEFEF] py-[7px] last:border-b-0">
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
      <span>{right}</span>
    </div>
  )
}

