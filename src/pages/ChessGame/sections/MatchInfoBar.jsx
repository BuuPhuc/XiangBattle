import Icon from '../../../components/ui/Icon'
import SpectatorEye from '../../../components/game/SpectatorEye'
import { formatTimeControlShort } from '../../../features/game/timeControls.js'
import RatedBadge from '../../../components/game/RatedBadge'

// "Ván 10 + 0 · tối đa 2 phút/nước" above the player cards of an online
// match, with the spectator eye ("Đang xem (3)") right after it, and under
// them whether the match counts for Elo. Shared by the players' view
// (ChessGame) and the spectators' (WatchGame).
// `rated`: true — Quick Play, Elo counts ("Tính Elo"); false — friendly
// ("Giao hữu"); undefined — not known, no badge.
export function MatchInfoBar({ timeControl, rated, spectators }) {
  return (
    <div className="flex flex-col items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
      <div className="flex flex-wrap xl:flex-nowrap items-center justify-center gap-x-1.5 gap-y-1">
        <div className="flex items-center gap-1.5 whitespace-nowrap" data-testid="match-time-control">
          <Icon name="timer" className="text-[18px] text-primary" />
          <span>
            Ván <strong className="text-primary tabular-nums">{formatTimeControlShort(timeControl)}</strong> · tối đa{' '}
            {Math.round(timeControl.moveTimeMs / 60000)} phút/nước
          </span>
        </div>
        <SpectatorEye spectators={spectators} />
      </div>
      {rated !== undefined && <RatedBadge rated={rated} />}
    </div>
  )
}

export default MatchInfoBar
