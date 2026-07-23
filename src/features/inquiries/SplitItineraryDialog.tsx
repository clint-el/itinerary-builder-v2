import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/app/store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { nextChildReference } from '@/shared/lib/helpers'
import type { SplitForm } from '@/shared/lib/types'

interface Props {
  open: boolean
  parentRef: string | null
  onOpenChange: (open: boolean) => void
  onConfirm: (parentRef: string, form: SplitForm) => void
}

export function SplitItineraryDialog({ open, parentRef, onOpenChange, onConfirm }: Props) {
  const { itineraries } = useStore()
  const parent = useMemo(
    () => (parentRef ? itineraries.find((it) => it.reference === parentRef) : undefined),
    [itineraries, parentRef],
  )

  const [family, setFamily] = useState('')
  const [ad, setAd] = useState('2')
  const [ch, setCh] = useState('0')

  useEffect(() => {
    if (!open || !parent) return
    const title = parent.title || 'Untitled Itinerary'
    setFamily(title ? `Copy ${title}` : '')
    setAd(String(parent.paxAdults ?? parent.adults ?? 2))
    setCh(String(parent.paxChildren ?? parent.children ?? 0))
  }, [open, parent])

  const newId = parentRef ? nextChildReference(parentRef, itineraries) : ''
  const masterId = parentRef || ''

  function handleConfirm() {
    if (!parentRef) return
    onConfirm(parentRef, { family, ad, ch })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[460px] gap-0 p-0">
        <DialogHeader className="space-y-1 border-b border-[#EEF0F2] px-[22px] py-[18px]">
          <DialogTitle className="text-[17px] font-bold text-[#171717]">Split into new itinerary</DialogTitle>
          <DialogDescription className="text-[13px] font-medium text-[#A1A1A1]">
            New itinerary <span className="font-bold text-[#931115]">{newId}</span> from{' '}
            <span className="font-bold text-[#171717]">{masterId}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-[22px] py-5">
          <div className="grid gap-1.5">
            <Label htmlFor="split-family" className="text-[13px] font-semibold text-[#171717]">
              Itinerary title<span className="text-[#931115]">*</span>
            </Label>
            <Input
              id="split-family"
              value={family}
              onChange={(e) => setFamily(e.target.value)}
              placeholder="e.g. Copy Whitfield Family"
              className="h-10"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="split-ad" className="text-[13px] font-semibold text-[#171717]">
                Adults
              </Label>
              <Input
                id="split-ad"
                inputMode="numeric"
                value={ad}
                onChange={(e) => setAd(e.target.value)}
                placeholder="0"
                className="h-10"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="split-ch" className="text-[13px] font-semibold text-[#171717]">
                Children
              </Label>
              <Input
                id="split-ch"
                inputMode="numeric"
                value={ch}
                onChange={(e) => setCh(e.target.value)}
                placeholder="0"
                className="h-10"
              />
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-[#EEF0F2] bg-[#F9FAFB] px-3 py-2.5">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0369A1"
              strokeWidth="2"
              className="mt-0.5 shrink-0"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <span className="text-xs font-medium leading-relaxed text-[#525252]">
              Title, guests, dates and services are copied from {masterId} and pre-filled here — edit them now or
              later on the new itinerary&apos;s services table.
            </span>
          </div>
        </div>

        <DialogFooter className="border-t border-[#EEF0F2] px-[22px] py-3.5 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-[#931115] text-white hover:bg-[#7a0e11]"
            onClick={handleConfirm}
            disabled={!parentRef || !family.trim()}
          >
            Create & edit services
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
