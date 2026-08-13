import { DEMO_ROLES } from '@/shared/lib/lifecycleRules'
import type { DemoRole } from '@/shared/lib/types'
import { useStore } from '@/app/store'

/** Floating demo-only role picker so lifecycle / line / voucher AC can be walked without Cognito. */
export function DevRoleBar() {
  const { demoRole, setDemoRole } = useStore()

  return (
    <div className="pointer-events-none fixed bottom-3 left-3 z-[200] flex max-w-[min(100vw-1.5rem,420px)] flex-col gap-1">
      <div className="pointer-events-auto rounded-lg border border-[#E5E7EB] bg-white/95 px-2.5 py-2 shadow-lg backdrop-blur">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.35px] text-[#A1A1A1]">
          Demo role
        </div>
        <div className="flex flex-wrap gap-1">
          {DEMO_ROLES.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => setDemoRole(role.id)}
              className={
                demoRole === role.id
                  ? 'rounded-md bg-[#171717] px-2 py-1 text-[11px] font-semibold text-white'
                  : 'rounded-md bg-[#F3F4F6] px-2 py-1 text-[11px] font-semibold text-[#525252] hover:bg-[#E5E7EB]'
              }
            >
              {role.label}
            </button>
          ))}
        </div>
        <div className="mt-1 truncate text-[10.5px] text-[#737373]">
          Active: <span className="font-semibold text-[#171717]">{labelFor(demoRole)}</span>
        </div>
      </div>
    </div>
  )
}

function labelFor(role: DemoRole) {
  return DEMO_ROLES.find((r) => r.id === role)?.label ?? role
}
