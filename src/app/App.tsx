import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { StoreProvider } from '@/app/store'
import { AppShell } from '@/app/AppShell'
import { BuilderPage } from '@/features/builder/BuilderPage'
import { InquiriesPage } from '@/features/inquiries/InquiriesPage'
import { QuotePage } from '@/features/quote/QuotePage'
import { QuoteDocPage } from '@/features/quote-doc/QuoteDocPage'
import { SummaryPage } from '@/features/summary/SummaryPage'
import { VoucherDocPage } from '@/features/voucher-doc/VoucherDocPage'
import { VoucherLinkPage } from '@/features/voucher-link/VoucherLinkPage'

export function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<InquiriesPage />} />
          </Route>
          <Route path="/build/:id" element={<BuilderPage />} />
          <Route path="/quote/:id" element={<QuotePage />} />
          <Route path="/summary/:id" element={<SummaryPage />} />
          <Route path="/quote-doc/:id" element={<QuoteDocPage />} />
          <Route path="/voucher-doc/:id/:supplier" element={<VoucherDocPage />} />
          <Route path="/voucher-link/:id/:supplier" element={<VoucherLinkPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  )
}

export default App
