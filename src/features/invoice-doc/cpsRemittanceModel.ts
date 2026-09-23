export type CpsBankAccount = {
  country: string
  accountName: string
  bankLines: string[]
  accountNumber: string
  swiftCode: string
  correspondentName?: string
  correspondentAccount?: string
  correspondentSwift?: string
  taxLines?: string[]
}

export type CpsOffice = {
  country: string
  addressLines: string[]
  email: string
  phones: string[]
}

export const CPS_BANK_ACCOUNTS: CpsBankAccount[] = [
  {
    country: 'Kenya',
    accountName: 'Cheli & Peacock',
    bankLines: [
      'Absa Bank Kenya Plc',
      'Payments and International Services Centre',
      'Bunyala Road Branch',
      'P. O. Box 72058, Nairobi, 00200, Kenya',
    ],
    accountNumber: '0228538914',
    swiftCode: 'BARCKENX',
    correspondentName: 'CITI Bank New York',
    correspondentSwift: 'CITIUS33',
    taxLines: ['PIN No. P000599244G'],
  },
  {
    country: 'Tanzania',
    accountName: 'Cheli & Peacock Safaris (T) Ltd.',
    bankLines: ['Absa Bank Tanzania Limited', 'P. O. Box 14652, Arusha, Tanzania'],
    accountNumber: '0028006217',
    swiftCode: 'BARCTZTZ',
    correspondentName: 'JPMorgan Chase Bank N.A',
    correspondentAccount: '826214244',
    correspondentSwift: 'CHASUS33',
    taxLines: ['TIN No. 122-453-731', 'V.R.N. No. 40-023953-I'],
  },
  {
    country: 'Rwanda',
    accountName: 'Cheli & Peacock Safaris Rwanda Ltd.',
    bankLines: ['I&M Bank Rwanda PLC', 'Kigali, Rwanda'],
    accountNumber: '20041203001',
    swiftCode: 'IMRWRWRWXXX',
    correspondentName: 'CITI Bank New York',
    correspondentAccount: '36205171',
    correspondentSwift: 'CITIUS33',
    taxLines: ['TIN No. 107721702'],
  },
]

export const CPS_OFFICES: CpsOffice[] = [
  {
    country: 'Kenya',
    addressLines: [
      '171 Brookside Drive, The Piano, Westlands, Nairobi',
      'P.O. Box 743, Uhuru Gardens, Nairobi, Kenya, 00517',
    ],
    email: 'info@chelipeacock.com',
    phones: ['+254 730 721 000'],
  },
  {
    country: 'Rwanda',
    addressLines: ['Kigali Alliance Business Centre', 'KN 5 RD, Block B, First Floor, Kigali, Rwanda'],
    email: 'info@chelipeacock.com',
    phones: ['+250 788 317 757'],
  },
  {
    country: 'Tanzania',
    addressLines: ['Sopa Plaza 99, Serengeti Road', 'P.O. Box 1246, Arusha, Tanzania'],
    email: 'info@chelipeacock.com',
    phones: ['+255 764 039 900', 'Office Mobile — +255 762 784 565'],
  },
]

/** Bank remittance (2 pages) + office details — appended to every invoice. */
export const CPS_REMITTANCE_PAGE_COUNT = 2

export function remittanceStartPage(isPackaged: boolean, showTerms: boolean): number {
  if (isPackaged) return showTerms ? 5 : 4
  return showTerms ? 6 : 5
}
