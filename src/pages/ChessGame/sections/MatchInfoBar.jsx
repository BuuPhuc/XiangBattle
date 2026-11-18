import Icon from '../../../components/ui/Icon'
import SpectatorEye from '../../../components/game/SpectatorEye'
import { formatTimeControlShort } from '../../../features/game/timeControls.js'

// "Ván 10 + 0 · tối đa 2 phút/nước" above the player cards of an online
// match, with the spectator eye ("Đang xem (3)") right after it. Shared by
// the players' view (ChessGame) and the spectators' (WatchGame).
export function MatchInfoBar({ timeControl, spectators }) {
  return (
    <div className="flex flex-wrap xl:flex-nowrap items-center justify-center gap-x-1.5 gap-y-1 font-label-sm text-label-sm text-on-surface-variant">
      <div className="flex items-center gap-1.5 whitespace-nowrap" data-testid="match-time-control">
        <Icon name="timer" className="text-[18px] text-primary" />
        <span>
          Ván <strong className="text-primary tabular-nums">{formatTimeControlShort(timeControl)}</strong> · tối đa{' '}
          {Math.round(timeControl.moveTimeMs / 60000)} phút/nước
        </span>
      </div>
      <SpectatorEye spectators={spectators} />
    </div>
  )
}

export default MatchInfoBar
