import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  copyItinerary as copyItineraryHelper,
  createSplitRecord,
} from '@/shared/lib/helpers'
import {
  deleteItinerary as deleteItineraryStorage,
  getGuestDetails as getGuestDetailsStorage,
  getQuoteGroups as getQuoteGroupsStorage,
  getServices as getServicesStorage,
  listItineraries,
  nextInquiryId,
  setGuestDetails as setGuestDetailsStorage,
  setQuoteGroups as setQuoteGroupsStorage,
  setServices as setServicesStorage,
  upsertItinerary as upsertItineraryStorage,
} from '@/shared/lib/storage'
import type {
  AddedService,
  CreateItineraryInput,
  GuestDetail,
  Itinerary,
  ItineraryStatus,
  QuoteGroup,
  SplitForm,
} from '@/shared/lib/types'

interface StoreContextValue {
  itineraries: Itinerary[]
  refresh: () => void
  upsertItinerary: (itinerary: Itinerary) => void
  createItinerary: (input: CreateItineraryInput) => Itinerary
  copyItinerary: (id: string) => Itinerary | null
  splitItinerary: (parentRef: string, form: SplitForm) => Itinerary | null
  updateStatus: (id: string, status: ItineraryStatus) => void
  removeItinerary: (id: string) => void
  getServices: (itineraryId: string) => AddedService[]
  saveServices: (itineraryId: string, services: AddedService[]) => void
  getQuoteGroups: (itineraryId: string) => QuoteGroup[]
  saveQuoteGroups: (itineraryId: string, groups: QuoteGroup[]) => void
  getGuestDetails: (itineraryId: string) => GuestDetail[]
  saveGuestDetails: (itineraryId: string, guests: GuestDetail[]) => void
}

const StoreContext = createContext<StoreContextValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [itineraries, setItineraries] = useState<Itinerary[]>(() => listItineraries())
  const [rev, setRev] = useState(0)

  const bump = useCallback(() => {
    setItineraries(listItineraries())
    setRev((r) => r + 1)
  }, [])

  const refresh = useCallback(() => bump(), [bump])

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
      const adults = input.adultsRes + input.adultsNonRes
      const children = input.childrenRes + input.childrenNonRes
      const infants = input.infantsRes + input.infantsNonRes
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
        adultsRes: input.adultsRes,
        adultsNonRes: input.adultsNonRes,
        childrenRes: input.childrenRes,
        childrenNonRes: input.childrenNonRes,
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

  const updateStatus = useCallback(
    (id: string, status: ItineraryStatus) => {
      const current = listItineraries().find((it) => it.id === id)
      if (!current) return
      upsertItineraryStorage({ ...current, status, updatedAt: new Date().toISOString() })
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
      return getServicesStorage(itineraryId)
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
      refresh,
      upsertItinerary,
      createItinerary,
      copyItinerary,
      splitItinerary,
      updateStatus,
      removeItinerary,
      getServices,
      saveServices,
      getQuoteGroups,
      saveQuoteGroups,
      getGuestDetails,
      saveGuestDetails,
    }),
    [
      itineraries,
      refresh,
      upsertItinerary,
      createItinerary,
      copyItinerary,
      splitItinerary,
      updateStatus,
      removeItinerary,
      getServices,
      saveServices,
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
