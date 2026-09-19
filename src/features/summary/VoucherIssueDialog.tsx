import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { VoucherCard } from './summaryModel'

export function VoucherIssueDialog({
  open,
  card,
  step,
  onClose,
  onContinue,
  onSend,
  onOpenPreview,
  onOpenGuests,
  noteDraft,
}: {
  open: boolean
  card: VoucherCard | null
  step: 'review' | 'send'
  onClose: () => void
  onContinue: () => void
  onSend: (recipientEmails: string[], note: string, supplierBookingRef: string) => void
  onOpenPreview: () => void
  onOpenGuests: () => void
  noteDraft?: string
}) {
  const [emails, setEmails] = useState('')
  const [note, setNote] = useState('')
  const [bookingRef, setBookingRef] = useState('')

  useEffect(() => {
    if (card) {
      setEmails((card.issuedTo.length ? card.issuedTo : [card.supplierEmail]).join(', '))
      setNote(noteDraft ?? card.note ?? '')
      setBookingRef('')
    }
  }, [card, noteDraft])

  if (!card) return null
  const isReissue = card.issued

  if (step === 'review') {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Review before sending — {card.supplier}</DialogTitle>
            <DialogDescription>
              Step 1 of 2 — confirm guest requirements and preview the supplier copy before issuing.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between rounded-lg border border-[#E5E7EB] bg-[#FAFAFB] px-3 py-2.5">
              <span className="text-[12.5px] text-[#525252]">Guest requirements coverage</span>
              <span className="text-[12.5px] font-semibold text-[#171717]">{card.guestCoverageLabel}</span>
            </div>
            <p className="text-[12.5px] text-[#525252]">{card.dietLine}</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onOpenGuests}>
                Open guest roster
              </Button>
              <Button type="button" variant="outline" onClick={onOpenPreview}>
                Preview supplier copy
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onContinue}>Continue to send →</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{isReissue ? 'Re-issue' : 'Issue'} confirmation request — {card.supplier}</DialogTitle>
          <DialogDescription>
            Step 2 of 2 — email is the voucher. PDF filing copy available separately for Finance.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-[#171717]">Supplier reservations email(s)</span>
            <input
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="reservations@supplier.com, cc@supplier.com"
              className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#171717] outline-none"
            />
            <span className="text-[11px] text-[#A1A1A1]">Comma-separated — one token per recipient (PR-F22).</span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-[#171717]">Supplier booking reference (optional)</span>
            <input
              value={bookingRef}
              onChange={(e) => setBookingRef(e.target.value)}
              className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#171717] outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-[#171717]">Note for this supplier (optional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Printed on the request, below the service lines"
              className="min-h-[70px] resize-y rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#171717] outline-none"
            />
          </label>

          {card.changedSinceIssued ? (
            <p className="text-[12px] font-semibold text-[#B45309]">
              Itinerary changed since last issue — this send carries the current facts.
            </p>
          ) : null}

          <p className="text-[11px] text-[#A1A1A1]">
            From {`vouchers@chelipeacock.com`} · CC issuing planner · Reply-To issuing planner
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSend(
                emails.split(/[,;]/).map((e) => e.trim()).filter(Boolean),
                note.trim(),
                bookingRef.trim(),
              )
            }
            disabled={!emails.trim()}
          >
            {isReissue ? 'Re-issue and send' : 'Send confirmation request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
