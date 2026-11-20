import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../../components/ui/Icon'
import Button from '../../../components/ui/Button'
import RatingChart from '../../../components/game/RatingChart'
import { RATING_RANGES, pointsInRange } from '../../../features/history/ratingChart.js'
import { cn } from '../../../components/utils/cn'

function Tile({ label, value, testId }) {
  return (
    <div className="rounded-lg bg-surface-container/60 px-3 py-2 text-center" data-testid={testId}>
      <p className="font-headline-sm text-headline-sm text-on-surface tabular-nums">{value}</p>
      <p className="font-label-sm text-label-sm text-on-surface-variant">{label}</p>
    </div>
  )
}

// "Lịch sử Elo" on both Profile pages: how the player's Elo moved over
// their rated (Quick Play) games, with 30 ngày / 90 ngày / Tất cả filters.
// `ratingHistory` is the page's useRatingHistory result (the page also
// uses its win streaks in "Thống kê"). Only games since Elo started being
// recorded are points — there is no made-up starting point; until the
// first rated game the section says so and shows the current Elo.
// `isOwn` adds the "Chơi ngay" button to the empty state.
export function RatingHistorySection({ ratingHistory, isOwn = false }) {
  const [rangeId, setRangeId] = useState('all')
  const { status, error, history, fetchedAt, reload } = ratingHistory
  const points = history ? history.points : []
  const shown = pointsInRange(points, rangeId, fetchedAt ?? 0)

  return (
    <div data-testid="rating-history">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
          <Icon name="show_chart" className="text-[20px]" />
          Lịch sử điểm xếp hạng
        </h2>
        {status === 'ready' && points.length > 0 && (
          <div className="flex rounded-full bg-surface-container p-0.5" role="group" aria-label="Khoảng thời gian">
            {RATING_RANGES.map((range) => (
              <button
                key={range.id}
                type="button"
                aria-pressed={rangeId === range.id}
                onClick={() => setRangeId(range.id)}
                className={cn(
                  'px-3 py-1 rounded-full font-label-sm text-label-sm transition-colors',
                  rangeId === range.id ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
                )}
              >
                {range.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="glass-panel border border-gold-shimmer/30 rounded-xl p-4">
        {status === 'loading' && (
          <div className="py-10 text-center">
            <span className="w-3 h-3 rounded-full bg-secondary animate-pulse inline-block" />
          </div>
        )}
        {status === 'error' && (
          <div className="py-8 text-center space-y-3">
            <p className="font-body-sm text-body-sm text-error">{error}</p>
            <Button variant="outline-sm" size="sm" onClick={reload}>
              Thử lại
            </Button>
          </div>
        )}
        {status === 'ready' && points.length === 0 && (
          <div className="py-8 text-center space-y-2" data-testid="rating-history-empty">
            <p className="font-headline-sm text-headline-sm text-on-surface tabular-nums">{history.currentRating} điểm</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Biểu đồ sẽ có sau ván xếp hạng đầu tiên.</p>
            {isOwn && (
              <Link to="/room?mode=quick" className="inline-block pt-1">
                <Button size="sm">
                  <Icon name="bolt" className="text-[18px]" />
                  Chơi ngay
                </Button>
              </Link>
            )}
          </div>
        )}
        {status === 'ready' && points.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Tile label="Điểm hiện tại" value={history.currentRating} testId="rating-current" />
              <Tile label="Điểm cao nhất" value={history.peakRating} testId="rating-peak" />
              <Tile label="Ván xếp hạng" value={history.ratedGames} testId="rating-games" />
            </div>
            {shown.length > 0 ? (
              <RatingChart points={shown} />
            ) : (
              <p className="py-8 text-center font-body-sm text-body-sm text-on-surface-variant" data-testid="rating-range-empty">
                Không có ván xếp hạng nào trong {RATING_RANGES.find((r) => r.id === rangeId).label} qua.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default RatingHistorySection
