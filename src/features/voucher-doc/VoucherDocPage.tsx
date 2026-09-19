import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Printer } from 'lucide-react'
import { useStore } from '@/app/store'
import { Button } from '@/components/ui/button'
import { VoucherRecipientBody } from '@/features/summary/VoucherRecipientBody'
import { buildVouchers, linesFromServices, linesFromQuoteGroups } from '@/features/summary/summaryModel'
import { partyGuests } from '@/shared/lib/helpers'

/**
 * The filing-copy document (BR-27: "the PDF is a filing copy of the same facts"). This is the
 * separate download path (gap 2) — print-to-PDF via the browser rather than a bespoke canvas
 * PDF writer, so it reuses the exact same VoucherRecipientBody the email link renders and the
 * two documents can't drift apart. Read-only: no tick UI, no confirmation action here.
 */
export function VoucherDocPage() {
  const { id = '', supplier: entityParam = '' } = useParams()
  const entityId = decodeURIComponent(entityParam)
  const { itineraries, getServices, getQuoteGroups, getGuestDetails } = useStore()
  const itinerary = itineraries.find((it) => it.id === id)
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

  if (!itinerary || !card) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#F6F6F7] py-10">
        <p className="text-sm text-muted-foreground">Voucher not found.</p>
        <Button asChild variant="outline">
          <Link to={`/summary/${id}`}>Back to summary</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F6F6F7] pb-16">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#E7E7EA] bg-white px-6 py-3 print:hidden">
        <Button variant="outline" asChild>
          <Link to={`/summary/${id}`}>
            <ChevronLeft />
            Back to summary
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer />
          Print / Save as PDF
        </Button>
      </div>
      <div className="mx-auto mt-7 max-w-[820px] rounded-2xl border border-[#E5E7EB] bg-white p-8 shadow-sm print:mt-0 print:border-0 print:shadow-none">
        <VoucherRecipientBody card={card} bookingRef={itinerary.reference || itinerary.id} readOnly submitLabel={undefined} />
        <p className="mt-6 border-t border-dashed border-[#E5E7EB] pt-3 text-[11px] text-[#A1A1A1]">
          Filing copy — cost only, no sell, margin or promotions. Matches the confirmation request emailed to the
          supplier (BR-27).
        </p>
      </div>
    </div>
  )
}
