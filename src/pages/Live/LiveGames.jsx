import { Link } from 'react-router-dom'
import Icon from '../../components/ui/Icon'
import Avatar from '../../components/ui/Avatar'
import { formatTimeControlShort } from '../../features/game/timeControls.js'
import { useLiveGames } from '../../features/spectate/useLiveGames'
import RatedBadge from '../../components/game/RatedBadge'

const COLOR_LABEL = { red: 'Đỏ', black: 'Đen' }

function PlayerLine({ player }) {
  const name = player.username || `Khách (${COLOR_LABEL[player.color]})`
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span
        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${player.color === 'red' ? 'bg-piece-red' : 'bg-piece-black'}`}
        aria-label={COLOR_LABEL[player.color]}
      />
      <Avatar src={player.avatarUrl} name={player.username || undefined} size={28} />
      <span className="font-body-md text-body-md text-on-surface truncate">{name}</span>
      {player.rating != null && (
        <span className="font-label-sm text-label-sm text-on-surface-variant tabular-nums">({player.rating})</span>
      )}
    </div>
  )
}

// "Ván đang diễn ra" — every match being played right now, open to
// everyone; "Xem" opens it at /watch/:roomId. Refreshes on its own every
// few seconds (useLiveGames).
export function LiveGames() {
  const { games, loaded, refresh } = useLiveGames()

  return (
    <div className="max-w-4xl mx-auto pb-24 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface flex items-center gap-2">
            <Icon name="live_tv" className="text-primary text-[32px]" />
            Ván đang diễn ra
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Chọn một ván để xem trực tiếp. Danh sách tự cập nhật.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant/40 text-on-surface-variant hover:text-primary hover:border-primary/40 font-label-md text-label-md transition-colors"
        >
          <Icon name="refresh" className="text-[18px]" />
          Làm mới
        </button>
      </div>

      {!loaded ? (
        <p className="text-center py-16 font-label-md text-label-md text-on-surface-variant">Đang tải…</p>
      ) : games.length === 0 ? (
        <div className="glass-panel border border-gold-shimmer/30 rounded-xl text-center py-16 px-4">
          <Icon name="visibility_off" className="text-[40px] text-on-surface-variant" />
          <p className="font-headline-sm text-headline-sm text-on-surface mt-3">Hiện chưa có ván nào đang diễn ra</p>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1 mb-6">Hay là bạn mở một ván?</p>
          <Link
            to="/play"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:opacity-90"
          >
            Chơi cờ
          </Link>
        </div>
      ) : (
        <ul className="space-y-3" data-testid="live-games">
          {games.map((game) => {
            const red = game.players.find((p) => p.color === 'red')
            const black = game.players.find((p) => p.color === 'black')
            return (
              <li
                key={game.roomId}
                className="glass-panel border border-outline-variant/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex-1 min-w-0 space-y-2">
                  {red && <PlayerLine player={red} />}
                  {black && <PlayerLine player={black} />}
                </div>
                <div className="flex items-center gap-4 font-label-md text-label-md text-on-surface-variant">
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Icon name="timer" className="text-[18px] text-primary" />
                    {formatTimeControlShort(game.timeControl)}
                  </span>
                  {game.rated !== undefined && <RatedBadge rated={game.rated} />}
                  <span className="tabular-nums">{game.moveCount} nước</span>
                  <span className="inline-flex items-center gap-1 tabular-nums" title="Người đang xem">
                    <Icon name="visibility" className="text-[18px]" />
                    {game.spectatorCount}
                  </span>
                </div>
                <Link
                  to={`/watch/${game.roomId}`}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:opacity-90"
                >
                  <Icon name="visibility" className="text-[18px]" />
                  Xem
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default LiveGames
