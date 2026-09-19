import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useStore } from '@/app/store'
import { Button } from '@/components/ui/button'
import { VoucherRecipientBody } from '@/features/summary/VoucherRecipientBody'
import { buildVouchers, linesFromServices, linesFromQuoteGroups } from '@/features/summary/summaryModel'
import { evaluateVoucherToken, type VoucherLineInput } from '@/shared/lib/lifecycleRules'
import { partyGuests } from '@/shared/lib/helpers'

export function VoucherLinkPage() {
  const { id = '', supplier: entityParam = '' } = useParams()
  const [search] = useSearchParams()
  const token = search.get('t')
  const entityId = decodeURIComponent(entityParam)
  const { itineraries, getServices, getQuoteGroups, getGuestDetails, submitVoucherAnswers, requestLatestVoucher } =
    useStore()
  const itinerary = itineraries.find((it) => it.id === id)
  const [submitted, setSubmitted] = useState(false)
  const [submitNotice, setSubmitNotice] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notified, setNotified] = useState(false)

  const services = getServices(id)
  const quoteGroups = getQuoteGroups(id)
  const guestDetails = useMemo(() => getGuestDetails(id), [getGuestDetails, id])
  const guests = useMemo(() => (itinerary ? partyGuests(itinerary, guestDetails) : []), [itinerary, guestDetails])
  const lines = useMemo(() => {
    if (services.length > 0) return linesFromServices(services, guests)
    if (quoteGroups.length > 0) return linesFromQuoteGroups(quoteGroups)
    return []
  }, [services, quoteGroups, guests])

  const cards = useMemo(
    () =>
      itinerary
        ? buildVouchers(
            lines,
            'cost',
            itinerary.reference || itinerary.id,
            services,
            guests,
            guestDetails,
            itinerary.agency || '',
            itinerary.supplierVouchers || {},
            itinerary.voucherLineAnswers || {},
            itinerary.voucherMeta || {},
          )
        : [],
    [itinerary, lines, services, guests, guestDetails],
  )
  const card = cards.find((c) => c.entityId === entityId)
  const meta = itinerary?.voucherMeta?.[entityId]
  const tokenState = evaluateVoucherToken(meta, token, new Date().toISOString())

  if (!itinerary || !card) {
    return <ShellMessage title="Link not found" body="This confirmation link doesn't match anything we recognise." />
  }

  if (submitted) {
    return <ShellMessage title="Thank you — your reply is recorded" body={submitNotice} />
  }

  if (tokenState.state === 'invalid') {
    return <ShellMessage title="Link not valid" body="This link can't be used. Contact your Cheli & Peacock planner for a fresh one." />
  }
  if (tokenState.state === 'expired') {
    return (
      <ShellMessage title="This link has expired" body="Confirmation links are valid for a limited time. Contact your planner and ask them to resend from the itinerary.">
        <p className="mt-3 text-[12.5px] text-[#737373]">Resend is initiated by your planner — not from this page.</p>
      </ShellMessage>
    )
  }
  if (tokenState.state === 'used') {
    return (
      <ShellMessage
        title="Already answered"
        body={`This voucher was already answered${meta?.submittedByEmail ? ` by ${meta.submittedByEmail}` : ''}${
          meta?.submittedAt ? ` on ${new Date(meta.submittedAt).toLocaleString()}` : ''
        }.`}
      />
    )
  }
  if (tokenState.state === 'superseded') {
    return (
      <ShellMessage title="This version has been replaced" body="Your planner has sent an updated confirmation request. This older version can no longer be actioned.">
        {notified ? (
          <p className="mt-3 text-[13px] font-semibold text-[#15803D]">Your planner has been notified — they will resend when ready.</p>
        ) : (
          <Button
            className="mt-3"
            onClick={() => {
              requestLatestVoucher(id, entityId, { token: token || undefined, recipientEmail: tokenState.recipientEmail })
              setNotified(true)
            }}
          >
            Request the latest version
          </Button>
        )}
      </ShellMessage>
    )
  }

  const lineInputs: VoucherLineInput[] = card.rows.map((r) => ({
    lineId: r.lineId,
    serviceId: r.serviceId,
    depositPaid: r.depositPaid,
    isExtra: r.isExtra,
    parentLineId: r.parentLineId,
  }))

  if (card.kind === 'cancellation_only') {
    return (
      <div className="min-h-screen bg-[#F6F6F7] px-4 py-8">
        <div className="mx-auto max-w-[760px] rounded-2xl border border-[#E5E7EB] bg-white p-7 shadow-sm">
          <h1 className="text-lg font-bold text-[#171717]">Cancellation notice — {card.supplier}</h1>
          <p className="mt-2 text-[13.5px] text-[#525252]">
            Please acknowledge that you have received this cancellation for {card.ref}.
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              const result = submitVoucherAnswers(id, entityId, {
                lines: lineInputs,
                ticks: {},
                reasons: {},
                via: 'acknowledge',
                token: token || undefined,
                userAgent: navigator.userAgent,
              })
              if (!result.ok) {
                setError(result.reason)
                return
              }
              setSubmitNotice('Cancellation acknowledged — your planner has been notified.')
              setSubmitted(true)
            }}
          >
            Acknowledge cancellation
          </Button>
          {error ? <p className="mt-3 text-[13px] font-semibold text-[#B91C1C]">{error}</p> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F6F6F7] px-4 py-8">
      <div className="mx-auto max-w-[760px] rounded-2xl border border-[#E5E7EB] bg-white p-7 shadow-sm">
        <VoucherRecipientBody
          card={card}
          bookingRef={itinerary.reference || itinerary.id}
          readOnly={false}
          submitLabel="Submit my reply"
          onSubmit={(ticks, reasons, courtesyName) => {
            const result = submitVoucherAnswers(id, entityId, {
              lines: lineInputs,
              ticks,
              reasons,
              via: 'link',
              token: token || undefined,
              courtesyName,
              userAgent: navigator.userAgent,
            })
            if (!result.ok) {
              setError(result.reason)
              return
            }
            const heldCount = lineInputs.filter((l) => ticks[l.lineId] !== false).length
            setSubmitNotice(
              heldCount === lineInputs.length
                ? 'Every line confirmed — every planner on this voucher has been notified.'
                : heldCount === 0
                  ? 'Every line rejected — your issuing planner has been notified, with the reasons you gave.'
                  : 'Some lines confirmed, some not — your issuing planner has been notified to resolve the rest.',
            )
            setSubmitted(true)
          }}
        />
        {error ? <p className="mt-3 text-[13px] font-semibold text-[#B91C1C]">{error}</p> : null}
      </div>
    </div>
  )
}

function ShellMessage({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F6F7] px-4">
      <div className="w-full max-w-[440px] rounded-2xl border border-[#E5E7EB] bg-white p-7 text-center shadow-sm">
        <h1 className="text-lg font-bold text-[#171717]">{title}</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[#525252]">{body}</p>
        {children}
        <Link to="/" className="mt-5 inline-block text-[12.5px] font-semibold text-[#931115]">
          Back to SOL
        </Link>
      </div>
    </div>
  )
}
