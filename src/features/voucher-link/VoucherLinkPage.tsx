import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '@/app/store'
import { Button } from '@/components/ui/button'
import { VoucherRecipientBody } from '@/features/summary/VoucherRecipientBody'
import { buildVouchers, linesFromServices, linesFromQuoteGroups } from '@/features/summary/summaryModel'
import type { VoucherLineInput } from '@/shared/lib/lifecycleRules'
import { partyGuests } from '@/shared/lib/helpers'
import { fetchVoucherSessionRemote } from '@/shared/lib/voucherSessionRemote'

/**
 * Prototype supplier confirmation — open page per itinerary + supplier entity.
 * No token gate (production would use signed links / auth).
 */
export function VoucherLinkPage() {
  const { id = '', supplier: entityParam = '' } = useParams()
  const entityId = decodeURIComponent(entityParam.replace(/\/$/, ''))
  const {
    itineraries,
    getServices,
    getQuoteGroups,
    getGuestDetails,
    submitVoucherAnswers,
    upsertItinerary,
  } = useStore()
  const itinerary = itineraries.find((it) => it.id === id)
  const [submitted, setSubmitted] = useState(false)
  const [submitNotice, setSubmitNotice] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(false)

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
  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      const current = itineraries.find((it) => it.id === id)
      if (!current) {
        setSessionReady(true)
        return
      }
      if (current.voucherMeta?.[entityId]?.issued) {
        setSessionReady(true)
        return
      }
      const remoteMeta = await fetchVoucherSessionRemote(id, entityId)
      if (cancelled) return
      if (remoteMeta) {
        upsertItinerary({
          ...current,
          voucherMeta: { ...(current.voucherMeta || {}), [entityId]: remoteMeta },
          updatedAt: new Date().toISOString(),
        })
      }
      setSessionReady(true)
    }
    setSessionReady(false)
    void hydrate()
    return () => {
      cancelled = true
    }
  }, [id, entityId, itineraries, upsertItinerary])

  if (!sessionReady) {
    return <ShellMessage title="Loading confirmation…" body="Fetching the latest voucher details." />
  }

  if (!itinerary || !card) {
    return <ShellMessage title="Link not found" body="This confirmation link doesn't match anything we recognise." />
  }

  if (submitted) {
    return <ShellMessage title="Thank you — your reply is recorded" body={submitNotice} />
  }

  const resolvedMeta = itinerary.voucherMeta?.[entityId]
  if (!resolvedMeta?.issued) {
    return (
      <ShellMessage
        title="Not ready yet"
        body="Your planner hasn't sent this confirmation request yet. Ask them to issue the voucher from the itinerary Summary."
      />
    )
  }

  if (resolvedMeta.submittedAt) {
    return (
      <ShellMessage
        title="Already answered"
        body={`This voucher was already answered${resolvedMeta.submittedByEmail ? ` by ${resolvedMeta.submittedByEmail}` : ''}${
          resolvedMeta.submittedAt ? ` on ${new Date(resolvedMeta.submittedAt).toLocaleString()}` : ''
        }.`}
      />
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
          courtesyNameField
          onSubmit={(ticks, reasons, courtesyName) => {
            const result = submitVoucherAnswers(id, entityId, {
              lines: lineInputs,
              ticks,
              reasons,
              via: 'link',
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
