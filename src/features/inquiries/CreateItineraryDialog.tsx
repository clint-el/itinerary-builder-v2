import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AGENCIES, DESTINATIONS } from '@/shared/lib/catalogs'
import { nextInquiryId } from '@/shared/lib/storage'
import { cn } from '@/shared/lib/utils'
import { DateRangePickerInput } from '@/shared/ui/date-picker'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  seedTitle?: string
}

function Counter({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold text-neutral-400">{label}</div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-lg text-neutral-600"
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          −
        </button>
        <Input
          className="h-10 text-center"
          inputMode="numeric"
          value={String(value)}
          onChange={(e) => {
            const n = parseInt(e.target.value.replace(/\D/g, ''), 10)
            onChange(Number.isNaN(n) ? 0 : Math.max(0, n))
          }}
        />
        <button
          type="button"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-lg text-neutral-600"
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  )
}

export function CreateItineraryDialog({ open, onOpenChange, seedTitle = '' }: Props) {
  const { createItinerary, itineraries } = useStore()
  const navigate = useNavigate()

  const [inquiryRef, setInquiryRef] = useState('')
  const [agency, setAgency] = useState('')
  const [agent, setAgent] = useState('')
  const [agencyLabel, setAgencyLabel] = useState('')
  const [agencyOpen, setAgencyOpen] = useState(false)
  const [agencySearch, setAgencySearch] = useState('')
  const [expandedAgency, setExpandedAgency] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [leadFirst, setLeadFirst] = useState('')
  const [leadLast, setLeadLast] = useState('')
  const [destinations, setDestinations] = useState<string[]>([])
  const [destOpen, setDestOpen] = useState(false)

  const [travelDateFrom, setTravelDateFrom] = useState('')
  const [travelDateTo, setTravelDateTo] = useState('')

  const [adultsRes, setAdultsRes] = useState(2)
  const [adultsNonRes, setAdultsNonRes] = useState(0)
  const [childrenRes, setChildrenRes] = useState(0)
  const [childrenNonRes, setChildrenNonRes] = useState(0)
  const [infantsRes, setInfantsRes] = useState(0)
  const [infantsNonRes, setInfantsNonRes] = useState(0)
  const [childAges, setChildAges] = useState<number[]>([])

  const [errors, setErrors] = useState<string[]>([])

  const agencyBoxRef = useRef<HTMLDivElement>(null)
  const destBoxRef = useRef<HTMLDivElement>(null)

  const childrenTotal = childrenRes + childrenNonRes
  const adultsTotal = adultsRes + adultsNonRes
  const infantsTotal = infantsRes + infantsNonRes

  useEffect(() => {
    if (!open) return
    setInquiryRef(nextInquiryId())
    setAgency('')
    setAgent('')
    setAgencyLabel('')
    setAgencyOpen(false)
    setAgencySearch('')
    setExpandedAgency(null)
    setTitle(seedTitle || '')
    setLeadFirst('')
    setLeadLast('')
    setDestinations([])
    setDestOpen(false)
    setTravelDateFrom('')
    setTravelDateTo('')
    setAdultsRes(2)
    setAdultsNonRes(0)
    setChildrenRes(0)
    setChildrenNonRes(0)
    setInfantsRes(0)
    setInfantsNonRes(0)
    setChildAges([])
    setErrors([])
  }, [open, seedTitle])

  useEffect(() => {
    setChildAges((prev) => {
      if (childrenTotal === prev.length) return prev
      if (childrenTotal > prev.length) {
        return [...prev, ...Array.from({ length: childrenTotal - prev.length }, () => 8)]
      }
      return prev.slice(0, childrenTotal)
    })
  }, [childrenTotal])

  useEffect(() => {
    if (!agencyOpen && !destOpen) return
    function onPointerDown(e: MouseEvent) {
      const t = e.target as Node
      if (agencyOpen && agencyBoxRef.current && !agencyBoxRef.current.contains(t)) {
        setAgencyOpen(false)
      }
      if (destOpen && destBoxRef.current && !destBoxRef.current.contains(t)) {
        setDestOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setAgencyOpen(false)
        setDestOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [agencyOpen, destOpen])

  const filteredAgencies = useMemo(() => {
    const q = agencySearch.trim().toLowerCase()
    if (!q) return [...AGENCIES]
    return AGENCIES.filter((a) => {
      const hay = [a.name, a.loc, a.code, ...a.agents.map((ag) => ag.name)].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [agencySearch])

  function pickAgency(name: string) {
    setAgency(name)
    setAgent('')
    setAgencyLabel(name)
    setAgencyOpen(false)
    setExpandedAgency(null)
  }

  function pickAgent(agencyName: string, agentName: string) {
    setAgency(agencyName)
    setAgent(agentName)
    setAgencyLabel(`${agentName} · ${agencyName}`)
    setAgencyOpen(false)
    setExpandedAgency(null)
  }

  function toggleDestination(d: string) {
    setDestinations((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))
  }

  function validate(): string[] {
    const msgs: string[] = []
    const ref = inquiryRef.trim()
    if (!ref) msgs.push('Inquiry reference is required.')
    else if (itineraries.some((it) => it.reference === ref || it.id === ref)) {
      msgs.push('Inquiry reference already exists. Choose a unique CPS id.')
    }
    if (!agency.trim()) msgs.push('Agency is required.')
    if (!leadFirst.trim()) msgs.push('Lead traveler first name is required.')
    if (!leadLast.trim()) msgs.push('Lead traveler last name is required.')
    if (!travelDateFrom) msgs.push('Travel start date is required.')
    if (travelDateFrom && travelDateTo && travelDateTo < travelDateFrom) {
      msgs.push('End date must be on or after start date.')
    }
    if (adultsTotal < 1) msgs.push('At least one adult is required.')
    if (destinations.length < 1) msgs.push('Select at least one destination.')
    if (childrenTotal > 0 && childAges.some((a) => a < 2 || a > 17)) {
      msgs.push('Child ages must be between 2 and 17.')
    }
    return msgs
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const msgs = validate()
    if (msgs.length) {
      setErrors(msgs)
      return
    }
    const created = createItinerary({
      inquiryRef: inquiryRef.trim() || undefined,
      title: title.trim() || 'Untitled Itinerary',
      agency,
      agent,
      leadFirst: leadFirst.trim(),
      leadLast: leadLast.trim(),
      destinations,
      travelDateFrom,
      travelDateTo: travelDateTo || travelDateFrom,
      adultsRes,
      adultsNonRes,
      childrenRes,
      childrenNonRes,
      infantsRes,
      infantsNonRes,
      childAges: childAges.slice(0, childrenTotal),
    })
    onOpenChange(false)
    navigate(`/build/${created.id}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-48px)] w-full max-w-[560px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-1 border-b px-6 pb-4 pt-6 pr-12">
          <DialogTitle>Create Itinerary</DialogTitle>
          <DialogDescription>Create a new itinerary</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="grid gap-2">
              <Label htmlFor="inquiryRef">
                Inquiry ( CRM ticket reference ) <span className="text-sol-brand">*</span>
              </Label>
              <Input
                id="inquiryRef"
                value={inquiryRef}
                onChange={(e) => setInquiryRef(e.target.value)}
                placeholder="e.g. HS-563528"
              />
              <p className="text-xs font-medium text-neutral-400">
                Sourced from the CRM ticket. This becomes the inquiry reference; options inherit it
                (e.g. HS-563528-2).
              </p>
            </div>

            <div className="grid gap-2">
              <Label>
                Agency <span className="text-sol-brand">*</span>
              </Label>
              <div className="relative" ref={agencyBoxRef}>
                <button
                  type="button"
                  className="flex h-11 w-full items-center justify-between rounded-md border border-input bg-white px-3 text-left text-sm"
                  onClick={() => {
                    setDestOpen(false)
                    setAgencyOpen((v) => !v)
                  }}
                >
                  <span className={agencyLabel ? 'text-foreground' : 'text-muted-foreground'}>
                    {agencyLabel || 'Select Agency or Agent'}
                  </span>
                  <ChevronDown className="size-4 text-muted-foreground" />
                </button>
                {agencyOpen ? (
                  <div className="absolute left-0 right-0 z-30 mt-1.5 max-h-60 overflow-hidden rounded-md border bg-white shadow-md">
                    <div className="border-b p-2">
                      <Input
                        autoFocus
                        value={agencySearch}
                        onChange={(e) => setAgencySearch(e.target.value)}
                        placeholder="Search agencies or agents…"
                        className="h-8"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {filteredAgencies.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-muted-foreground">No matches.</div>
                      ) : (
                        filteredAgencies.map((a) => {
                          const expanded = expandedAgency === a.name
                          return (
                            <div key={a.name}>
                              <div
                                className={cn(
                                  'flex items-center justify-between gap-2 border-b border-neutral-100 px-3 py-2',
                                  expanded && 'bg-neutral-50',
                                )}
                              >
                                <button
                                  type="button"
                                  className="min-w-0 flex-1 truncate text-left text-sm font-semibold"
                                  onClick={() => pickAgency(a.name)}
                                >
                                  {a.name}
                                </button>
                                {a.agents.length > 0 ? (
                                  <button
                                    type="button"
                                    className="flex size-6 items-center justify-center rounded"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setExpandedAgency(expanded ? null : a.name)
                                    }}
                                  >
                                    <ChevronDown
                                      className={cn(
                                        'size-3.5 text-muted-foreground transition-transform',
                                        expanded && 'rotate-180',
                                      )}
                                    />
                                  </button>
                                ) : null}
                              </div>
                              {expanded
                                ? a.agents.map((ag) => (
                                    <button
                                      key={ag.name}
                                      type="button"
                                      className="flex w-full items-center gap-2 bg-neutral-50 px-3 py-2 pl-5 text-left text-[13.5px] font-semibold hover:bg-neutral-100"
                                      onClick={() => pickAgent(a.name, ag.name)}
                                    >
                                      {ag.name}
                                      <span className="text-xs font-medium text-muted-foreground">· {a.name}</span>
                                    </button>
                                  ))
                                : null}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="border-t border-dashed" />

            <div className="grid gap-2">
              <Label htmlFor="title">Itinerary Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Type here"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="leadFirst">
                  Lead Traveler First Name <span className="text-sol-brand">*</span>
                </Label>
                <Input
                  id="leadFirst"
                  value={leadFirst}
                  onChange={(e) => setLeadFirst(e.target.value)}
                  placeholder="Type here"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="leadLast">
                  Lead Traveler Last Name <span className="text-sol-brand">*</span>
                </Label>
                <Input
                  id="leadLast"
                  value={leadLast}
                  onChange={(e) => setLeadLast(e.target.value)}
                  placeholder="Type here"
                />
              </div>
            </div>

            <div className="border-t border-dashed" />

            <div className="grid gap-2">
              <Label>
                Travel Dates <span className="text-sol-brand">*</span>
              </Label>
              <DateRangePickerInput
                from={travelDateFrom}
                to={travelDateTo}
                onChange={(from, to) => {
                  setTravelDateFrom(from)
                  setTravelDateTo(to)
                }}
                hasError={errors.some((message) => message.includes('date'))}
                className="h-10 bg-white"
              />
            </div>

            <div className="grid gap-2">
              <Label>
                Destinations <span className="text-sol-brand">*</span>
              </Label>
              <div className="relative" ref={destBoxRef}>
                <button
                  type="button"
                  className="flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-white px-2 py-1.5 text-left text-sm"
                  onClick={() => {
                    setAgencyOpen(false)
                    setDestOpen((v) => !v)
                  }}
                >
                  {destinations.length === 0 ? (
                    <span className="px-1 text-muted-foreground">Select destinations</span>
                  ) : (
                    destinations.map((d) => (
                      <span
                        key={d}
                        className="inline-flex items-center gap-1 rounded-md bg-[#F4E2E3] px-2 py-0.5 text-xs font-semibold text-sol-brand"
                      >
                        {d}
                        <span
                          role="button"
                          tabIndex={0}
                          className="inline-flex"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleDestination(d)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              e.stopPropagation()
                              toggleDestination(d)
                            }
                          }}
                        >
                          <X className="size-3" />
                        </span>
                      </span>
                    ))
                  )}
                  <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
                </button>
                {destOpen ? (
                  <div className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-md border bg-white shadow-md">
                    {DESTINATIONS.map((d) => {
                      const selected = destinations.includes(d)
                      return (
                        <button
                          key={d}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-50"
                          onClick={() => toggleDestination(d)}
                        >
                          <span
                            className={cn(
                              'flex size-4 items-center justify-center rounded border',
                              selected ? 'border-sol-brand bg-sol-brand text-white' : 'border-neutral-300 bg-white',
                            )}
                          >
                            {selected ? '✓' : null}
                          </span>
                          {d}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="rounded-lg border p-3.5">
                <div className="mb-3 flex items-baseline justify-between">
                  <Label>
                    Adults (18+ y.o.) <span className="text-sol-brand">*</span>
                  </Label>
                  <span className="text-[12.5px] font-semibold text-neutral-500">Total: {adultsTotal}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Counter label="Resident" value={adultsRes} onChange={setAdultsRes} />
                  <Counter label="Non-Resident" value={adultsNonRes} onChange={setAdultsNonRes} />
                </div>
              </div>

              <div className="rounded-lg border p-3.5">
                <div className="mb-3 flex items-baseline justify-between">
                  <Label>Children (2-17 y.o.)</Label>
                  <span className="text-[12.5px] font-semibold text-neutral-500">Total: {childrenTotal}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Counter label="Resident" value={childrenRes} onChange={setChildrenRes} />
                  <Counter label="Non-Resident" value={childrenNonRes} onChange={setChildrenNonRes} />
                </div>
              </div>

              <div className="rounded-lg border p-3.5">
                <div className="mb-3 flex items-baseline justify-between">
                  <Label>Infants (0-1 y.o.)</Label>
                  <span className="text-[12.5px] font-semibold text-neutral-500">Total: {infantsTotal}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Counter label="Resident" value={infantsRes} onChange={setInfantsRes} />
                  <Counter label="Non-Resident" value={infantsNonRes} onChange={setInfantsNonRes} />
                </div>
              </div>
            </div>

            {childrenTotal > 0 ? (
              <div>
                <Label className="mb-1.5 block">Children Age</Label>
                <div className="grid grid-cols-3 gap-4">
                  {childAges.map((age, i) => (
                    <div key={i}>
                      <div className="mb-1.5 text-xs font-semibold text-neutral-400">Child {i + 1}</div>
                      <Select
                        value={String(age)}
                        onValueChange={(value) => {
                          const next = [...childAges]
                          next[i] = Number(value)
                          setChildAges(next)
                        }}
                      >
                        <SelectTrigger className="h-10 bg-white">
                          <SelectValue placeholder="Select age" />
                        </SelectTrigger>
                        <SelectContent>
                        {Array.from({ length: 16 }, (_, i) => i + 2).map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}
                          </SelectItem>
                        ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {errors.length > 0 ? (
              <div className="space-y-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                {errors.map((msg) => (
                  <p key={msg} className="text-sm font-medium text-destructive">
                    {msg}
                  </p>
                ))}
              </div>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Itinerary</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
