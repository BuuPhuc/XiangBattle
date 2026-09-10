import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/ui/Icon'
import Button from '../../components/ui/Button'
import Avatar from '../../components/ui/Avatar'
import useAuth from '../../components/hooks/useAuth'
import userService from '../../services/userService'

function StatCard({ label, value }) {
  return (
    <div className="glass-panel border border-gold-shimmer/30 rounded-xl px-4 py-5 text-center">
      <p className="font-headline-sm text-headline-sm text-on-surface">{value}</p>
      <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">{label}</p>
    </div>
  )
}

function formatJoinDate(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// The current logged-in user's own profile — refetches on mount (rather
// than trusting whatever's already cached in Redux from login/restoreSession)
// so stats/avatar/bio are fresh even right after a match just finished or a
// profile edit happened elsewhere, then syncs that fresh copy back into
// Redux via updateUser so Header/Sidebar pick it up too.
export function Profile() {
  const { user, updateUser } = useAuth()
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [error, setError] = useState(null)
  // Bumped by the "Thử lại" button to re-run the fetch effect below.
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false

    userService
      .getMe()
      .then((data) => {
        if (cancelled) return
        updateUser(data.user)
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setError((err.response && err.response.data && err.response.data.message) || 'Không thể tải thông tin hồ sơ.')
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
    // updateUser intentionally excluded — this should only ever run on
    // mount and when reloadToken bumps (an explicit "Thử lại" click), never
    // re-fire just because updateUser's own call here changed `user`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken])

  // Event-handler-triggered (never called from the effect above itself) —
  // safe to reset status/error synchronously here, unlike inside an effect.
  const load = useCallback(() => {
    setStatus('loading')
    setError(null)
    setReloadToken((token) => token + 1)
  }, [])

  if (status === 'loading') {
    return (
      <div className="max-w-xl mx-auto py-24 px-4 text-center space-y-3">
        <span className="w-3 h-3 rounded-full bg-secondary animate-pulse inline-block" />
        <p className="font-body-md text-body-md text-on-surface-variant">Đang tải hồ sơ...</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="max-w-xl mx-auto py-24 px-4 text-center space-y-4">
        <p className="font-body-md text-body-md text-error">{error}</p>
        <Button onClick={load}>Thử lại</Button>
      </div>
    )
  }

  const totalGames = (user.wins ?? 0) + (user.losses ?? 0) + (user.draws ?? 0)
  const winRate = totalGames > 0 ? Math.round((user.wins / totalGames) * 100) : 0

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 space-y-6">
      <div className="glass-panel border border-gold-shimmer/30 rounded-2xl p-8 text-center">
        <Avatar src={user.avatarUrl} name={user.displayName || user.username} size={96} className="mx-auto mb-4" />
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{user.username}</h1>
        {user.bio && <p className="font-body-md text-body-md text-on-surface-variant mt-2 italic">"{user.bio}"</p>}
        <p className="font-label-sm text-label-sm text-on-surface-variant/70 mt-3 flex items-center justify-center gap-1.5">
          <Icon name="event" className="text-[16px]" />
          Tham gia từ {formatJoinDate(user.createdAt)}
        </p>

        <Link to="/profile/edit" className="inline-block mt-6">
          <Button>
            <Icon name="edit" />
            Chỉnh sửa hồ sơ
          </Button>
        </Link>
      </div>

      <div>
        <h2 className="font-headline-sm text-headline-sm text-on-surface mb-3">Thống kê</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Rating" value={user.rating} />
          <StatCard label="Tổng số trận" value={totalGames} />
          <StatCard label="Thắng" value={user.wins} />
          <StatCard label="Thua" value={user.losses} />
          <StatCard label="Hòa" value={user.draws} />
          <StatCard label="Tỷ lệ thắng" value={`${winRate}%`} />
        </div>
      </div>
    </div>
  )
}

export default Profile
