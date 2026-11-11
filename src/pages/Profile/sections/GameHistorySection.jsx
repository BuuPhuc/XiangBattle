import Icon from '../../../components/ui/Icon'
import GameHistoryCard from '../../../components/game/GameHistoryCard'
import useUserGames from '../../../features/history/useUserGames'

// "Ván đấu gần đây" — a user's FINISHED-match history, used by both the
// current user's own Profile page and any other player's PublicProfile
// page (hence taking `userId` as a prop rather than reading it from auth).
// Fetches independently of whatever profile card sits above it — its own
// loading/error/empty states, so a slow or failed history fetch never
// blocks the profile itself from rendering, and vice versa.
// The fetch (useUserGames) and the row (GameHistoryCard) are shared with
// the Play page's "Ván đấu gần đây".
export function GameHistorySection({ userId }) {
  const { status, error, games } = useUserGames(userId, { limit: 10 })

  return (
    <div>
      <h2 className="font-headline-sm text-headline-sm text-on-surface mb-3 flex items-center gap-2">
        <Icon name="history" className="text-[20px]" />
        Ván đấu gần đây
      </h2>
      <div className="glass-panel border border-gold-shimmer/30 rounded-xl overflow-hidden">
        {status === 'loading' && (
          <div className="py-10 text-center">
            <span className="w-3 h-3 rounded-full bg-secondary animate-pulse inline-block" />
          </div>
        )}
        {status === 'error' && (
          <div className="py-10 text-center px-4">
            <p className="font-body-sm text-body-sm text-error">{error}</p>
          </div>
        )}
        {status === 'hidden' && (
          <div className="py-10 text-center px-4 space-y-2">
            <Icon name="lock" className="text-4xl text-on-surface-variant/40 block" />
            <p className="font-body-sm text-body-sm text-on-surface-variant">{error}</p>
          </div>
        )}
        {status === 'empty' && (
          <div className="py-10 text-center px-4 space-y-2">
            <Icon name="sports_esports" className="text-4xl text-on-surface-variant/40 block" />
            <p className="font-body-sm text-body-sm text-on-surface-variant">Chưa có ván đấu nào</p>
          </div>
        )}
        {status === 'ready' && games.map((game) => <GameHistoryCard key={game.gameId} game={game} />)}
      </div>
    </div>
  )
}

export default GameHistorySection
