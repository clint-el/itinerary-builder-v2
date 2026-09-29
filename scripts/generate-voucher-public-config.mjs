/**
 * Writes public/sol-voucher-mail.json at build time so Amplify (and other hosts)
 * can enable Resend without relying on import.meta.env.DEV.
 *
 * Amplify Console: set server secrets on Lambda; for the static app set:
 *   VOUCHER_MAIL=resend
 *   VOUCHER_MAIL_API_URL=https://<your-lambda-function-url>/
 * Optional mirrors: VITE_VOUCHER_MAIL, VITE_VOUCHER_MAIL_API
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: join(root, '.env') })

const explicitMode =
  process.env.VOUCHER_MAIL?.trim() ||
  process.env.VITE_VOUCHER_MAIL?.trim() ||
  ''

const apiUrl =
  process.env.VOUCHER_MAIL_API_URL?.trim() ||
  process.env.VITE_VOUCHER_MAIL_API?.trim() ||
  '/api/voucher-mail'

/** Enable API sends when explicitly requested or when a non-default API URL is set. */
let mode = explicitMode
if (!mode) {
  if (apiUrl !== '/api/voucher-mail') mode = 'resend'
  else if (process.env.RESEND_API_KEY?.trim()) mode = 'resend'
  else mode = 'stub'
}

const outPath = join(root, 'public', 'sol-voucher-mail.json')
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(
  outPath,
  `${JSON.stringify({ mode, apiUrl }, null, 2)}\n`,
  'utf8',
)

console.info('[sol-voucher-mail] wrote public config:', { mode, apiUrl: mode === 'resend' ? apiUrl : '(stub)' })
