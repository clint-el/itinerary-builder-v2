import type { Connect } from 'vite'
import { handleVoucherMailPost, type VoucherMailEnv } from './voucherMailHandler.js'

export function createVoucherMailMiddleware(env: VoucherMailEnv = readEnv()): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = req.url?.split('?')[0]
    if (url !== '/api/voucher-mail') {
      next()
      return
    }
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('Allow', 'POST')
      res.end()
      return
    }
    void handleVoucherMailPost(req, res, env)
  }
}

function readEnv(): VoucherMailEnv {
  return {
    resendApiKey: process.env.RESEND_API_KEY,
    appOrigin: process.env.APP_ORIGIN,
    voucherFrom: process.env.VOUCHER_FROM,
  }
}
