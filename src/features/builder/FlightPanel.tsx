import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { CATALOG, extrasForTab } from '@/shared/lib/catalogs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CatalogItem, DemoRole, FlightInstance, Guest } from '@/shared/lib/types'
import { cn } from '@/shared/lib/utils'
import { DatePickerGridInput } from '@/shared/ui/date-picker'
import { CancellationPolicyControl } from './CancellationPolicyControl'
import { ExtrasTab } from './ExtrasTab'
import { LocationDropdown } from './LocationDropdown'
import { OptionInclusions } from './OptionInclusions'
import { SupplierPicker } from './SupplierPicker'
import {
  FLIGHT_SERVICES,
  addableFlightOptions,
  asCustomExtras,
  asExtraIds,
  asFlights,
  extraObjects,
  findFlightServiceOption,
  findGuest,
  flightDepartMeta,
  formatFlightOptionDays,
  formatFlightOptionLabel,
  formatFlightOptionWindow,
  guestChipStyle,
  isDepartDateOnFlightOptionDay,
  isDepartTimeInFlightOptionWindow,
  usedGuestIds,
  autoAssignByCapacity,
} from './builderUtils'
import { resolveServiceOption } from './serviceOptions'
import { CustomExtraModal } from './BuilderModals'
import {
  EmptyStateCard,
  FieldGroup,
  GuestBadge,
  ItemIndex,
  LineNotesTab,
  LineTabBar,
  PaxCount,
  SectionHeader,
  SpecialOffersList,
  SupplierServiceCard,
  brandOutlineActionClassName,
} from './panelParts'

type FlightTab = 'guests' | 'policy' | 'extras' | 'promotions' | 'notes'
const PAX_BANDS: { key: 'adult' | 'youth' | 'child' | 'infant'; label: string }[] = [
  { key: 'adult', label: 'Adult' },
  { key: 'youth', label: 'Youth' },
  { key: 'child', label: 'Child' },
  { key: 'infant', label: 'Infant' },
]

function FlightWarning({ children }: { children: ReactNode }) {
  return (
    <Alert className="border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-900">
      <AlertTriangle className="size-3 text-amber-700" />
      <AlertDescription className="text-[11px] font-medium text-amber-900">{children}</AlertDescription>
    </Alert>
  )
}

function routePatch(service: string, location: string) {
  const normalized = service.replace(/\s+OW$/i, '')
  const parts = normalized.split(/\s+(?:TO|to)\s+/)
  if (parts.length === 2) {
    return { service, flightFrom: parts[0].trim(), flightTo: parts[1].trim() }
  }
  return { service, flightFrom: location, flightTo: service }
}

export function FlightPanel({
  draft,
  patch,
  guests = [],
  demoRole,
  isDraftItinerary,
}: {
  draft: Record<string, unknown>
  patch: (p: Record<string, unknown>) => void
  guests?: Guest[]
  demoRole: DemoRole
  isDraftItinerary: boolean
}) {
  const [rightTab, setRightTab] = useState<FlightTab>('guests')
  const [ceOpen, setCeOpen] = useState(false)
  const partyPax = useMemo(() => {
    const next = { adult: 0, youth: 0, child: 0, infant: 0 }
    for (const guest of guests) {
      if (guest.type in next) next[guest.type] += 1
    }
    return next
  }, [guests])
  const capMax = Math.max(1, Number(draft.capMax) || Number(draft.capacity) || 5)
  const capMin = Math.max(1, Number(draft.capMin) || Number(draft.minSeats) || 2)
  const flights = asFlights(draft)
  const used = usedGuestIds(flights)
  const extras = extraObjects(draft)
  const extraIds = asExtraIds(draft)
  const customExtras = asCustomExtras(draft)
  const service = String(draft.service || '')
  const serviceId = String(draft.serviceId || '')
  const flightOptions = addableFlightOptions(service)

  function setFlights(next: FlightInstance[]) {
    patch({ flights: next, flightOptionId: '', ...flightDepartMeta(next) })
  }

  const unassigned = guests.filter((g) => !used.includes(g.id))

  function autoAssign() {
    setFlights(autoAssignByCapacity(flights, guests, (f) => f.cap))
  }

  function moveGuestToFlight(gid: number, flightId: string) {
    setFlights(
      flights.map((x) => ({
        ...x,
        guestIds:
          x.id === flightId
            ? x.guestIds.includes(gid)
              ? x.guestIds
              : [...x.guestIds, gid]
            : x.guestIds.filter((id) => id !== gid),
      })),
    )
  }

  function unassignGuest(gid: number) {
    setFlights(flights.map((x) => ({ ...x, guestIds: x.guestIds.filter((id) => id !== gid) })))
  }

  function addFlightFromOption(optionId: string) {
    const option = findFlightServiceOption(service, optionId)
    if (!option) return
    setFlights([
      ...flights,
      {
        id: `f${Date.now()}`,
        cap: capMax,
        guestIds: [],
        optionId: option.id,
        optionName: option.name,
        departDate: String(draft.departDate || ''),
        departTime: '',
      },
    ])
  }

  useEffect(() => {
    const current = (draft.pax || {}) as Record<string, number>
    const changed =
      PAX_BANDS.some((band) => (current[band.key] || 0) !== partyPax[band.key]) ||
      Number(draft.capacity) !== capMax ||
      Number(draft.capMax) !== capMax ||
      Number(draft.capMin) !== capMin
    if (changed) patch({ pax: partyPax, capacity: capMax, capMin, capMax })
  }, [partyPax, capMax, capMin, draft.pax, draft.capacity, draft.capMax, draft.capMin, patch])

  const location = String(draft.location || draft.flightFrom || '')
  const supplier = String(draft.supplier || '')

  return (
    <div className="flex flex-col gap-5">
      <SupplierServiceCard
        hasLocation={Boolean(location)}
        hasSupplier={Boolean(supplier)}
        location={
          <LocationDropdown
            value={location}
            onChange={(name) =>
              patch({
                location: name,
                flightFrom: name,
                flightTo: '',
                supplier: '',
                service: '',
                serviceId: '',
                flightOptionId: '',
                flights: [],
              })
            }
          />
        }
        supplier={
          <SupplierPicker
            tab="flight"
            value={supplier}
            disabled={!location}
            onPick={(item: CatalogItem) =>
              patch({
                supplier: item.name,
                serviceId: item.id,
                flightOptionId: '',
                flights: [],
                ...routePatch(item.service, location),
              })
            }
          />
        }
        service={
          <Select
            value={service || undefined}
            disabled={!supplier}
            onValueChange={(value) => {
              const match = CATALOG.flight.find(
                (c) =>
                  c.service === value ||
                  (value === 'Scheduled Economy' && c.service === 'Scheduled Economy (Y Class)') ||
                  (value === 'Private Charter' &&
                    (c.service === 'Charter Flight' || c.service === 'Charter flight')),
              )
              patch({
                ...routePatch(value, location),
                serviceId: match?.id ?? '',
                flightOptionId: '',
                flights: [],
              })
            }}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Select service" />
            </SelectTrigger>
            <SelectContent>
              {FLIGHT_SERVICES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="flex flex-col gap-3">
        <LineTabBar
          value={rightTab}
          onChange={setRightTab}
          tabs={[
            { key: 'guests', label: 'Guests' },
            { key: 'extras', label: 'Extras' },
            { key: 'promotions', label: 'Special Offer(s)' },
            { key: 'policy', label: 'Policy' },
            { key: 'notes', label: 'Notes' },
          ]}
        />

        {rightTab === 'guests' ? (
          <div className="flex flex-col gap-3">
            <SectionHeader
              title="Flights & PAX"
              actions={
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={autoAssign}
                    disabled={flights.length === 0 || unassigned.length === 0}
                    className={cn('h-7 text-xs font-semibold', brandOutlineActionClassName)}
                  >
                    <RefreshCw className="size-3.5" />
                    Auto-assign
                  </Button>
                  {service ? (
                    <Select
                      key={`add-flight-${service}-${flights.length}`}
                      value={undefined}
                      disabled={flightOptions.length === 0}
                      onValueChange={addFlightFromOption}
                    >
                      <SelectTrigger
                        aria-label="Add flight"
                        className="h-8 w-auto min-w-[8.5rem] bg-background text-xs"
                      >
                        <Plus className="size-3.5" />
                        <SelectValue placeholder="Add flight" />
                      </SelectTrigger>
                      <SelectContent className="max-w-[min(100vw-2rem,28rem)]">
                        {flightOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {formatFlightOptionLabel(option)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </>
              }
            />

            {flights.length === 0 ? (
              <EmptyStateCard compact>
                {service
                  ? 'Use Add flight to pick a departure option for this service.'
                  : 'Select a service, then add flight options below.'}
              </EmptyStateCard>
            ) : null}

            {flights.map((f, i) => {
              const flightOption = findFlightServiceOption(service, String(f.optionId || ''))
              const resolvedInclusions = resolveServiceOption(serviceId, String(f.optionId || ''))
              const timeOut =
                flightOption != null &&
                Boolean(f.departTime) &&
                !isDepartTimeInFlightOptionWindow(f.departTime || '', flightOption)
              const dateOff =
                flightOption != null &&
                Boolean(f.departDate) &&
                flightOption.days.length > 0 &&
                !isDepartDateOnFlightOptionDay(f.departDate || '', flightOption)
              const updateFlight = (changes: Partial<FlightInstance>) =>
                setFlights(flights.map((x) => (x.id === f.id ? { ...x, ...changes } : x)))
              return (
                <Card
                  key={f.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const gid = Number(e.dataTransfer.getData('text/plain'))
                    if (gid) moveGuestToFlight(gid, f.id)
                  }}
                >
                  <CardContent className="flex flex-col gap-3 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <ItemIndex n={i + 1} />
                      <Select
                        value={f.optionId || undefined}
                        disabled={flightOptions.length === 0}
                        onValueChange={(value) => {
                          const opt = findFlightServiceOption(service, value)
                          if (opt) updateFlight({ optionId: opt.id, optionName: opt.name })
                        }}
                      >
                        <SelectTrigger
                          aria-label="Flight option"
                          className="h-8 w-full max-w-[14rem] bg-background text-sm font-semibold"
                        >
                          <SelectValue placeholder="Flight option" />
                        </SelectTrigger>
                        <SelectContent>
                          {flightOptions.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <PaxCount assigned={f.guestIds.length} cap={f.cap} />
                      <OptionInclusions option={resolvedInclusions} />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="Remove flight"
                        className="ml-auto size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setFlights(flights.filter((x) => x.id !== f.id))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <FieldGroup label="Departure date" required>
                        <DatePickerGridInput
                          aria-label="Departure date"
                          value={f.departDate || ''}
                          hasError={dateOff}
                          onChange={(value) => updateFlight({ departDate: value })}
                        />
                        {dateOff && flightOption ? (
                          <FlightWarning>
                            {flightOption.name} does not operate on this date (
                            {formatFlightOptionDays(flightOption.days)}).
                          </FlightWarning>
                        ) : null}
                      </FieldGroup>
                      <FieldGroup label="Departure time">
                        <Input
                          type="time"
                          aria-label="Departure time"
                          value={f.departTime || ''}
                          onChange={(e) => updateFlight({ departTime: e.target.value })}
                          className="bg-background"
                        />
                        {timeOut && flightOption ? (
                          <FlightWarning>
                            Outside {flightOption.name}&apos;s window (
                            {formatFlightOptionWindow(flightOption)}).
                          </FlightWarning>
                        ) : null}
                      </FieldGroup>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {f.guestIds.map((gid) => {
                        const g = findGuest(gid, guests)
                        if (!g) return null
                        return (
                          <GuestBadge
                            key={gid}
                            label={g.name}
                            lead={guestChipStyle(g).lead}
                            onRemove={() => unassignGuest(gid)}
                          />
                        )
                      })}
                      <Select
                        value={undefined}
                        disabled={unassigned.length === 0}
                        onValueChange={(value) => {
                          const gid = Number(value)
                          if (gid) moveGuestToFlight(gid, f.id)
                        }}
                      >
                        <SelectTrigger
                          aria-label="Add guest"
                          className="h-8 w-auto min-w-[8rem] bg-background text-xs"
                        >
                          <SelectValue placeholder="+ Add guest" />
                        </SelectTrigger>
                        <SelectContent>
                          {unassigned.map((g) => (
                            <SelectItem key={g.id} value={String(g.id)}>
                              {g.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : null}

        {rightTab === 'policy' ? (
          <CancellationPolicyControl
            tab="flight"
            draft={draft}
            patch={patch}
            demoRole={demoRole}
            isDraftItinerary={isDraftItinerary}
          />
        ) : null}

        {rightTab === 'extras' ? (
          <ExtrasTab
            selected={extras}
            catalog={extrasForTab('flight')}
            extraIds={extraIds}
            onAdd={(id) => patch({ extras: [...extraIds, id] })}
            onRemove={(ex) => {
              if (ex.custom) {
                patch({ customExtras: customExtras.filter((x) => x.id !== ex.id) })
              } else {
                patch({ extras: extraIds.filter((id) => id !== ex.id) })
              }
            }}
            onCustom={() => setCeOpen(true)}
          />
        ) : null}

        {rightTab === 'promotions' ? (
          <SpecialOffersList
            selectedId={(draft.promotion as string | null) ?? null}
            onSelect={(id) => patch({ promotion: id })}
          />
        ) : null}

        {rightTab === 'notes' ? (
          <LineNotesTab
            serviceNotes="Baggage allowance and route timings are subject to operator confirmation. Soft product rules may apply on shared charters."
            notes={String(draft.notes || '')}
            onNotesChange={(value) => patch({ notes: value })}
          />
        ) : null}
      </div>

      <CustomExtraModal
        open={ceOpen}
        onClose={() => setCeOpen(false)}
        onSubmit={(extra) => {
          const n = Number(draft.customExtraSeq) || 1
          patch({
            customExtras: [
              ...customExtras,
              {
                id: `custom-f${n}`,
                title: extra.title,
                serviceType: extra.serviceType,
                chargeType: extra.chargeType,
                timeUnit: extra.timeUnit,
                qty: extra.qty,
                price: extra.price,
                dateFrom: extra.dateFrom,
                dateTo: extra.dateTo,
                custom: true,
              },
            ],
            customExtraSeq: n + 1,
          })
        }}
      />
    </div>
  )
}
