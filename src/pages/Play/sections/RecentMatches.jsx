import { Link } from 'react-router-dom'
import Icon from '../../../components/ui/Icon'
import Button from '../../../components/ui/Button'
import GameHistoryCard from '../../../components/game/GameHistoryCard'
import useAuth from '../../../components/hooks/useAuth'
import useUserGames from '../../../features/history/useUserGames'

const RECENT_LIMIT = 5

function Panel({ children }) {
  return (
    <div className="bg-white/40 backdrop-blur-xl border border-outline-variant/30 rounded-xl overflow-hidden" data-testid="recent-matches">
      {children}
    </div>
  )
}

function Message({ icon, children }) {
  return (
    <div className="p-12 flex flex-col items-center justify-center text-center gap-4">
      <div className="w-16 h-16 rounded-full bg-surface-variant flex items-center justify-center text-outline">
        <Icon name={icon} className="text-3xl" />
      </div>
      {children}
    </div>
  )
}

// The signed-in player's last few online matches. Reuses the Profile's
// history fetch (useUserGames) and row (GameHistoryCard), plus the
// account's own win/loss/draw totals (the same numbers the Profile shows —
// not recomputed from the rows below). Remounts — and so refetches — every
// time the Play page is opened. Bot games are never saved, so never listed.
function SignedInRecentMatches({ user }) {
  const { status, games, reload } = useUserGames(user.id, { limit: RECENT_LIMIT })

  return (
    <>
      <p className="font-label-md text-label-md text-on-surface-variant" data-testid="record-summary">
        Thắng <strong className="text-secondary">{user.wins ?? 0}</strong> · Thua{' '}
        <strong className="text-error">{user.losses ?? 0}</strong> · Hòa{' '}
        <strong className="text-on-surface">{user.draws ?? 0}</strong>
      </p>
      <Panel>
        {status === 'loading' && (
          <div className="py-12 text-center" aria-label="Đang tải">
            <span className="w-3 h-3 rounded-full bg-secondary animate-pulse inline-block" />
          </div>
        )}
        {(status === 'error' || status === 'hidden') && (
          <Message icon="cloud_off">
            <p className="font-body-lg text-body-lg text-on-surface-variant">Không thể tải lịch sử đấu.</p>
            <Button variant="outline-sm" size="sm" onClick={reload}>
              <Icon name="refresh" className="text-[18px]" />
              Thử lại
            </Button>
          </Message>
        )}
        {status === 'empty' && (
          <Message icon="history_toggle_off">
            <p className="font-body-lg text-body-lg text-on-surface-variant">Chưa có ván đấu nào</p>
            <Link to="/room?mode=quick">
              <Button size="sm">Chơi ngay</Button>
            </Link>
          </Message>
        )}
        {status === 'ready' && (
          <>
            {games.map((game) => (
              <GameHistoryCard key={game.gameId} game={game} showColor />
            ))}
            <div className="px-4 py-3 text-center border-t border-outline-variant/20">
              <Link to="/profile" className="font-label-md text-label-md text-primary hover:underline">
                Xem tất cả
              </Link>
            </div>
          </>
        )}
      </Panel>
    </>
  )
}

export function RecentMatches() {
  // isRestoring: a saved session still being confirmed on page load — show
  // "loading", not a sign-in prompt that would flash and disappear.
  const { user, isAuthenticated, isRestoring: restoringSession } = useAuth()

  return (
    <div className="space-y-6 pt-8">
      <div className="flex items-center gap-4 border-b border-outline-variant pb-2">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Ván đấu gần đây</h2>
        <div className="h-[1px] flex-grow bg-gradient-to-r from-outline-variant to-transparent" />
      </div>

      {isAuthenticated && user ? (
        <SignedInRecentMatches user={user} />
      ) : restoringSession ? (
        <Panel>
          <div className="py-12 text-center" aria-label="Đang tải">
            <span className="w-3 h-3 rounded-full bg-secondary animate-pulse inline-block" />
          </div>
        </Panel>
      ) : (
        <Panel>
          <Message icon="lock">
            <p className="font-body-lg text-body-lg text-on-surface-variant">Đăng nhập để lưu và xem lại ván đấu của bạn</p>
            <Link to="/login">
              <Button size="sm">Đăng nhập</Button>
            </Link>
          </Message>
        </Panel>
      )}
    </div>
  )
}

export default RecentMatches
