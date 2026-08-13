import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  acceptOption as acceptOptionHelper,
  buildGuestDetailsFromCreateInput,
  copyItinerary as copyItineraryHelper,
  createSplitRecord,
  transitions,
} from '@/shared/lib/helpers'
import {
  canRemoveLine,
  cancelLine,
  confirmLine,
  evaluateTransition,
  isStructureLocked,
  itineraryCommercialFp,
  normalizeServicesLifecycle,
  raiseVouchers,
  resetLine,
  roleAllowsLineAction,
  roleAllowsVoucherAction,
  setSupplierVoucherOutcome,
  type GateResult,
} from '@/shared/lib/lifecycleRules'
import {
  deleteItinerary as deleteItineraryStorage,
  getGuestDetails as getGuestDetailsStorage,
  getQuoteGroups as getQuoteGroupsStorage,
  getServices as getServicesStorage,
  listItineraries,
  nextInquiryId,
  replaceItineraries as replaceItinerariesStorage,
  setGuestDetails as setGuestDetailsStorage,
  setQuoteGroups as setQuoteGroupsStorage,
  setServices as setServicesStorage,
  upsertItinerary as upsertItineraryStorage,
} from '@/shared/lib/storage'
import type {
  AddedService,
  CreateItineraryInput,
  DemoRole,
  GuestDetail,
  Itinerary,
  ItineraryStatus,
  LifecycleLogEntry,
  QuoteGroup,
  SplitForm,
} from '@/shared/lib/types'

const ROLE_KEY = 'sol-demo-role'

function readRole(): DemoRole {
  try {
    const raw = localStorage.getItem(ROLE_KEY)
    if (
      raw === 'Safari.Planner' ||
      raw === 'Sales.Manager' ||
      raw === 'Operations' ||
      raw === 'Finance' ||
      raw === 'Admin'
    ) {
      return raw
    }
  } catch {
    /* ignore */
  }
  return 'Admin'
}

interface StoreContextValue {
  itineraries: Itinerary[]
  demoRole: DemoRole
  setDemoRole: (role: DemoRole) => void
  refresh: () => void
  upsertItinerary: (itinerary: Itinerary) => void
  createItinerary: (input: CreateItineraryInput) => Itinerary
  copyItinerary: (id: string) => Itinerary | null
  splitItinerary: (parentRef: string, form: SplitForm) => Itinerary | null
  acceptOption: (reference: string) => void
  updateStatus: (id: string, status: ItineraryStatus) => GateResult
  applyLifecycleTransition: (
    id: string,
    status: ItineraryStatus,
    opts?: { reason?: string; generating?: 'quote' | 'invoice' },
  ) => GateResult
  stampQuoteDoc: (id: string) => void
  stampInvoiceDoc: (id: string) => void
  removeItinerary: (id: string) => void
  getServices: (itineraryId: string) => AddedService[]
  saveServices: (itineraryId: string, services: AddedService[]) => void
  confirmServiceLine: (itineraryId: string, serviceId: string) => GateResult
  resetServiceLine: (itineraryId: string, serviceId: string) => GateResult
  cancelServiceLine: (itineraryId: string, serviceId: string) => GateResult
  removeServiceLine: (itineraryId: string, serviceId: string) => GateResult
  confirmSupplierVoucher: (itineraryId: string, supplier: string) => GateResult
  rejectSupplierVoucher: (itineraryId: string, supplier: string) => GateResult
  getQuoteGroups: (itineraryId: string) => QuoteGroup[]
  saveQuoteGroups: (itineraryId: string, groups: QuoteGroup[]) => void
  getGuestDetails: (itineraryId: string) => GuestDetail[]
  saveGuestDetails: (itineraryId: string, guests: GuestDetail[]) => void
}

const StoreContext = createContext<StoreContextValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [itineraries, setItineraries] = useState<Itinerary[]>(() => listItineraries())
  const [rev, setRev] = useState(0)
  const [demoRole, setDemoRoleState] = useState<DemoRole>(() => readRole())

  const bump = useCallback(() => {
    setItineraries(listItineraries())
    setRev((r) => r + 1)
  }, [])

  const refresh = useCallback(() => bump(), [bump])

  const setDemoRole = useCallback((role: DemoRole) => {
    setDemoRoleState(role)
    try {
      localStorage.setItem(ROLE_KEY, role)
    } catch {
      /* ignore */
    }
  }, [])

  const upsertItinerary = useCallback(
    (itinerary: Itinerary) => {
      upsertItineraryStorage(itinerary)
      bump()
    },
    [bump],
  )

  const createItinerary = useCallback(
    (input: CreateItineraryInput) => {
      const id = nextInquiryId()
      const now = new Date().toISOString()
      const adults = input.adultsCitizen + input.adultsRes + input.adultsNonRes
      const children = input.childrenCitizen + input.childrenRes + input.childrenNonRes
      const infants = input.infantsCitizen + input.infantsRes + input.infantsNonRes
      const itinerary: Itinerary = {
        id,
        reference: input.inquiryRef?.trim() || id,
        itineraryRef: `ITN-${10000 + Number(id.replace(/\D/g, '')) % 10000}`,
        title: input.title || 'Untitled Itinerary',
        agency: input.agency,
        agent: input.agent,
        safariPlanner: 'Amelia Earhart',
        destination: input.destinations[0] || '',
        destinations: input.destinations,
        travelDateFrom: input.travelDateFrom,
        travelDateTo: input.travelDateTo,
        createdAt: now.slice(0, 10),
        status: 'DRAFT',
        paymentStatus: 'UNPAID',
        totalUsd: 0,
        balanceUsd: 0,
        updatedAt: now,
        leadFirst: input.leadFirst,
        leadLast: input.leadLast,
        adults,
        children,
        infants,
        adultsCitizen: input.adultsCitizen,
        adultsRes: input.adultsRes,
        adultsNonRes: input.adultsNonRes,
        childrenCitizen: input.childrenCitizen,
        childrenRes: input.childrenRes,
        childrenNonRes: input.childrenNonRes,
        infantsCitizen: input.infantsCitizen,
        infantsRes: input.infantsRes,
        infantsNonRes: input.infantsNonRes,
        childAges: input.childAges,
        paxAdults: adults,
        paxChildren: children,
        guestsLabel: [adults ? `${adults} Ad` : '', children ? `${children} Ch` : '', infants ? `${infants} In` : '']
          .filter(Boolean)
          .join(' · '),
      }
      upsertItineraryStorage(itinerary)
      setServicesStorage(id, [])
      setQuoteGroupsStorage(id, [])
      setGuestDetailsStorage(id, buildGuestDetailsFromCreateInput(input))
      bump()
      return itinerary
    },
    [bump],
  )

  const copyItinerary = useCallback(
    (id: string) => {
      const src = listItineraries().find((it) => it.id === id)
      if (!src) return null
      const copy = copyItineraryHelper(src, listItineraries())
      upsertItineraryStorage(copy)
      setServicesStorage(copy.id, structuredClone(getServicesStorage(id)))
      setQuoteGroupsStorage(copy.id, structuredClone(getQuoteGroupsStorage(id)))
      bump()
      return copy
    },
    [bump],
  )

  const splitItinerary = useCallback(
    (parentRef: string, form: SplitForm) => {
      const created = createSplitRecord(listItineraries(), parentRef, form)
      if (!created) return null
      upsertItineraryStorage(created)
      setServicesStorage(created.id, [])
      setQuoteGroupsStorage(created.id, [])
      bump()
      return created
    },
    [bump],
  )

  const acceptOption = useCallback(
    (reference: string) => {
      replaceItinerariesStorage(acceptOptionHelper(listItineraries(), reference))
      bump()
    },
    [bump],
  )

  const applyLifecycleTransition = useCallback(
    (
      id: string,
      status: ItineraryStatus,
      opts?: { reason?: string; generating?: 'quote' | 'invoice' },
    ): GateResult => {
      const current = listItineraries().find((it) => it.id === id)
      if (!current) return { ok: false, ruleId: 'missing', reason: 'Itinerary not found' }

      let services = getServicesStorage(id)
      let working: Itinerary = { ...current }
      const fp = itineraryCommercialFp(services)

      if (opts?.generating === 'quote' || status === 'QUOTED') {
        working = { ...working, quoteFingerprint: fp }
      }
      if (opts?.generating === 'invoice' || (status === 'INVOICED' && current.status === 'APPROVED')) {
        working = { ...working, invoiceFingerprint: fp }
      }

      const generating =
        opts?.generating ??
        (status === 'QUOTED' && current.status === 'PREPARED'
          ? 'quote'
          : status === 'INVOICED' && current.status === 'APPROVED'
            ? 'invoice'
            : undefined)

      const gate = evaluateTransition(working, services, status, {
        generating,
        role: demoRole,
      })
      if (!gate.ok) return gate

      if (status === 'VOUCHERED' && current.status === 'INVOICED') {
        const raised = raiseVouchers(services, working)
        services = raised.services
        working = { ...working, supplierVouchers: raised.supplierVouchers }
        setServicesStorage(id, services)
      }

      const reason = opts?.reason?.trim() || undefined
      const label =
        transitions(current.status).find((t) => t.to === status)?.label ??
        `Move to ${status}`
      const entry: LifecycleLogEntry = {
        id: `ll-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        at: new Date().toISOString(),
        actor: demoRole,
        from: current.status,
        to: status,
        label,
        reason,
      }
      const lifecycleLog = [...(working.lifecycleLog ?? []), entry]

      upsertItineraryStorage({
        ...working,
        status,
        updatedAt: entry.at,
        lastTransitionReason: reason || working.lastTransitionReason,
        lifecycleLog,
      })
      bump()
      return { ok: true }
    },
    [bump, demoRole],
  )

  const updateStatus = useCallback(
    (id: string, status: ItineraryStatus): GateResult => applyLifecycleTransition(id, status),
    [applyLifecycleTransition],
  )

  const stampQuoteDoc = useCallback(
    (id: string) => {
      const current = listItineraries().find((it) => it.id === id)
      if (!current) return
      const fp = itineraryCommercialFp(getServicesStorage(id))
      upsertItineraryStorage({
        ...current,
        quoteFingerprint: fp,
        updatedAt: new Date().toISOString(),
      })
      bump()
    },
    [bump],
  )

  const stampInvoiceDoc = useCallback(
    (id: string) => {
      const current = listItineraries().find((it) => it.id === id)
      if (!current) return
      const fp = itineraryCommercialFp(getServicesStorage(id))
      upsertItineraryStorage({
        ...current,
        invoiceFingerprint: fp,
        updatedAt: new Date().toISOString(),
      })
      bump()
    },
    [bump],
  )

  const removeItinerary = useCallback(
    (id: string) => {
      deleteItineraryStorage(id)
      bump()
    },
    [bump],
  )

  const getServices = useCallback(
    (itineraryId: string) => {
      void rev
      const itinerary = listItineraries().find((it) => it.id === itineraryId)
      const raw = getServicesStorage(itineraryId)
      if (!itinerary) return raw
      return normalizeServicesLifecycle(raw, itinerary)
    },
    [rev],
  )

  const saveServices = useCallback(
    (itineraryId: string, services: AddedService[]) => {
      setServicesStorage(itineraryId, services)
      bump()
    },
    [bump],
  )

  const patchServiceLine = useCallback(
    (
      itineraryId: string,
      serviceId: string,
      action: 'confirm' | 'reset' | 'cancel' | 'remove',
    ): GateResult => {
      if (!roleAllowsLineAction(demoRole, action)) {
        return { ok: false, ruleId: 'role-denied', reason: `Role ${demoRole} cannot ${action} lines` }
      }
      const services = getServicesStorage(itineraryId)
      const idx = services.findIndex((s) => s.id === serviceId)
      if (idx < 0) return { ok: false, ruleId: 'missing-line', reason: 'Service line not found' }
      const target = services[idx]

      if (action === 'remove') {
        const current = listItineraries().find((it) => it.id === itineraryId)
        if (current && isStructureLocked(current.status)) {
          return {
            ok: false,
            ruleId: 'structure-locked',
            reason: 'Structure is locked after Quoted — Return to Draft to add or remove lines',
          }
        }
        const gate = canRemoveLine(target)
        if (!gate.ok) return gate
        setServicesStorage(
          itineraryId,
          services.filter((s) => s.id !== serviceId),
        )
        bump()
        return { ok: true }
      }

      const result =
        action === 'confirm'
          ? confirmLine(target)
          : action === 'reset'
            ? resetLine(target)
            : cancelLine(target)
      if (!result.ok || !result.service) return result
      const next = services.slice()
      next[idx] = result.service
      setServicesStorage(itineraryId, next)
      bump()
      return { ok: true }
    },
    [bump, demoRole],
  )

  const confirmServiceLine = useCallback(
    (itineraryId: string, serviceId: string) => patchServiceLine(itineraryId, serviceId, 'confirm'),
    [patchServiceLine],
  )
  const resetServiceLine = useCallback(
    (itineraryId: string, serviceId: string) => patchServiceLine(itineraryId, serviceId, 'reset'),
    [patchServiceLine],
  )
  const cancelServiceLine = useCallback(
    (itineraryId: string, serviceId: string) => patchServiceLine(itineraryId, serviceId, 'cancel'),
    [patchServiceLine],
  )
  const removeServiceLine = useCallback(
    (itineraryId: string, serviceId: string) => patchServiceLine(itineraryId, serviceId, 'remove'),
    [patchServiceLine],
  )

  const applyVoucherOutcome = useCallback(
    (itineraryId: string, supplier: string, outcome: 'Confirmed' | 'Rejected'): GateResult => {
      const action = outcome === 'Confirmed' ? 'confirm' : 'reject'
      if (!roleAllowsVoucherAction(demoRole, action)) {
        return {
          ok: false,
          ruleId: 'role-denied',
          reason: `Role ${demoRole} cannot ${action} supplier vouchers`,
        }
      }
      const current = listItineraries().find((it) => it.id === itineraryId)
      if (!current) return { ok: false, ruleId: 'missing', reason: 'Itinerary not found' }
      const patched = setSupplierVoucherOutcome(
        getServicesStorage(itineraryId),
        current.supplierVouchers || {},
        supplier,
        outcome,
      )
      setServicesStorage(itineraryId, patched.services)
      upsertItineraryStorage({
        ...current,
        supplierVouchers: patched.supplierVouchers,
        updatedAt: new Date().toISOString(),
      })
      bump()
      return { ok: true }
    },
    [bump, demoRole],
  )

  const confirmSupplierVoucher = useCallback(
    (itineraryId: string, supplier: string) =>
      applyVoucherOutcome(itineraryId, supplier, 'Confirmed'),
    [applyVoucherOutcome],
  )
  const rejectSupplierVoucher = useCallback(
    (itineraryId: string, supplier: string) =>
      applyVoucherOutcome(itineraryId, supplier, 'Rejected'),
    [applyVoucherOutcome],
  )

  const getQuoteGroups = useCallback(
    (itineraryId: string) => {
      void rev
      return getQuoteGroupsStorage(itineraryId)
    },
    [rev],
  )

  const saveQuoteGroups = useCallback(
    (itineraryId: string, groups: QuoteGroup[]) => {
      setQuoteGroupsStorage(itineraryId, groups)
      bump()
    },
    [bump],
  )

  const getGuestDetails = useCallback(
    (itineraryId: string) => {
      void rev
      return getGuestDetailsStorage(itineraryId)
    },
    [rev],
  )

  const saveGuestDetails = useCallback(
    (itineraryId: string, guests: GuestDetail[]) => {
      setGuestDetailsStorage(itineraryId, guests)
      bump()
    },
    [bump],
  )

  const value = useMemo(
    () => ({
      itineraries,
      demoRole,
      setDemoRole,
      refresh,
      upsertItinerary,
      createItinerary,
      copyItinerary,
      splitItinerary,
      acceptOption,
      updateStatus,
      applyLifecycleTransition,
      stampQuoteDoc,
      stampInvoiceDoc,
      removeItinerary,
      getServices,
      saveServices,
      confirmServiceLine,
      resetServiceLine,
      cancelServiceLine,
      removeServiceLine,
      confirmSupplierVoucher,
      rejectSupplierVoucher,
      getQuoteGroups,
      saveQuoteGroups,
      getGuestDetails,
      saveGuestDetails,
    }),
    [
      itineraries,
      demoRole,
      setDemoRole,
      refresh,
      upsertItinerary,
      createItinerary,
      copyItinerary,
      splitItinerary,
      acceptOption,
      updateStatus,
      applyLifecycleTransition,
      stampQuoteDoc,
      stampInvoiceDoc,
      removeItinerary,
      getServices,
      saveServices,
      confirmServiceLine,
      resetServiceLine,
      cancelServiceLine,
      removeServiceLine,
      confirmSupplierVoucher,
      rejectSupplierVoucher,
      getQuoteGroups,
      saveQuoteGroups,
      getGuestDetails,
      saveGuestDetails,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
