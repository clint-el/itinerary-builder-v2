import { NavLink } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'

const links = [
  { to: '/', label: 'Database', icon: '/assets/fi_1849616.svg', end: true },
  { to: '/', label: 'Inquiries', icon: '/assets/fi_2345049.svg', end: true, highlight: true },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r border-[#E5E7EB] bg-white transition-[width] duration-200',
        collapsed ? 'w-20' : 'w-[200px]',
      )}
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <div
        className={cn(
          'flex flex-col gap-2 border-b border-[#E5E7EB] py-5',
          collapsed ? 'items-center px-2' : 'items-start px-4',
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          title="Toggle sidebar"
          className="flex cursor-pointer items-center justify-center border-0 bg-transparent p-0"
        >
          <img src="/assets/sol-logo.svg" alt="SOL" className="block h-auto w-[34px]" />
        </button>
        {!collapsed ? (
          <div className="text-[15px] font-bold tracking-[1.5px] text-[#931115]">SOL</div>
        ) : null}
      </div>

      <nav className="flex flex-1 flex-col gap-2 p-3">
        {links.map((link) => (
          <NavLink
            key={link.label}
            to={link.to}
            end={link.end}
            title={link.label}
            className={({ isActive }) =>
              cn(
                'flex items-center rounded-lg font-semibold text-[#171717] no-underline',
                collapsed
                  ? 'justify-center px-1 py-2.5'
                  : 'gap-3 px-3 py-2.5 text-sm',
                (isActive || link.highlight) && 'bg-[#F3F4F6]',
              )
            }
          >
            <img src={link.icon} alt="" className="h-5 w-5 shrink-0" />
            {!collapsed ? <span>{link.label}</span> : <span className="sr-only">{link.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="p-3">
        <div
          title="Settings"
          className={cn(
            'flex items-center rounded-lg font-semibold text-[#171717]',
            collapsed ? 'justify-center px-1 py-2.5' : 'gap-3 px-3 py-2.5 text-sm',
          )}
        >
          <img src="/assets/fi_2344225.svg" alt="" className="h-5 w-5 shrink-0" />
          {!collapsed ? <span>Settings</span> : <span className="sr-only">Settings</span>}
        </div>
      </div>
    </aside>
  )
}
