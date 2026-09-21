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
  partyGuests,
  transitions,
} from '@/shared/lib/helpers'
import {
  applyVoucherLineSubmit,
  canRemoveLine,
  cancelLine,
  confirmLine,
  evaluateTransition,
  evaluateVoucherToken,
  isStructureLocked,
  itineraryCommercialFp,
  lineStatusOf,
  normalizeServicesLifecycle,
  payableEntityIdOf,
  raiseVouchers,
  resetLine,
  roleAllowsLineAction,
  roleAllowsVoucherAction,
  type GateResult,
  type VoucherLineInput,
} from '@/shared/lib/lifecycleRules'
import { getPayableEntity, payableEntityFromSupplierName } from '@/shared/lib/payableEntities'
import {
  appendLifecycleEntry,
  appendSendRecord,
  buildAnswerRecord,
  nextVoucherSeq,
  resetSupplierVoucherRollup,
  revertEntitySupplierStatus,
  routePlannerNotifications,
  stripEntityLineAnswers,
} from '@/shared/lib/voucherStoreHelpers'
import { sendVoucherEmail, voucherFromAddress } from '@/shared/lib/voucherMail'
import { migrateItineraryVoucherKeys } from '@/shared/lib/voucherMigration'
import {
  guestsServedByEntity,
  linesFromServices,
  supplierEmailFor,
  voucherIssueSignature,
} from '@/features/summary/summaryModel'
import { fmtLedgerUsd } from '@/features/quote-doc/quoteLedgerModel'
import { buildInvoiceSnapshot } from '@/features/invoice-doc/invoiceSnapshotModel'
import {
  buildQuoteSnapshot,
  nextQuoteSeq,
} from '@/features/quote-doc/quoteSnapshotModel'
import {
  appendQuote as appendQuoteStorage,
  deleteItinerary as deleteItineraryStorage,
  getGuestDetails as getGuestDetailsStorage,
  getInvoice as getInvoiceStorage,
  getQuoteGroups as getQuoteGroupsStorage,
  getServices as getServicesStorage,
  listItineraries,
  listQuotes as listQuotesStorage,
  saveInvoice as saveInvoiceStorage,
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
  InvoiceDocument,
  InvoiceLifecycleStage,
  Itinerary,
  ItineraryStatus,
  LifecycleLogEntry,
  QuoteDocument,
  QuoteGroup,
  QuotePresentation,
  QuoteRateBasis,
  QuoteRateBasisSelection,
  SplitForm,
  VoucherMeta,
  VoucherToken,
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
  getQuotes: (itineraryId: string) => QuoteDocument[]
  generateQuote: (
    itineraryId: string,
    opts?: {
      generatedBy?: string
      rateBasis?: QuoteRateBasisSelection
      presentation?: QuotePresentation
    },
  ) => QuoteDocument | QuoteDocument[] | null
  getInvoice: (itineraryId: string) => InvoiceDocument | undefined
  generateInvoice: (
    itineraryId: string,
    opts?: { stage?: InvoiceLifecycleStage; generatedBy?: string },
  ) => InvoiceDocument | null
  removeItinerary: (id: string) => void
  getServices: (itineraryId: string) => AddedService[]
  saveServices: (itineraryId: string, services: AddedService[]) => void
  confirmServiceLine: (itineraryId: string, serviceId: string) => GateResult
  resetServiceLine: (itineraryId: string, serviceId: string) => GateResult
  cancelServiceLine: (itineraryId: string, serviceId: string) => GateResult
  removeServiceLine: (itineraryId: string, serviceId: string) => GateResult
  issueSupplierVoucher: (
    itineraryId: string,
    entityId: string,
    opts: {
      recipientEmails: string[]
      note?: string
      supplierBookingRef?: string
      kind?: 'standard' | 'cancellation_only'
    },
  ) => GateResult
  resendSupplierVoucher: (itineraryId: string, entityId: string) => GateResult
  requestLatestVoucher: (
    itineraryId: string,
    entityId: string,
    opts?: { token?: string; recipientEmail?: string },
  ) => GateResult
  submitVoucherAnswers: (
    itineraryId: string,
    entityId: string,
    input: {
      lines: VoucherLineInput[]
      ticks: Record<string, boolean>
      reasons: Record<string, string>
      via: 'link' | 'staff' | 'acknowledge'
      token?: string
      courtesyName?: string
      userAgent?: string
    },
  ) => GateResult & { depositGuardCount?: number }
  clearVoucherReply: (itineraryId: string, entityId: string) => GateResult
  moveServiceLineBetweenItineraries: (
    fromId: string,
    toId: string,
    serviceId: string,
  ) => GateResult
  getQuoteGroups: (itineraryId: string) => QuoteGroup[]
  saveQuoteGroups: (itineraryId: string, groups: QuoteGroup[]) => void
  getGuestDetails: (itineraryId: string) => GuestDetail[]
  saveGuestDetails: (itineraryId: string, guests: GuestDetail[]) => void
}

const StoreContext = createContext<StoreContextValue | null>(null)

function randomVoucherToken(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6)
}

/** 30 days from send, or the trip's start date, whichever comes first (BR-57). */
function voucherTokenExpiry(issuedAtIso: string, tripStartIso?: string): string {
  const cap = new Date(issuedAtIso).getTime() + 30 * 86400000
  if (!tripStartIso) return new Date(cap).toISOString()
  const start = new Date(`${tripStartIso}T00:00:00`).getTime()
  return new Date(Number.isFinite(start) && start > 0 ? Math.min(cap, start) : cap).toISOString()
}

function resolveEntityId(key: string): string {
  if (key.startsWith('pe-')) return key
  return payableEntityFromSupplierName(key).id
}

function migratedList(): Itinerary[] {
  return listItineraries().map(migrateItineraryVoucherKeys)
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [itineraries, setItineraries] = useState<Itinerary[]>(() => migratedList())
  const [rev, setRev] = useState(0)
  const [demoRole, setDemoRoleState] = useState<DemoRole>(() => readRole())

  const bump = useCallback(() => {
    setItineraries(migratedList())
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
      const list = migratedList()
      const parent = list.find((it) => it.reference === parentRef)
      if (parent && parent.status !== 'CONFIRMED' && parent.reference.split('-').length >= 2) {
        return null
      }
      const created = createSplitRecord(list, parentRef, form)
      if (!created) return null
      upsertItineraryStorage(created)
      const parentServices = parent ? getServicesStorage(parent.id) : []
      const confirmed = parentServices.filter((s) => lineStatusOf(s) === 'Confirmed')
      setServicesStorage(created.id, confirmed.length ? structuredClone(confirmed) : [])
      setQuoteGroupsStorage(created.id, parent ? structuredClone(getQuoteGroupsStorage(parent.id)) : [])
      setGuestDetailsStorage(created.id, form.guests)
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

      if (opts?.generating === 'invoice') {
        const invoiceGate = evaluateTransition(working, services, status, {
          generating: 'invoice',
          role: demoRole,
        })
        if (!invoiceGate.ok) return invoiceGate
        const doc = buildInvoiceSnapshot({
          itinerary: working,
          services,
          quoteGroups: getQuoteGroupsStorage(id),
          guestDetails: getGuestDetailsStorage(id),
          stage: 'deposit',
          generatedBy: demoRole,
          existing: getInvoiceStorage(id),
        })
        saveInvoiceStorage(doc)
        working = {
          ...working,
          invoiceFingerprint: doc.fingerprint,
          firstInvoiceDate: working.firstInvoiceDate ?? doc.invoiceDate,
        }
      }

      const fp = itineraryCommercialFp(services)

      if (opts?.generating === 'quote') {
        working = { ...working, quoteFingerprint: fp }
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

  const getQuotes = useCallback(
    (itineraryId: string) => {
      void rev
      return listQuotesStorage(itineraryId)
    },
    [rev],
  )

  const generateQuote = useCallback(
    (
      itineraryId: string,
      opts?: {
        generatedBy?: string
        rateBasis?: QuoteRateBasisSelection
        presentation?: QuotePresentation
      },
    ) => {
      const current = listItineraries().find((it) => it.id === itineraryId)
      if (!current) return null

      const services = getServicesStorage(itineraryId)
      const quoteGroups = getQuoteGroupsStorage(itineraryId)
      const guestDetails = getGuestDetailsStorage(itineraryId)
      const existing = listQuotesStorage(itineraryId)
      const selection = opts?.rateBasis ?? current.lastQuoteRateBasisSelection ?? 'nett'
      const generatedBy = opts?.generatedBy ?? demoRole
      const presentation = opts?.presentation

      const buildAtSeq = (seq: number, rateBasis: QuoteRateBasis) =>
        buildQuoteSnapshot({
          itinerary: current,
          services,
          quoteGroups,
          guestDetails,
          seq,
          generatedBy,
          rateBasis,
          presentation,
        })

      const docs: QuoteDocument[] =
        selection === 'both'
          ? [buildAtSeq(nextQuoteSeq(existing), 'rack'), buildAtSeq(nextQuoteSeq(existing) + 1, 'nett')]
          : [buildAtSeq(nextQuoteSeq(existing), selection)]

      for (const doc of docs) appendQuoteStorage(doc)

      const latest = docs[docs.length - 1]
      const presLabel = latest.presentation === 'B2B_PACKAGED' ? 'packaged' : 'itemised'
      const basisDetail =
        selection === 'both'
          ? `rack + nett · ${docs.map((d) => `${d.docNumber} ${fmtLedgerUsd(d.sellTotal)}`).join(' · ')}`
          : `${selection} · ${fmtLedgerUsd(latest.sellTotal)}`

      const entry: LifecycleLogEntry = {
        id: `ll-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        at: latest.generatedAt,
        actor: demoRole,
        from: current.status,
        to: current.status,
        label:
          selection === 'both'
            ? `Generated ${docs.map((d) => d.docNumber).join(' + ')} (${docs.map((d) => d.versionLabel).join(' + ')})`
            : `Generated ${latest.docNumber} (${latest.versionLabel})`,
        category: 'quote-generate',
        detail: `${presLabel} · ${basisDetail}`,
      }

      upsertItineraryStorage({
        ...current,
        quoteFingerprint: latest.fingerprint,
        lastQuoteRateBasisSelection: selection,
        lifecycleLog: [...(current.lifecycleLog ?? []), entry],
        updatedAt: latest.generatedAt,
      })
      bump()
      return docs.length === 1 ? docs[0] : docs
    },
    [bump, demoRole],
  )

  const getInvoice = useCallback(
    (itineraryId: string) => {
      void rev
      return getInvoiceStorage(itineraryId)
    },
    [rev],
  )

  const generateInvoice = useCallback(
    (itineraryId: string, opts?: { stage?: InvoiceLifecycleStage; generatedBy?: string }) => {
      const current = listItineraries().find((it) => it.id === itineraryId)
      if (!current) return null
      if (current.financeLocked) return null

      const services = getServicesStorage(itineraryId)
      const existing = getInvoiceStorage(itineraryId)
      const doc = buildInvoiceSnapshot({
        itinerary: current,
        services,
        quoteGroups: getQuoteGroupsStorage(itineraryId),
        guestDetails: getGuestDetailsStorage(itineraryId),
        stage: opts?.stage ?? existing?.lifecycleStage ?? 'deposit',
        generatedBy: opts?.generatedBy ?? demoRole,
        existing,
      })

      saveInvoiceStorage(doc)

      const isUpdate = Boolean(existing)
      const entry: LifecycleLogEntry = {
        id: `ll-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        at: doc.generatedAt,
        actor: demoRole,
        from: current.status,
        to: current.status,
        label: isUpdate ? `Updated ${doc.invoiceNumber}` : `Generated ${doc.invoiceNumber}`,
        category: isUpdate ? 'invoice-update' : 'invoice-generate',
        detail: `${doc.lifecycleStage} · ${fmtLedgerUsd(doc.paymentPosition.total)} · due now ${fmtLedgerUsd(doc.paymentPosition.amountDueImmediately)}`,
      }

      upsertItineraryStorage({
        ...current,
        invoiceFingerprint: doc.fingerprint,
        firstInvoiceDate: current.firstInvoiceDate ?? doc.invoiceDate,
        lifecycleLog: [...(current.lifecycleLog ?? []), entry],
        updatedAt: doc.generatedAt,
      })
      bump()
      return doc
    },
    [bump, demoRole],
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

  const issueSupplierVoucher = useCallback(
    (
      itineraryId: string,
      entityKey: string,
      opts: {
        recipientEmails: string[]
        note?: string
        supplierBookingRef?: string
        kind?: 'standard' | 'cancellation_only'
      },
    ): GateResult => {
      if (!roleAllowsVoucherAction(demoRole, 'issue')) {
        return { ok: false, ruleId: 'role-denied', reason: `Role ${demoRole} cannot issue vouchers` }
      }
      const current = migratedList().find((it) => it.id === itineraryId)
      if (!current) return { ok: false, ruleId: 'missing', reason: 'Itinerary not found' }
      const entityId = resolveEntityId(entityKey)
      const services = getServicesStorage(itineraryId)
      const guestDetails = getGuestDetailsStorage(itineraryId)
      const guests = partyGuests(current, guestDetails)
      const lines = linesFromServices(services, guests).filter((l) => {
        const eid = l.payableEntityId || payableEntityFromSupplierName(l.supplier).id
        return eid === entityId
      })
      const served = guestsServedByEntity(services, entityId, guests)
      const reqSig = voucherIssueSignature(lines, served, guestDetails)
      const now = new Date().toISOString()
      const existing = current.voucherMeta?.[entityId]
      const version = (existing?.version || 0) + 1
      const recipients = opts.recipientEmails.filter(Boolean)
      if (!recipients.length) {
        return { ok: false, ruleId: 'no-recipient', reason: 'At least one recipient email is required' }
      }
      const tokens: VoucherToken[] = recipients.map((email) => ({
        token: randomVoucherToken(),
        recipientEmail: email,
        createdAt: now,
        expiresAt: voucherTokenExpiry(now, current.travelDateFrom),
        version,
      }))
      const lineIds = lines.map((l) => l.lineId!).filter(Boolean)
      let nextAnswers = stripEntityLineAnswers(current.voucherLineAnswers || {}, lineIds)
      let nextServices = revertEntitySupplierStatus(services, entityId, lineIds)
      const seq = existing?.voucherSeq ?? nextVoucherSeq(current)
      const voucherRef = existing?.voucherRef ?? `${current.reference || current.id} / V${String(seq).padStart(2, '0')}`
      const plannerEmail = `${current.safariPlanner.replace(/\s+/g, '.').toLowerCase()}@chelipeacock.com`

      const sendRecords = tokens.map((token) => {
        const mail = sendVoucherEmail({
          from: voucherFromAddress(),
          cc: [plannerEmail],
          replyTo: plannerEmail,
          to: [token.recipientEmail],
          subject: `Confirmation request — ${getPayableEntity(entityId).legalName} — ${voucherRef}`,
          body: `Please confirm the attached services for ${voucherRef}.`,
          linkUrl: `/voucher-link/${itineraryId}/${encodeURIComponent(entityId)}?t=${token.token}`,
          pdfUrl: `/voucher-doc/${itineraryId}/${encodeURIComponent(entityId)}`,
        })
        return {
          id: `vs-${Date.now()}-${token.token.slice(0, 4)}`,
          recipient: token.recipientEmail,
          sentAt: mail.sentAt,
          deliveryStatus: mail.deliveryStatus,
          token: token.token,
          expiresAt: token.expiresAt,
          via: (existing?.issued ? 'reissue' : 'issue') as 'issue' | 'resend' | 'reissue',
          from: voucherFromAddress(),
          cc: [plannerEmail],
          replyTo: plannerEmail,
          messageId: mail.messageId,
        }
      })

      const nextMeta: VoucherMeta = {
        issued: true,
        issuedAt: now,
        issuedTo: recipients,
        voucherRef,
        voucherSeq: seq,
        kind: opts.kind || existing?.kind || 'standard',
        requirementsSignature: reqSig,
        contentSignature: reqSig,
        tokens: [...(existing?.tokens || []).map((t) => ({ ...t, supersededAt: t.supersededAt || now })), ...tokens],
        resendCount: existing?.resendCount || 0,
        version,
        note: opts.note ?? existing?.note,
        supplierBookingRef: opts.supplierBookingRef ?? existing?.supplierBookingRef,
        sendHistory: [...(existing?.sendHistory || []), ...sendRecords],
        issuingPlannerEmail: plannerEmail,
        submittedAt: undefined,
        submittedVia: undefined,
        submittedByEmail: undefined,
        submittedByName: undefined,
        chaseSchedule: { nextAt: new Date(Date.now() + 86400000).toISOString(), sentCount: 0 },
      }

      const lifecycleLog = appendLifecycleEntry(current.lifecycleLog, {
        actor: demoRole,
        from: current.status,
        to: current.status,
        category: 'voucher-send',
        entityId,
        label: existing?.issued ? 'Voucher re-issued' : 'Voucher issued',
        detail: `${recipients.join(', ')} · ${voucherRef}`,
      })

      setServicesStorage(itineraryId, nextServices)
      upsertItineraryStorage({
        ...current,
        supplierVouchers: resetSupplierVoucherRollup(current.supplierVouchers || {}, entityId),
        voucherLineAnswers: nextAnswers,
        voucherMeta: { ...(current.voucherMeta || {}), [entityId]: nextMeta },
        lifecycleLog,
        updatedAt: now,
      })
      bump()
      return { ok: true }
    },
    [bump, demoRole],
  )

  const resendSupplierVoucher = useCallback(
    (itineraryId: string, entityKey: string): GateResult => {
      if (!roleAllowsVoucherAction(demoRole, 'resend')) {
        return { ok: false, ruleId: 'role-denied', reason: `Role ${demoRole} cannot resend vouchers` }
      }
      const current = migratedList().find((it) => it.id === itineraryId)
      if (!current) return { ok: false, ruleId: 'missing', reason: 'Itinerary not found' }
      const entityId = resolveEntityId(entityKey)
      const meta = current.voucherMeta?.[entityId]
      if (!meta?.issued) return { ok: false, ruleId: 'not-issued', reason: 'Issue the voucher before resending it' }
      const now = new Date().toISOString()
      if (meta.lastResendAt && new Date(now).getTime() - new Date(meta.lastResendAt).getTime() < 3600000) {
        return { ok: false, ruleId: 'resend-rate-limited', reason: 'Resend is capped at once per hour per voucher' }
      }
      const recipient = meta.issuedTo[0] || supplierEmailFor(entityId)
      const token: VoucherToken = {
        token: randomVoucherToken(),
        recipientEmail: recipient,
        createdAt: now,
        expiresAt: voucherTokenExpiry(now, current.travelDateFrom),
        version: meta.version,
      }
      const mail = sendVoucherEmail({
        from: voucherFromAddress(),
        cc: [meta.issuingPlannerEmail || 'planner@chelipeacock.com'],
        replyTo: meta.issuingPlannerEmail || 'planner@chelipeacock.com',
        to: [recipient],
        subject: `Confirmation request (resent) — ${meta.voucherRef || entityId}`,
        body: 'Your confirmation link has been refreshed.',
        linkUrl: `/voucher-link/${itineraryId}/${encodeURIComponent(entityId)}?t=${token.token}`,
        pdfUrl: `/voucher-doc/${itineraryId}/${encodeURIComponent(entityId)}`,
      })
      const sendRecord = {
        id: `vs-${Date.now()}`,
        recipient,
        sentAt: mail.sentAt,
        deliveryStatus: mail.deliveryStatus,
        token: token.token,
        expiresAt: token.expiresAt,
        via: 'resend' as const,
        from: voucherFromAddress(),
        cc: [meta.issuingPlannerEmail || 'planner@chelipeacock.com'],
        replyTo: meta.issuingPlannerEmail || 'planner@chelipeacock.com',
        messageId: mail.messageId,
      }
      const nextMeta: VoucherMeta = {
        ...meta,
        tokens: [...meta.tokens.map((t) => ({ ...t, supersededAt: t.supersededAt || now })), token],
        resendCount: meta.resendCount + 1,
        lastResendAt: now,
        sendHistory: appendSendRecord(meta, sendRecord),
      }
      const lifecycleLog = appendLifecycleEntry(current.lifecycleLog, {
        actor: demoRole,
        from: current.status,
        to: current.status,
        category: 'voucher-send',
        entityId,
        label: 'Voucher resent',
        detail: recipient,
      })
      upsertItineraryStorage({
        ...current,
        voucherMeta: { ...(current.voucherMeta || {}), [entityId]: nextMeta },
        lifecycleLog,
        updatedAt: now,
      })
      bump()
      return { ok: true }
    },
    [bump, demoRole],
  )

  const requestLatestVoucher = useCallback(
    (itineraryId: string, entityKey: string, opts?: { token?: string; recipientEmail?: string }): GateResult => {
      const current = migratedList().find((it) => it.id === itineraryId)
      if (!current) return { ok: false, ruleId: 'missing', reason: 'Itinerary not found' }
      const entityId = resolveEntityId(entityKey)
      const meta = current.voucherMeta?.[entityId]
      if (!meta?.issued) return { ok: false, ruleId: 'not-issued', reason: 'Voucher not issued' }
      const now = new Date().toISOString()
      const notification = {
        id: `pn-${Date.now()}`,
        at: now,
        kind: 'request_latest' as const,
        entityId,
        message: `Supplier${opts?.recipientEmail ? ` (${opts.recipientEmail})` : ''} requested the latest voucher version.`,
      }
      const nextMeta: VoucherMeta = {
        ...meta,
        plannerNotifications: [...(meta.plannerNotifications || []), notification],
      }
      upsertItineraryStorage({
        ...current,
        voucherMeta: { ...(current.voucherMeta || {}), [entityId]: nextMeta },
        updatedAt: now,
      })
      bump()
      return { ok: true }
    },
    [bump],
  )

  const submitVoucherAnswers = useCallback(
    (
      itineraryId: string,
      entityKey: string,
      input: {
        lines: VoucherLineInput[]
        ticks: Record<string, boolean>
        reasons: Record<string, string>
        via: 'link' | 'staff' | 'acknowledge'
        token?: string
        courtesyName?: string
        userAgent?: string
      },
    ): GateResult & { depositGuardCount?: number } => {
      const current = migratedList().find((it) => it.id === itineraryId)
      if (!current) return { ok: false, ruleId: 'missing', reason: 'Itinerary not found' }
      const entityId = resolveEntityId(entityKey)
      const meta = current.voucherMeta?.[entityId]
      if (!meta?.issued) {
        return { ok: false, ruleId: 'not-issued', reason: 'This voucher has not been issued yet' }
      }

      let recipientEmail: string | undefined
      if (input.via === 'link') {
        const tokenState = evaluateVoucherToken(meta, input.token, new Date().toISOString())
        if (tokenState.state !== 'ok') {
          return { ok: false, ruleId: `token-${tokenState.state}`, reason: 'This confirmation link is no longer valid' }
        }
        recipientEmail = tokenState.recipientEmail
      } else if (input.via === 'staff') {
        if (!roleAllowsVoucherAction(demoRole, 'recordOnBehalf')) {
          return { ok: false, ruleId: 'role-denied', reason: `Role ${demoRole} cannot record a supplier reply` }
        }
      } else if (input.via === 'acknowledge') {
        if (meta.kind !== 'cancellation_only') {
          return { ok: false, ruleId: 'not-cancellation', reason: 'Acknowledge is only for cancellation-only vouchers' }
        }
      }

      const services = getServicesStorage(itineraryId)
      const now = new Date().toISOString()
      let result = {
        services,
        supplierVouchers: current.supplierVouchers || {},
        voucherLineAnswers: current.voucherLineAnswers || {},
        depositGuardLineIds: [] as string[],
      }

      if (input.via === 'acknowledge') {
        result.supplierVouchers = { ...result.supplierVouchers, [entityId]: 'Confirmed' }
      } else {
        result = applyVoucherLineSubmit(
          services,
          current.supplierVouchers || {},
          current.voucherLineAnswers || {},
          entityId,
          input.lines,
          input.ticks,
          input.reasons,
          now,
        )
      }

      setServicesStorage(itineraryId, result.services)
      const nextTokens =
        input.via === 'link' && input.token
          ? meta.tokens.map((t) =>
              t.token === input.token ? { ...t, usedAt: now } : meta.submittedAt ? { ...t, usedAt: t.usedAt || now } : t,
            )
          : meta.tokens

      const heldCount = input.lines.filter((l) => input.ticks[l.lineId] !== false).length
      const rejectedReasons = input.lines
        .filter((l) => input.ticks[l.lineId] === false)
        .map((l) => input.reasons[l.lineId])
        .filter(Boolean) as string[]

      const answerRecord = buildAnswerRecord({
        at: now,
        actorType: input.via === 'link' ? 'supplier-link' : input.via === 'acknowledge' ? 'acknowledge' : 'staff',
        actorEmail: recipientEmail,
        tokenId: input.token,
        userAgent: input.userAgent,
        courtesyName: input.courtesyName,
        lines: input.lines,
        ticks: input.ticks,
        reasons: input.reasons,
        answers: result.voucherLineAnswers,
      })

      const nextMeta: VoucherMeta = {
        ...meta,
        tokens: nextTokens,
        submittedAt: now,
        submittedVia: input.via,
        submittedByEmail: recipientEmail,
        submittedByName: input.courtesyName,
        answerHistory: [...(meta.answerHistory || []), answerRecord],
        plannerNotifications:
          input.via === 'link'
            ? routePlannerNotifications(meta, entityId, heldCount, input.lines.length, rejectedReasons)
            : meta.plannerNotifications,
      }

      const lifecycleLog = appendLifecycleEntry(current.lifecycleLog, {
        actor: input.via === 'link' ? recipientEmail || 'supplier' : demoRole,
        from: current.status,
        to: current.status,
        category: input.via === 'link' ? 'supplier-link' : 'voucher-staff',
        entityId,
        label: input.via === 'acknowledge' ? 'Cancellation acknowledged' : 'Supplier voucher answer recorded',
        detail: `${heldCount} of ${input.lines.length} lines held`,
      })

      upsertItineraryStorage({
        ...current,
        supplierVouchers: result.supplierVouchers,
        voucherLineAnswers: result.voucherLineAnswers,
        voucherMeta: { ...(current.voucherMeta || {}), [entityId]: nextMeta },
        lifecycleLog,
        updatedAt: now,
      })
      bump()
      return { ok: true, depositGuardCount: result.depositGuardLineIds.length }
    },
    [bump, demoRole],
  )

  const clearVoucherReply = useCallback(
    (itineraryId: string, entityKey: string): GateResult => {
      if (!roleAllowsVoucherAction(demoRole, 'recordOnBehalf')) {
        return { ok: false, ruleId: 'role-denied', reason: `Role ${demoRole} cannot clear a supplier reply` }
      }
      const current = migratedList().find((it) => it.id === itineraryId)
      if (!current) return { ok: false, ruleId: 'missing', reason: 'Itinerary not found' }
      const entityId = resolveEntityId(entityKey)
      const meta = current.voucherMeta?.[entityId]
      if (!meta?.submittedAt) return { ok: false, ruleId: 'not-submitted', reason: 'No recorded reply to clear' }
      const nextMeta: VoucherMeta = {
        ...meta,
        submittedAt: undefined,
        submittedVia: undefined,
        submittedByEmail: undefined,
        submittedByName: undefined,
      }
      const lifecycleLog = appendLifecycleEntry(current.lifecycleLog, {
        actor: demoRole,
        from: current.status,
        to: current.status,
        category: 'voucher-staff',
        entityId,
        label: 'Recorded supplier reply cleared',
      })
      upsertItineraryStorage({
        ...current,
        voucherMeta: { ...(current.voucherMeta || {}), [entityId]: nextMeta },
        lifecycleLog,
        updatedAt: new Date().toISOString(),
      })
      bump()
      return { ok: true }
    },
    [bump, demoRole],
  )

  const moveServiceLineBetweenItineraries = useCallback(
    (fromId: string, toId: string, serviceId: string): GateResult => {
      if (!roleAllowsVoucherAction(demoRole, 'issue')) {
        return { ok: false, ruleId: 'role-denied', reason: `Role ${demoRole} cannot move vouchered lines` }
      }
      const fromIt = migratedList().find((it) => it.id === fromId)
      const toIt = migratedList().find((it) => it.id === toId)
      if (!fromIt || !toIt) return { ok: false, ruleId: 'missing', reason: 'Itinerary not found' }
      const fromServices = getServicesStorage(fromId)
      const svc = fromServices.find((s) => s.id === serviceId)
      if (!svc) return { ok: false, ruleId: 'no-service', reason: 'Service not found on source' }
      const entityId = payableEntityIdOf(svc)
      const lineIds = Object.keys(fromIt.voucherLineAnswers || {}).filter((lid) => lid.startsWith(`${serviceId}#`))
      const wasHeld = lineIds.some((lid) => fromIt.voucherLineAnswers?.[lid]?.outcome === 'held')
      const sourceAnswered = !!fromIt.voucherMeta?.[entityId]?.submittedAt

      const nextFromServices = fromServices.filter((s) => s.id !== serviceId)
      const toServices = [...getServicesStorage(toId), { ...svc, supplierStatus: 'Waiting' as const }]
      setServicesStorage(fromId, nextFromServices)
      setServicesStorage(toId, toServices)

      let nextFromAnswers = { ...(fromIt.voucherLineAnswers || {}) }
      for (const lid of lineIds) delete nextFromAnswers[lid]

      const followUps = [...(fromIt.mandatoryFollowUps || [])]
      if (wasHeld || sourceAnswered) {
        const remainingLines = linesFromServices(nextFromServices, partyGuests(fromIt, getGuestDetailsStorage(fromId))).filter(
          (l) => (l.payableEntityId || '') === entityId,
        )
        followUps.push({
          id: `mf-${Date.now()}`,
          kind: remainingLines.length ? 'source_reissue' : 'source_cancellation',
          entityId,
          fromItineraryId: fromId,
          toItineraryId: toId,
          lineIds,
          formerSourceRef: fromIt.reference,
          status: 'open',
          createdAt: new Date().toISOString(),
        })
        followUps.push({
          id: `mf-${Date.now()}-dest`,
          kind: 'destination_issue',
          entityId,
          fromItineraryId: fromId,
          toItineraryId: toId,
          lineIds,
          formerSourceRef: fromIt.reference,
          status: 'open',
          createdAt: new Date().toISOString(),
        })
      }

      upsertItineraryStorage({ ...fromIt, voucherLineAnswers: nextFromAnswers, mandatoryFollowUps: followUps, updatedAt: new Date().toISOString() })
      upsertItineraryStorage({
        ...toIt,
        mandatoryFollowUps: [...(toIt.mandatoryFollowUps || []), ...followUps.filter((f) => f.toItineraryId === toId)],
        updatedAt: new Date().toISOString(),
      })
      bump()
      return { ok: true }
    },
    [bump, demoRole],
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
      getQuotes,
      generateQuote,
      getInvoice,
      generateInvoice,
      removeItinerary,
      getServices,
      saveServices,
      confirmServiceLine,
      resetServiceLine,
      cancelServiceLine,
      removeServiceLine,
      issueSupplierVoucher,
      resendSupplierVoucher,
      requestLatestVoucher,
      submitVoucherAnswers,
      clearVoucherReply,
      moveServiceLineBetweenItineraries,
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
      getQuotes,
      generateQuote,
      getInvoice,
      generateInvoice,
      removeItinerary,
      getServices,
      saveServices,
      confirmServiceLine,
      resetServiceLine,
      cancelServiceLine,
      removeServiceLine,
      issueSupplierVoucher,
      resendSupplierVoucher,
      requestLatestVoucher,
      submitVoucherAnswers,
      clearVoucherReply,
      moveServiceLineBetweenItineraries,
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
