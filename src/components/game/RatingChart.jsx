import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { chartLayout, formatRatingChange } from '../../features/history/ratingChart.js'
import { cn } from '../utils/cn'

function formatDay(isoString) {
  return new Date(isoString).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// The "Lịch sử Elo" line: Elo after each rated game, oldest on the left.
// Hover (or tap, on a touch screen) a point for its date, Elo, change and
// opponent; click it (a second tap) to open that game's replay. `points`
// carry `gameId` / `opponent` only when the viewer may see the player's
// games — without them a point shows its numbers and opens nothing.
export function RatingChart({ points }) {
  const navigate = useNavigate()
  const [active, setActive] = useState(null)
  const lastPointer = useRef('mouse')
  const boxRef = useRef(null)
  // Drawn at the box's real width (not a scaled-down picture), so labels
  // stay readable on a phone.
  const [width, setWidth] = useState(600)
  useEffect(() => {
    const box = boxRef.current
    if (!box || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))))
    observer.observe(box)
    return () => observer.disconnect()
  }, [])
  const layout = chartLayout(points, { width, height: width < 480 ? 200 : 220 })
  if (!layout) return null

  const open = (point) => {
    if (point.gameId != null) navigate(`/replay/${point.gameId}`)
  }
  const choose = (index) => {
    // A tap first shows the point; tapping it again opens the game.
    if (lastPointer.current === 'touch' && active !== index) setActive(index)
    else open(layout.points[index])
  }
  const shown = active != null ? layout.points[active] : null
  const first = layout.points[0]
  const last = layout.points[layout.points.length - 1]

  return (
    <div ref={boxRef} className="relative" data-testid="rating-chart" onPointerLeave={() => setActive(null)}>
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="w-full h-auto block select-none"
        role="img"
        aria-label={`Biểu đồ điểm xếp hạng qua ${points.length} ván xếp hạng, từ ${layout.start.rating} đến ${last.rating}`}
      >
        {layout.ticks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={layout.plot.left}
              x2={layout.plot.right}
              y1={tick.y}
              y2={tick.y}
              className="stroke-outline-variant/30"
              strokeWidth="1"
            />
            <text x={layout.plot.left - 8} y={tick.y + 4} textAnchor="end" className="fill-on-surface-variant text-[11px] tabular-nums">
              {tick.value}
            </text>
          </g>
        ))}
        <text x={layout.plot.left} y={layout.height - 6} className="fill-on-surface-variant text-[11px]">
          {formatDay(first.endedAt)}
        </text>
        {layout.points.length > 1 && (
          <text x={layout.plot.right} y={layout.height - 6} textAnchor="end" className="fill-on-surface-variant text-[11px]">
            {formatDay(last.endedAt)}
          </text>
        )}

        <path d={layout.path} fill="none" className="stroke-primary" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {/* Where the line starts: the Elo before the first game shown. */}
        <circle cx={layout.start.x} cy={layout.start.y} r="3.5" className="fill-surface stroke-primary" strokeWidth="2" />

        {layout.points.map((point, index) => (
          <g
            key={point.gameId ?? `${point.endedAt}-${index}`}
            data-testid="rating-point"
            role={point.gameId != null ? 'link' : 'img'}
            tabIndex={0}
            aria-label={`${formatDay(point.endedAt)}: ${point.rating} điểm (${formatRatingChange(point.change)})`}
            className={cn('outline-none', point.gameId != null && 'cursor-pointer')}
            onPointerDown={(event) => {
              lastPointer.current = event.pointerType
            }}
            onPointerEnter={(event) => {
              lastPointer.current = event.pointerType
              if (event.pointerType !== 'touch') setActive(index)
            }}
            onFocus={() => setActive(index)}
            onBlur={() => setActive((current) => (current === index ? null : current))}
            onClick={() => choose(index)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') open(point)
            }}
          >
            <circle cx={point.x} cy={point.y} r="12" fill="transparent" />
            <circle
              cx={point.x}
              cy={point.y}
              r={active === index ? 6 : 4}
              className={cn('stroke-surface transition-[r] duration-150', point.change >= 0 ? 'fill-secondary' : 'fill-error')}
              strokeWidth="1.5"
            />
          </g>
        ))}
      </svg>

      {shown && (
        <div
          role="tooltip"
          data-testid="rating-tooltip"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full -mt-3 glass-panel border border-gold-shimmer/30 rounded-lg px-3 py-2 shadow-lg whitespace-nowrap font-label-sm text-label-sm"
          style={{
            left: `${Math.min(88, Math.max(12, (shown.x / layout.width) * 100))}%`,
            top: `${(shown.y / layout.height) * 100}%`,
          }}
        >
          <p className="text-on-surface-variant">{formatDay(shown.endedAt)}</p>
          <p className="text-on-surface">
            <strong className="tabular-nums">{shown.rating}</strong> điểm{' '}
            <span className={cn('font-bold tabular-nums', shown.change >= 0 ? 'text-secondary' : 'text-error')}>
              ({formatRatingChange(shown.change)})
            </span>
          </p>
          {shown.opponent && (
            <p className="text-on-surface-variant">vs {shown.opponent.displayName || shown.opponent.username}</p>
          )}
          {shown.gameId != null && <p className="text-primary/80">Bấm để xem lại ván</p>}
        </div>
      )}
    </div>
  )
}

export default RatingChart
