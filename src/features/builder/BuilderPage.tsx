import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight,
  BedDouble,
  Car,
  ChevronRight,
  CreditCard,
  Lock,
  Plane,
  Plus,
  Sparkles,
} from 'lucide-react'
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
import { Separator } from '@/components/ui/separator'
import { PROMOTIONS, TAB_META, defaultDraft } from '@/shared/lib/catalogs'
import { partyGuests } from '@/shared/lib/helpers'
import type { AddedService, ServiceTab } from '@/shared/lib/types'
import { cn } from '@/shared/lib/utils'
import { StatusChip } from '@/shared/ui/StatusChip'
import { AccommodationPanel } from './AccommodationPanel'
import { ActivityOtherPanel } from './ActivityOtherPanel'
import { FlightPanel } from './FlightPanel'
import { PricingSection } from './PricingSection'
import { RightPane } from './RightPane'
import { TransportationPanel } from './TransportationPanel'
import {
  RAIL,
  asRooms,
  buildAddedService,
  roomPriceBreakdown,
  type AuditEntry,
  type PricingRow,
} from './builderUtils'

const RAIL_ICONS = {
  accommodation: BedDouble,
  transportation: Car,
  flight: Plane,
  activity: Sparkles,
  other: Plus,
} as const

function emptyDrafts(): Record<ServiceTab, Record<string, unknown>> {
  return {
    accommodation: defaultDraft('accommodation'),
    transportation: defaultDraft('transportation'),
    flight: defaultDraft('flight'),
    activity: defaultDraft('activity'),
    other: defaultDraft('other'),
  }
}

export function BuilderPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { itineraries, getServices, saveServices, updateStatus, getGuestDetails } = useStore()
  const itinerary = itineraries.find((it) => it.id === id)

  const guests = useMemo(
    () => (itinerary ? partyGuests(itinerary, getGuestDetails(id)) : []),
    [itinerary, id, getGuestDetails],
  )

  const [activeTab, setActiveTab] = useState<ServiceTab>('accommodation')
  const [drafts, setDrafts] = useState(emptyDrafts)
  const [services, setServices] = useState<AddedService[]>([])
  const [seq, setSeq] = useState(1)
  const [rightPaneWidth, setRightPaneWidth] = useState(340)

  const [pricingOverride, setPricingOverride] = useState(false)
  const [overrideModalOpen, setOverrideModalOpen] = useState(false)
  const [overrideReasonDraft, setOverrideReasonDraft] = useState('')
  const [priceAuditLog, setPriceAuditLog] = useState<AuditEntry[]>([])
  const [pricingRows, setPricingRows] = useState<PricingRow[]>([
    { id: 'adult', type: 'Adult', charge: 'PPPN', net: 300, rack: 390 },
    { id: 'unit', type: 'Unit', charge: 'PUPS', net: 150, rack: 195 },
  ])
  const [promoPromptOpen, setPromoPromptOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    const loaded = getServices(id)
    setServices(loaded)
    const maxSeq = loaded.reduce((max, s) => {
      const n = Number(String(s.id).replace(/\D/g, ''))
      return Number.isFinite(n) ? Math.max(max, n) : max
    }, 0)
    setSeq(maxSeq + 1)
  }, [id, getServices])

  const draft = drafts[activeTab]
  const tabMeta = TAB_META[activeTab]

  function patchDraft(patch: Record<string, unknown>) {
    setDrafts((prev) => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], ...patch },
    }))
  }

  function persist(next: AddedService[]) {
    if (id) saveServices(id, next)
  }

  function doAdd() {
    const card = buildAddedService(
      activeTab,
      { ...draft, priceOverride: pricingOverride },
      seq,
      pricingOverride ? pricingRows : undefined,
      guests,
    )
    const next = [...services, card]
    setServices(next)
    setSeq((s) => s + 1)
    setDrafts((prev) => ({ ...prev, [activeTab]: defaultDraft(activeTab) }))
    setPricingOverride(false)
    persist(next)
  }

  function addToItinerary() {
    if (
      activeTab === 'accommodation' &&
      PROMOTIONS.find((p) => p.id === draft.promotion && p.active)
    ) {
      setPromoPromptOpen(true)
      return
    }
    doAdd()
  }

  function editService(service: AddedService) {
    setActiveTab(service.tab)
    setDrafts((prev) => ({
      ...prev,
      [service.tab]: structuredClone(service.draft || defaultDraft(service.tab)),
    }))
    const next = services.filter((s) => s.id !== service.id)
    setServices(next)
    persist(next)
  }

  function completeReview() {
    if (!id) return
    saveServices(id, services)
    if (itinerary?.status === 'DRAFT') updateStatus(id, 'PREPARED')
    navigate(`/summary/${id}`)
  }

  function startPaneResize(e: React.MouseEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startW = rightPaneWidth
    const move = (ev: globalThis.MouseEvent) => {
      const w = Math.min(760, Math.max(280, startW + (startX - ev.clientX)))
      setRightPaneWidth(w)
    }
    const up = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  if (!itinerary) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">Itinerary not found.</p>
        <Button asChild variant="outline">
          <Link to="/">Back to inquiries</Link>
        </Button>
      </div>
    )
  }

  const promo = PROMOTIONS.find((p) => p.id === draft.promotion)

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#F9FAFB]">
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-white px-5">
        <div className="flex min-w-0 items-center gap-2 text-[13px] font-semibold">
          <Link to="/" className="text-[#931115] hover:underline">
            Itineraries
          </Link>
          <ChevronRight className="size-3.5 text-neutral-300" />
          <span className="font-medium text-[#A1A1A1]">{itinerary.reference}</span>
          <ChevronRight className="size-3.5 text-neutral-300" />
          <span>Add services</span>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <StatusChip status={itinerary.status} />
          {itinerary.creditTerms ? (
            <span className="inline-flex h-6 items-center gap-1.5 rounded-[7px] bg-[#EEF2FF] px-2.5 text-[11.5px] font-semibold whitespace-nowrap text-[#4338CA]">
              <CreditCard className="size-3" />
              Credit terms
            </span>
          ) : null}
          {itinerary.financeLocked ? (
            <span className="inline-flex h-6 items-center gap-1.5 rounded-[7px] bg-[#F1F5F9] px-2.5 text-[11.5px] font-semibold whitespace-nowrap text-[#475569]">
              <Lock className="size-3" />
              Finance locked
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="outline" onClick={() => navigate('/')}>
            Cancel
          </Button>
          <Button className="bg-[#931115] hover:bg-[#7a0e12]" onClick={completeReview}>
            Complete & Review
            <ArrowRight />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex w-24 shrink-0 flex-col gap-1.5 border-r bg-white p-3">
          {RAIL.map((item) => {
            const Icon = RAIL_ICONS[item.tab]
            const active = activeTab === item.tab
            const meta = TAB_META[item.tab]
            return (
              <button
                key={item.tab}
                type="button"
                onClick={() => setActiveTab(item.tab)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-[10px] px-1 py-2.5 text-[11px] font-semibold',
                  active ? '' : 'text-[#525252]',
                )}
                style={
                  active
                    ? { background: meta.bg, color: meta.fg }
                    : undefined
                }
              >
                <span
                  className="flex size-[30px] items-center justify-center rounded-lg"
                  style={{ background: active ? '#FFFFFF' : item.iconBg }}
                >
                  <Icon className="size-4" style={{ color: item.color }} />
                </span>
                {item.label}
              </button>
            )
          })}
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <span
                className="flex size-8 items-center justify-center rounded-[9px] text-[13px] font-bold"
                style={{ background: tabMeta.bg, color: tabMeta.fg }}
              >
                {tabMeta.initial}
              </span>
              <h2 className="text-[17px] font-bold">{tabMeta.label} configuration</h2>
            </div>

            {activeTab === 'accommodation' ? (
              <AccommodationPanel draft={draft} patch={patchDraft} guests={guests} />
            ) : null}
            {activeTab === 'transportation' ? (
              <TransportationPanel draft={draft} patch={patchDraft} guests={guests} />
            ) : null}
            {activeTab === 'flight' ? <FlightPanel draft={draft} patch={patchDraft} /> : null}
            {activeTab === 'activity' || activeTab === 'other' ? (
              <ActivityOtherPanel tab={activeTab} draft={draft} patch={patchDraft} guests={guests} />
            ) : null}

            <div className="mt-4">
              <PricingSection
                tab={activeTab}
                draft={draft}
                patch={patchDraft}
                pricingRows={pricingRows}
                setPricingRows={setPricingRows}
                guests={guests}
                overrideOn={pricingOverride}
                onToggleOverride={() => {
                  if (pricingOverride) {
                    setPricingOverride(false)
                    patchDraft({ priceOverride: false })
                  } else {
                    // Seed editable rows from current accommodation breakdown when possible.
                    if (activeTab === 'accommodation') {
                      const rooms = asRooms(draft)
                      const byLabel = new Map<string, { net: number; rack: number }>()
                      for (const room of rooms) {
                        const br = roomPriceBreakdown(
                          room,
                          String(draft.start || ''),
                          String(draft.end || ''),
                          guests,
                        )
                        for (const pr of br.priceRows) {
                          const cur = byLabel.get(pr.label) || { net: 0, rack: 0 }
                          cur.net += pr.net
                          cur.rack += pr.rack
                          byLabel.set(pr.label, cur)
                        }
                      }
                      if (byLabel.size > 0) {
                        setPricingRows(
                          [...byLabel.entries()].map(([label, v], i) => ({
                            id: `ov-${i}`,
                            type: label,
                            charge: 'PPPN',
                            net: v.net,
                            rack: v.rack,
                          })),
                        )
                      }
                    }
                    setOverrideReasonDraft('')
                    setOverrideModalOpen(true)
                  }
                }}
                overrideModalOpen={overrideModalOpen}
                setOverrideModalOpen={setOverrideModalOpen}
                overrideReasonDraft={overrideReasonDraft}
                setOverrideReasonDraft={setOverrideReasonDraft}
                onSubmitOverride={() => {
                  const reason = overrideReasonDraft.trim()
                  if (!reason) return
                  const entry: AuditEntry = {
                    reason,
                    user: 'Esther Kairu',
                    at: new Date().toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  }
                  setPricingOverride(true)
                  patchDraft({ priceOverride: true })
                  setOverrideModalOpen(false)
                  setPriceAuditLog((prev) => [...prev, entry])
                }}
                auditLog={priceAuditLog}
                onAdd={addToItinerary}
              />
            </div>
          </div>
        </div>

        <RightPane
          width={rightPaneWidth}
          onResizeStart={startPaneResize}
          services={services}
          setServices={setServices}
          persist={persist}
          onEdit={editService}
          onPickSearch={(tab, item) => {
            setActiveTab(tab)
            setDrafts((prev) => ({
              ...prev,
              [tab]: {
                ...prev[tab],
                location: item.location,
                supplier: item.name,
                service: item.service,
              },
            }))
          }}
        />
      </div>

      <Dialog open={promoPromptOpen} onOpenChange={setPromoPromptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply promotion?</DialogTitle>
            <DialogDescription>
              {promo ? (
                <>
                  <span className="font-semibold text-foreground">{promo.title}</span> — {promo.desc}
                </>
              ) : (
                'An active promotion is selected for this accommodation.'
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoPromptOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#931115] hover:bg-[#7a0e12]"
              onClick={() => {
                setPromoPromptOpen(false)
                doAdd()
              }}
            >
              Add with promotion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
