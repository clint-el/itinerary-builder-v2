import type { CatalogItem, PayableEntity } from './types'

/** Mock payable legal entities — PR-F02 grouping key (D-09). */
export const PAYABLE_ENTITIES: PayableEntity[] = [
  { id: 'pe-hemingways-ke', legalName: 'Hemingways Collection Ltd', reservationEmail: 'reservations@hemingwayscollection.com', headOffice: 'Nairobi, Kenya' },
  { id: 'pe-elewana-ke', legalName: 'Elewana Kenya Ltd', reservationEmail: 'reservations@elewanacollection.com', headOffice: 'Nairobi, Kenya' },
  { id: 'pe-elewana-tz', legalName: 'Elewana Tanzania Ltd', reservationEmail: 'reservations@elewanacollection.com', headOffice: 'Arusha, Tanzania' },
  { id: 'pe-airkenya', legalName: 'AirKenya Aviation Ltd', reservationEmail: 'reservations@airkenya.com', headOffice: 'Nairobi, Kenya' },
  { id: 'pe-auric-tz', legalName: 'Auric Air Services Ltd', reservationEmail: 'reservations@auricair.com', headOffice: 'Arusha, Tanzania' },
  { id: 'pe-cheli-peacock', legalName: 'Cheli & Peacock Safaris Ltd', reservationEmail: 'reservations@chelipeacock.com', headOffice: 'Nairobi, Kenya' },
  { id: 'pe-serena', legalName: 'Serena Hotels Kenya Ltd', reservationEmail: 'reservations@serenahotels.com', headOffice: 'Nairobi, Kenya' },
  { id: 'pe-governors', legalName: "Governors' Camp Collection Ltd", reservationEmail: 'reservations@governorscamp.com', headOffice: 'Nairobi, Kenya' },
  { id: 'pe-aa-lodges', legalName: 'AA Lodges Kenya Ltd', reservationEmail: 'reservations@aaldoges.com', headOffice: 'Nairobi, Kenya' },
  { id: 'pe-wilder-ke', legalName: 'Wilder Group Kenya Ltd', reservationEmail: 'reservations@wildergroup.com', headOffice: 'Nairobi, Kenya' },
  { id: 'pe-bushtops', legalName: 'Bushtops Kenya Ltd', reservationEmail: 'reservations@bushtops.com', headOffice: 'Nairobi, Kenya' },
  { id: 'pe-mara-route', legalName: 'Mara Route Safaris Ltd', reservationEmail: 'reservations@mararoute.com', headOffice: 'Nairobi, Kenya' },
  { id: 'pe-citylink', legalName: 'CityLink Transfers Ltd', reservationEmail: 'reservations@citylink.co.ke', headOffice: 'Nairobi, Kenya' },
  { id: 'pe-safarilink', legalName: 'Safarilink Aviation Ltd', reservationEmail: 'reservations@safarilink.co.ke', headOffice: 'Nairobi, Kenya' },
  { id: 'pe-coastal', legalName: 'Coastal Aviation Ltd', reservationEmail: 'reservations@coastal.co.tz', headOffice: 'Nairobi, Kenya' },
  { id: 'pe-amref', legalName: 'AMREF Flying Doctors', reservationEmail: 'reservations@amref.org', headOffice: 'Nairobi, Kenya' },
  { id: 'pe-umbato', legalName: 'Umbato Services Ltd', reservationEmail: 'reservations@umbato.com', headOffice: 'Nairobi, Kenya' },
  { id: 'pe-independent', legalName: 'Independent Supplier', reservationEmail: 'reservations@supplier.com', headOffice: 'Nairobi, Kenya' },
]

const ENTITY_BY_ID = new Map(PAYABLE_ENTITIES.map((e) => [e.id, e]))

/** Catalog row → payable entity (group + headOffice). */
const CATALOG_ENTITY: Record<string, string> = {
  Hemingways: 'pe-hemingways-ke',
  Elewana: '', // resolved by headOffice below
  AirKenya: 'pe-airkenya',
  'Auric Air': 'pe-auric-tz',
  'Cheli & Peacock': 'pe-cheli-peacock',
  Serena: 'pe-serena',
  Governors: 'pe-governors',
  'AA Lodges': 'pe-aa-lodges',
  Wilder: 'pe-wilder-ke',
  Bushtops: 'pe-bushtops',
  'Mara Route': 'pe-mara-route',
  CityLink: 'pe-citylink',
  Safarilink: 'pe-safarilink',
  'Coastal Aviation': 'pe-coastal',
  AMREF: 'pe-amref',
  Umbato: 'pe-umbato',
  Independent: 'pe-independent',
}

export function getPayableEntity(id: string): PayableEntity {
  return (
    ENTITY_BY_ID.get(id) ?? {
      id,
      legalName: id.replace(/^pe-/, '').replace(/-/g, ' '),
      reservationEmail: supplierEmailFromSlug(id),
    }
  )
}

function supplierEmailFromSlug(id: string): string {
  const slug = id.replace(/^pe-/, '').replace(/-/g, '')
  return `reservations@${slug || 'supplier'}.com`
}

/** Resolve entity from catalog pick. */
export function payableEntityForCatalogItem(item: CatalogItem): PayableEntity {
  if (item.group === 'Elewana') {
    const id = item.headOffice.includes('Tanzania') ? 'pe-elewana-tz' : 'pe-elewana-ke'
    return getPayableEntity(id)
  }
  const mapped = CATALOG_ENTITY[item.group]
  if (mapped) return getPayableEntity(mapped)
  return getPayableEntity('pe-independent')
}

/** Resolve entity from display supplier name (legacy / quote fallback). */
export function payableEntityFromSupplierName(supplierName: string): PayableEntity {
  const n = supplierName.toLowerCase()
  if (n.includes('hemingways')) return getPayableEntity('pe-hemingways-ke')
  if (n.includes('elewana') && (n.includes('serengeti') || n.includes('ngorongoro') || n.includes('manor'))) {
    return getPayableEntity('pe-elewana-tz')
  }
  if (n.includes('elewana')) return getPayableEntity('pe-elewana-ke')
  if (n.includes('airkenya')) return getPayableEntity('pe-airkenya')
  if (n.includes('auric')) return getPayableEntity('pe-auric-tz')
  if (n.includes('cheli') || n.includes('peacock')) return getPayableEntity('pe-cheli-peacock')
  if (n.includes('serena')) return getPayableEntity('pe-serena')
  if (n.includes('governor')) return getPayableEntity('pe-governors')
  if (n.includes('ol tukai') || n.includes('aa lodge')) return getPayableEntity('pe-aa-lodges')
  if (n.includes('wilder')) return getPayableEntity('pe-wilder-ke')
  if (n.includes('bushtops')) return getPayableEntity('pe-bushtops')
  if (n.includes('mara route')) return getPayableEntity('pe-mara-route')
  if (n.includes('citylink') || n.includes('city tour')) return getPayableEntity('pe-citylink')
  if (n.includes('safarilink')) return getPayableEntity('pe-safarilink')
  if (n.includes('coastal')) return getPayableEntity('pe-coastal')
  if (n.includes('amref')) return getPayableEntity('pe-amref')
  if (n.includes('umbato')) return getPayableEntity('pe-umbato')
  const slug = supplierName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)
  return { id: `pe-legacy-${slug}`, legalName: supplierName, reservationEmail: supplierEmailFromSlug(slug) }
}

/** Demo reservations email — prefers entity reservation email. */
export function reservationEmailFor(entity: PayableEntity): string {
  return entity.reservationEmail || supplierEmailFromSlug(entity.id)
}
