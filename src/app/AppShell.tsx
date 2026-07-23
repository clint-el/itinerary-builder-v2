import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, useOutletContext } from 'react-router-dom'
import { Sidebar } from '@/shared/ui/Sidebar'

const STORAGE_KEY = 'sol-demo-sidebar-collapsed'

export type AppShellOutletContext = {
  showProfile: boolean
  setShowProfile: (show: boolean) => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
}

export function useAppShell() {
  return useOutletContext<AppShellOutletContext>()
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState<boolean>(() => readCollapsed())
  const [showProfile, setShowProfile] = useState(true)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  const onToggle = useCallback(() => {
    setCollapsed((c) => !c)
  }, [])

  const setSidebarCollapsed = useCallback((value: boolean) => {
    setCollapsed(value)
  }, [])

  const ctx = useMemo<AppShellOutletContext>(
    () => ({
      showProfile,
      setShowProfile,
      sidebarCollapsed: collapsed,
      setSidebarCollapsed,
    }),
    [showProfile, collapsed, setSidebarCollapsed],
  )

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={onToggle} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#F9FAFB]">
        {showProfile ? (
          <div className="flex h-14 shrink-0 items-center justify-end border-b border-[#E5E7EB] bg-white px-7">
            <div className="flex items-center gap-2.5">
              <div className="flex size-[34px] shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] bg-[#F3F4F6] text-[#A1A1A1]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div className="leading-tight">
                <div className="text-[13px] font-semibold text-[#171717]">Amelia Earhart</div>
                <div className="text-xs text-[#A1A1A1]">a.earhart@cps.com</div>
              </div>
            </div>
          </div>
        ) : null}
        <Outlet context={ctx} />
      </main>
    </div>
  )
}
