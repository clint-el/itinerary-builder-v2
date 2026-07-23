import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { STATUS_META } from '@/shared/lib/catalogs'
import { dashboardData, type Zone } from '@/shared/lib/helpers'
import type { Itinerary } from '@/shared/lib/types'
import { formatUsd } from '@/shared/lib/utils'

const ZONE_META: Record<
  Zone,
  { label: string; stripe: string; bg: string; color: string }
> = {
  green: { label: 'On track', stripe: '#16A34A', bg: '#DCFCE7', color: '#166534' },
  yellow: { label: 'Watch', stripe: '#E5B84D', bg: '#FEF3C7', color: '#92400E' },
  red: { label: 'Overdue', stripe: '#DC2626', bg: '#FEE2E2', color: '#991B1B' },
}

interface Props {
  itineraries: Itinerary[]
}

export function StatusDashboard({ itineraries }: Props) {
  const navigate = useNavigate()
  const data = useMemo(() => dashboardData(itineraries), [itineraries])

  const stats = [
    {
      label: 'Overdue',
      value: String(data.stats.overdue),
      valueColor: '#DC2626',
      sub: 'red zone · act now',
    },
    {
      label: 'Watch',
      value: String(data.stats.watch),
      valueColor: '#B7791F',
      sub: 'yellow zone · nearing SLA',
    },
    {
      label: 'On track',
      value: String(data.stats.onTrack),
      valueColor: '#16A34A',
      sub: 'green zone · within SLA',
    },
    {
      label: 'Pipeline value',
      value: formatUsd(data.stats.pipeline),
      valueColor: '#171717',
      sub: `${data.queue.length} active itineraries`,
    },
  ]

  return (
    <div className="min-h-0 flex-1 overflow-auto px-7 py-5">
      <div className="mb-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((c) => (
          <Card key={c.label} className="rounded-xl border-[#E5E7EB] shadow-none">
            <CardContent className="flex flex-col gap-1.5 p-[15px_17px]">
              <span className="text-xs font-semibold text-[#A1A1A1]">{c.label}</span>
              <span className="text-[26px] font-bold leading-none" style={{ color: c.valueColor }}>
                {c.value}
              </span>
              <span className="text-[11.5px] font-medium text-[#A1A1A1]">{c.sub}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-[18px] xl:grid-cols-[2.1fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] px-[18px] py-3.5">
            <div>
              <div className="text-[15px] font-bold text-[#171717]">Priority queue</div>
              <div className="mt-0.5 text-xs font-medium text-[#A1A1A1]">
                Work the top first — ranked by turnaround risk, value, margin & partner tier
              </div>
            </div>
            <span className="whitespace-nowrap text-xs font-semibold text-[#525252]">
              {data.queue.length} active
            </span>
          </div>

          {data.empty ? (
            <div className="px-[18px] py-7 text-center text-[13px] font-medium text-[#A1A1A1]">
              No active itineraries in the pipeline.
            </div>
          ) : (
            data.queue.map((item, i) => {
              const zm = ZONE_META[item.zone]
              const sm = STATUS_META[item.it.status]
              const daysLabel = item.days === 0 ? 'today' : `${item.days}d ago`
              const tierPreferred = item.partner.tier === 'Preferred'
              return (
                <div
                  key={item.it.id}
                  className="grid grid-cols-[26px_1.7fr_1.1fr_0.95fr_1.15fr] items-center gap-3 border-t border-[#F1F1F3] px-[18px] py-3.5"
                  style={{ borderLeft: `3px solid ${zm.stripe}` }}
                >
                  <div className="flex size-[26px] shrink-0 items-center justify-center rounded-lg bg-[#F3F4F6] text-[12.5px] font-bold text-[#525252]">
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <button
                        type="button"
                        className="cursor-pointer whitespace-nowrap text-sm font-bold text-[#1D4ED8] underline"
                        onClick={() => navigate(`/build/${item.it.id}`)}
                      >
                        {item.it.reference}
                      </button>
                      <span className="truncate text-[12.5px] font-medium text-[#A1A1A1]">
                        {item.it.title || 'Untitled Itinerary'}
                      </span>
                    </div>
                    <div className="mt-1 flex min-w-0 items-center gap-1.5">
                      <span className="whitespace-nowrap text-xs font-semibold text-[#525252]">
                        {item.it.agency || '—'}
                      </span>
                      <span
                        className="inline-flex h-[17px] items-center whitespace-nowrap rounded px-1.5 text-[10px] font-bold tracking-[0.2px]"
                        style={{
                          background: tierPreferred ? '#DCFCE7' : '#E0F2FE',
                          color: tierPreferred ? '#166534' : '#0369A1',
                        }}
                      >
                        {item.partner.tier}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <span
                      className="inline-flex h-5 items-center whitespace-nowrap rounded-[5px] px-2 text-[11px] font-bold"
                      style={{ background: zm.bg, color: zm.color }}
                    >
                      {zm.label} · {sm.label}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#737373]">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      Last action {daysLabel}
                    </span>
                  </div>
                  <div>
                    <div className="text-[13.5px] font-bold text-[#171717]">{formatUsd(item.it.totalUsd)}</div>
                    <div className="mt-0.5 text-[11.5px] font-semibold text-[#15803D]">{item.margin}% margin</div>
                  </div>
                  <div className="flex flex-col items-stretch gap-1.5">
                    <span className="text-right text-base font-bold" style={{ color: zm.stripe }}>
                      {item.score}
                    </span>
                    <div className="h-1.5 w-full overflow-hidden rounded-[3px] bg-[#F0F0F2]">
                      <div
                        className="h-full rounded-[3px]"
                        style={{ width: `${Math.min(100, item.score)}%`, background: zm.stripe }}
                      />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
          <div className="border-b border-[#E5E7EB] px-[18px] py-3.5">
            <div className="text-[15px] font-bold text-[#171717]">Trade partners</div>
            <div className="mt-0.5 text-xs font-medium text-[#A1A1A1]">Preferential ranking by partner score</div>
          </div>
          {data.partners.map((p, i) => {
            const preferred = p.tier === 'Preferred'
            return (
              <div
                key={p.name}
                className="flex items-center gap-3 border-t border-[#F1F1F3] px-[18px] py-3.5"
              >
                <div
                  className="flex size-6 shrink-0 items-center justify-center rounded-[7px] text-xs font-bold"
                  style={{
                    background: i === 0 ? '#FEF3C7' : '#F3F4F6',
                    color: i === 0 ? '#92400E' : '#525252',
                  }}
                >
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-[13.5px] font-semibold text-[#171717]">{p.name}</span>
                    <span
                      className="inline-flex h-[17px] items-center whitespace-nowrap rounded px-1.5 text-[10px] font-bold"
                      style={{
                        background: preferred ? '#DCFCE7' : '#E0F2FE',
                        color: preferred ? '#166534' : '#0369A1',
                      }}
                    >
                      {p.tier}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-[#F0F0F2]">
                      <div
                        className="h-full rounded-[3px]"
                        style={{
                          width: `${Math.min(100, p.score)}%`,
                          background: preferred ? '#16A34A' : '#0369A1',
                        }}
                      />
                    </div>
                    <span className="whitespace-nowrap text-[12.5px] font-bold text-[#171717]">{p.score}</span>
                  </div>
                  <div className="mt-1 text-[11px] font-medium text-[#A1A1A1]">
                    {p.count} active {p.count === 1 ? 'itinerary' : 'itineraries'} · {formatUsd(p.value)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
