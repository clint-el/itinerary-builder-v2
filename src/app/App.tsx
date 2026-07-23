import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { StoreProvider } from '@/app/store'
import { AppShell } from '@/app/AppShell'
import { BuilderPage } from '@/features/builder/BuilderPage'
import { InquiriesPage } from '@/features/inquiries/InquiriesPage'
import { QuotePage } from '@/features/quote/QuotePage'
import { SummaryPage } from '@/features/summary/SummaryPage'

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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  )
}

export default App
