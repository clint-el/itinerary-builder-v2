import type { Connect } from 'vite'
import { handleVoucherMailPost, type VoucherMailEnv } from './voucherMailHandler.js'
import { handleVoucherSessionGet, handleVoucherSessionPut } from './voucherSessionHandlers.js'

export function createVoucherMailMiddleware(env: VoucherMailEnv = readEnv()): Connect.NextHandleFunction {
  return (req, res, next) => {
    const parsed = new URL(req.url || '/', 'http://localhost')
    const path = parsed.pathname

    if (path !== '/api/voucher-mail' && path !== '/api/voucher-session') {
      next()
      return
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }

    if (path === '/api/voucher-session') {
      if (req.method === 'GET') {
        void handleVoucherSessionGet(req, res, parsed)
        return
      }
      if (req.method === 'PUT') {
        void handleVoucherSessionPut(req, res)
        return
      }
      res.statusCode = 405
      res.setHeader('Allow', 'GET, PUT, OPTIONS')
      res.end()
      return
    }

    if (req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('Allow', 'POST, OPTIONS')
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
