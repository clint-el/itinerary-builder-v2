export type VoucherMailPublicConfig = {
  mode: 'resend' | 'stub' | string
  apiUrl: string
}

let cached: VoucherMailPublicConfig | null = null
let loadPromise: Promise<VoucherMailPublicConfig> | null = null

function fromViteEnv(): VoucherMailPublicConfig {
  const mode = (import.meta.env.VITE_VOUCHER_MAIL as string | undefined)?.trim() || 'stub'
  const apiUrl = (import.meta.env.VITE_VOUCHER_MAIL_API as string | undefined)?.trim() || '/api/voucher-mail'
  return { mode, apiUrl }
}

/** Runtime config from build-generated JSON (Amplify) merged with Vite env. */
export async function getVoucherMailPublicConfig(): Promise<VoucherMailPublicConfig> {
  if (cached) return cached
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const base = fromViteEnv()
    try {
      const res = await fetch('/sol-voucher-mail.json', { cache: 'no-store' })
      if (res.ok) {
        const json = (await res.json()) as Partial<VoucherMailPublicConfig>
        cached = {
          mode: json.mode?.trim() || base.mode,
          apiUrl: json.apiUrl?.trim() || base.apiUrl,
        }
        return cached
      }
    } catch {
      /* offline / tests */
    }
    cached = base
    return cached
  })()

  return loadPromise
}

export function resetVoucherMailConfigCacheForTests() {
  cached = null
  loadPromise = null
}

export async function shouldUseResendApi(): Promise<boolean> {
  const cfg = await getVoucherMailPublicConfig()
  if (cfg.mode === 'stub') return false
  if (cfg.mode === 'resend') return true
  if (import.meta.env.DEV && cfg.mode !== 'stub') return true
  return false
}

export async function voucherMailApiUrl(): Promise<string> {
  const cfg = await getVoucherMailPublicConfig()
  return cfg.apiUrl || '/api/voucher-mail'
}
