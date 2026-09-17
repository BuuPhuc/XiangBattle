import { useEffect, useState } from 'react'
import Icon from '../../components/ui/Icon'
import Button from '../../components/ui/Button'
import useAuth from '../../components/hooks/useAuth'
import userService from '../../services/userService'
import TopThreePodium from './sections/TopThreePodium'
import PlayerRankRow from './sections/PlayerRankRow'

const PAGE_SIZE = 20

// "Bảng xếp hạng" — players ranked by their real rating/Elo, read straight
// from Postgres (sorted and paginated server-side; see
// leaderboardController.js). Never recomputes or caches rating client-side.
export function Leaderboard() {
  const { user: currentUser } = useAuth()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'empty' | 'error'
  const [error, setError] = useState(null)
  const [players, setPlayers] = useState([])
  const [myRank, setMyRank] = useState(null)
  const [pagination, setPagination] = useState(null)
  // Bumped by the "Thử lại" button to re-run the fetch effect below.
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setError(null)

    userService
      .getLeaderboard({ page, limit: PAGE_SIZE })
      .then((data) => {
        if (cancelled) return
        const list = data.players || []
        setPlayers(list)
        setMyRank(data.currentUser || null)
        setPagination(data.pagination || null)
        setStatus(list.length > 0 ? 'ready' : 'empty')
      })
      .catch((err) => {
        if (cancelled) return
        setError((err.response && err.response.data && err.response.data.message) || 'Không thể tải bảng xếp hạng.')
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [page, reloadToken])

  const topThree = page === 1 ? players.filter((p) => p.rank <= 3) : []
  const rest = page === 1 ? players.filter((p) => p.rank > 3) : players
  const isMyRankOnPage = currentUser && players.some((p) => String(p.id) === String(currentUser.id))

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface flex items-center gap-2">
          <Icon name="leaderboard" className="text-primary" />
          Bảng xếp hạng
        </h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
          Xếp hạng người chơi dựa trên điểm Rating/Elo hiện tại.
        </p>
      </div>

      {myRank && !isMyRankOnPage && (
        <div>
          <h2 className="font-label-md text-label-md font-bold text-on-surface-variant mb-2">Xếp hạng của bạn</h2>
          <div className="glass-panel border border-primary/40 rounded-xl overflow-hidden">
            <PlayerRankRow player={myRank} highlight />
          </div>
        </div>
      )}

      {status === 'loading' && (
        <div className="py-16 text-center">
          <span className="w-3 h-3 rounded-full bg-secondary animate-pulse inline-block" />
        </div>
      )}

      {status === 'error' && (
        <div className="py-16 text-center space-y-4">
          <p className="font-body-md text-body-md text-error">{error}</p>
          <Button onClick={() => setReloadToken((t) => t + 1)}>Thử lại</Button>
        </div>
      )}

      {status === 'empty' && (
        <div className="py-16 text-center px-4 space-y-2">
          <Icon name="groups" className="text-4xl text-on-surface-variant/40 block" />
          <p className="font-body-md text-body-md text-on-surface-variant">Chưa có người chơi</p>
        </div>
      )}

      {status === 'ready' && (
        <>
          <TopThreePodium players={topThree} currentUserId={currentUser && currentUser.id} />

          {rest.length > 0 && (
            <div className="glass-panel border border-gold-shimmer/30 rounded-xl overflow-hidden divide-y divide-outline-variant/20">
              {rest.map((player) => (
                <PlayerRankRow
                  key={player.id}
                  player={player}
                  highlight={currentUser && String(player.id) === String(currentUser.id)}
                />
              ))}
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="disabled:opacity-40 disabled:pointer-events-none"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <Icon name="chevron_left" />
                Trước
              </Button>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                Trang {pagination.page}/{pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="disabled:opacity-40 disabled:pointer-events-none"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              >
                Sau
                <Icon name="chevron_right" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Leaderboard
