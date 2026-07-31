import { NavLink } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

const links = [
  { to: '/', label: 'Database', icon: '/assets/fi_1849616.svg' },
  { to: '/', label: 'Inquiries', icon: '/assets/fi_2345049.svg', active: true },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col overflow-hidden border-r border-[#E5E7EB] bg-white transition-[width] duration-200 ease-out',
        collapsed ? 'w-16' : 'w-20',
      )}
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <div className="flex h-22.5 shrink-0 flex-col items-center justify-center gap-1.5 border-b border-[#E5E7EB] px-2">
        <button
          type="button"
          onClick={onToggle}
          title="Toggle sidebar"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-[#931115]/30"
        >
          <img src="/assets/sol-logo.svg" alt="SOL" className="block h-auto w-8.5" />
        </button>
        {!collapsed ? (
          <div className="text-[15px] font-bold leading-none tracking-[1.5px] text-[#931115]">SOL</div>
        ) : null}
      </div>

      <nav className={cn('flex flex-1 flex-col gap-2 py-4', collapsed ? 'px-2' : 'px-3')}>
        {links.map((link) => (
          <NavLink
            key={link.label}
            to={link.to}
            title={link.label}
            aria-current={link.active ? 'page' : undefined}
            className={cn(
              'flex min-h-14.5 items-center justify-center rounded-xl text-center font-semibold leading-[1.2] text-[#171717] no-underline transition-colors hover:bg-[#F7F7F8]',
              collapsed ? 'px-1 py-2' : 'flex-col gap-1.5 px-0.5 py-2.5 text-xs',
              link.active && 'bg-[#F3F4F6] hover:bg-[#F3F4F6]',
            )}
          >
            <img src={link.icon} alt="" className={cn('shrink-0', collapsed ? 'size-7' : 'size-7.5')} />
            {!collapsed ? <span>{link.label}</span> : <span className="sr-only">{link.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className={cn('shrink-0 pb-4', collapsed ? 'px-2' : 'px-3')}>
        <button
          type="button"
          title="Settings"
          className={cn(
            'flex w-full min-h-14.5 items-center justify-center rounded-xl bg-transparent text-center font-semibold leading-[1.2] text-[#171717] transition-colors hover:bg-[#F7F7F8]',
            collapsed ? 'px-1 py-2' : 'flex-col gap-1.5 px-0.5 py-2.5 text-xs',
          )}
        >
          <Settings aria-hidden="true" className={cn('shrink-0 text-[#B0171B]', collapsed ? 'size-7' : 'size-7.5')} strokeWidth={1.35} />
          {!collapsed ? <span>Settings</span> : <span className="sr-only">Settings</span>}
        </button>
      </div>
    </aside>
  )
}
