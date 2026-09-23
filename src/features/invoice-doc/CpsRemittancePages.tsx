import type { ComponentType } from 'react'
import {
  CPS_BANK_ACCOUNTS,
  CPS_OFFICES,
  type CpsBankAccount,
  type CpsOffice,
} from '@/features/invoice-doc/cpsRemittanceModel'

const PAGE_W = 794
const PAGE_H = 1123
const MAROON = '#580B0B'

type RemittanceHeaderProps = {
  title: string
  refLabel: string
}

type CpsRemittancePagesProps = {
  refLabel: string
  totalPages: number
  startPage: number
  pageAttr: 'data-inv-page' | 'data-qd-page'
  Header: ComponentType<RemittanceHeaderProps>
}

export function CpsRemittancePages({
  refLabel,
  totalPages,
  startPage,
  pageAttr,
  Header,
}: CpsRemittancePagesProps) {
  const pageClass =
    pageAttr === 'data-inv-page'
      ? 'inv-page flex shrink-0 flex-col overflow-hidden bg-white shadow-[0_12px_32px_rgba(0,0,0,0.35)]'
      : 'qd-page flex shrink-0 flex-col overflow-hidden bg-white shadow-[0_12px_32px_rgba(0,0,0,0.35)]'

  return (
    <>
      <section
        {...{ [pageAttr]: startPage }}
        className={pageClass}
        style={{ width: PAGE_W, minHeight: PAGE_H }}
      >
        <Header title="Bank remittance details" refLabel={refLabel} />
        <div className="flex flex-1 flex-col px-14 pb-8 pt-[34px]">
          <p className="m-0 text-[11px] leading-relaxed text-[#525252]">
            Please remit payment in USD to the appropriate account below. Quote the invoice reference on all
            transfers.
          </p>
          <div className="mt-5 flex flex-col gap-4">
            <BankBlock account={CPS_BANK_ACCOUNTS[0]!} />
            <BankBlock account={CPS_BANK_ACCOUNTS[1]!} />
          </div>
          <div className="flex-1" />
          <PageFooter
            left="Use the Kenya or Tanzania account matching the invoicing entity for this booking"
            right={`${startPage} / ${totalPages}`}
          />
        </div>
      </section>

      <section
        {...{ [pageAttr]: startPage + 1 }}
        className={pageClass}
        style={{ width: PAGE_W, minHeight: PAGE_H }}
      >
        <Header title="Bank remittance & office details" refLabel={refLabel} />
        <div className="flex flex-1 flex-col px-14 pb-8 pt-[34px]">
          <BankBlock account={CPS_BANK_ACCOUNTS[2]!} />

          <div className="mt-7">
            <SectionLabel>Office details</SectionLabel>
            <div className="mt-3 grid grid-cols-3 gap-4">
              {CPS_OFFICES.map((office) => (
                <OfficeBlock key={office.country} office={office} />
              ))}
            </div>
          </div>

          <div className="flex-1" />
          <PageFooter left="Cheli & Peacock Safaris — Kenya · Tanzania · Rwanda" right={`${startPage + 1} / ${totalPages}`} />
        </div>
      </section>
    </>
  )
}

function BankBlock({ account }: { account: CpsBankAccount }) {
  return (
    <div className="border border-[#101010] px-4 py-3.5">
      <div className="text-[9px] font-semibold uppercase tracking-[1.2px] text-[#931115]">{account.country}</div>
      <div className="mt-2 text-[11px] font-semibold text-[#171717]">{account.accountName}</div>
      <div className="mt-1.5 space-y-0.5 text-[10.5px] leading-snug text-[#525252]">
        {account.bankLines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
      <dl className="mt-3 grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[10.5px]">
        <DetailRow label="Account number" value={account.accountNumber} mono />
        <DetailRow label="Swift code" value={account.swiftCode} mono />
        {account.correspondentName ? (
          <DetailRow label="Correspondent bank" value={account.correspondentName} />
        ) : null}
        {account.correspondentAccount ? (
          <DetailRow label="Correspondent account" value={account.correspondentAccount} mono />
        ) : null}
        {account.correspondentSwift ? (
          <DetailRow label="Correspondent SWIFT" value={account.correspondentSwift} mono />
        ) : null}
        {account.taxLines?.map((line) => (
          <DetailRow key={line} label="Tax / registration" value={line} />
        ))}
      </dl>
    </div>
  )
}

function OfficeBlock({ office }: { office: CpsOffice }) {
  return (
    <div className="border border-[#E4E4E4] px-3.5 py-3">
      <div className="text-[9px] font-semibold uppercase tracking-[1.2px] text-[#931115]">{office.country}</div>
      <div className="mt-2 space-y-0.5 text-[10.5px] leading-snug text-[#525252]">
        {office.addressLines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
      <div className="mt-2 text-[10.5px] text-[#525252]">
        <span className="font-semibold text-[#737373]">Email:</span> {office.email}
      </div>
      {office.phones.map((phone) => (
        <div key={phone} className="mt-1 text-[10.5px] text-[#525252]">
          <span className="font-semibold text-[#737373]">Phone:</span> {phone}
        </div>
      ))}
    </div>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-[#8A8A8A]">{label}</dt>
      <dd className={['font-medium text-[#171717]', mono ? "font-['IBM_Plex_Mono']" : ''].filter(Boolean).join(' ')}>
        {value}
      </dd>
    </>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] font-semibold uppercase tracking-[1.2px] text-[#931115]">{children}</div>
  )
}

function PageFooter({ left, right }: { left: string; right: string }) {
  return (
    <div className="mt-auto flex items-end justify-between border-t border-[#EFEFEF] pt-3 text-[9px] text-[#8A8A8A]">
      <span className="max-w-[70%] leading-relaxed">{left}</span>
      <span className="font-['IBM_Plex_Mono']">{right}</span>
    </div>
  )
}

export function RemittanceLedgerHeader({ title, refLabel }: RemittanceHeaderProps) {
  return (
    <div className="flex h-[42px] shrink-0 items-center justify-between px-14" style={{ background: MAROON }}>
      <span className="text-[9.5px] font-semibold uppercase tracking-[2px] text-[#E9CFCF]">{title}</span>
      <span className="font-['IBM_Plex_Mono'] text-[11px] text-[#DFB9B9]">{refLabel}</span>
    </div>
  )
}
