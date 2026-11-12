import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import Icon from '../../components/ui/Icon'
import Button from '../../components/ui/Button'
import Avatar from '../../components/ui/Avatar'
import useAuth from '../../components/hooks/useAuth'
import userService from '../../services/userService'
import GameHistorySection from './sections/GameHistorySection'
import FriendAction from './sections/FriendAction'
import ChallengeAction from './sections/ChallengeAction'

function StatCard({ label, value }) {
  return (
    <div className="glass-panel border border-gold-shimmer/30 rounded-xl px-4 py-5 text-center">
      <p className="font-headline-sm text-headline-sm text-on-surface">{value}</p>
      <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">{label}</p>
    </div>
  )
}

function formatDate(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Read-only view of another player's profile — opened from a PlayerCard
// (avatar/username) during a match, or any /profile/:userId link. Unlike
// Profile.jsx this never syncs into Redux/useAuth (it's not "this" user's
// data) and never renders an edit affordance; every field shown here comes
// straight from the server's public projection (see userController.js's
// getPublicProfile), never anything the viewer could tamper with.
export function PublicProfile() {
  const { userId } = useParams()
  const { user: currentUser } = useAuth()
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'not-found' | 'error'
  const [error, setError] = useState(null)
  const [profile, setProfile] = useState(null)

  // Resets back to 'loading' the moment the :userId param itself changes
  // (e.g. one PlayerCard link clicked while already viewing another
  // player's profile) — adjusting state during render, same pattern
  // ChessGame.jsx uses for modalDismissed, rather than setState at the top
  // of the effect below.
  const [loadedUserId, setLoadedUserId] = useState(userId)
  if (loadedUserId !== userId) {
    setLoadedUserId(userId)
    setStatus('loading')
    setError(null)
    setProfile(null)
  }

  useEffect(() => {
    let cancelled = false

    userService
      .getPublicProfile(userId)
      .then((data) => {
        if (cancelled) return
        setProfile(data.user)
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        if (err.response && err.response.status === 404) {
          setStatus('not-found')
          return
        }
        setError((err.response && err.response.data && err.response.data.message) || 'Không thể tải hồ sơ người chơi.')
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  // Viewing your own id via this route — send it to the real (editable)
  // Profile page instead of showing a second, read-only copy of yourself.
  if (currentUser && String(currentUser.id) === String(userId)) {
    return <Navigate to="/profile" replace />
  }

  if (status === 'loading') {
    return (
      <div className="max-w-xl mx-auto py-24 px-4 text-center space-y-3">
        <span className="w-3 h-3 rounded-full bg-secondary animate-pulse inline-block" />
        <p className="font-body-md text-body-md text-on-surface-variant">Đang tải hồ sơ...</p>
      </div>
    )
  }

  if (status === 'not-found') {
    return (
      <div className="max-w-xl mx-auto py-24 px-4 text-center space-y-4">
        <Icon name="person_off" className="text-5xl text-on-surface-variant/50" />
        <p className="font-body-md text-body-md text-on-surface-variant">Không tìm thấy người chơi.</p>
        <Link to="/play">
          <Button variant="outline">Về trang chính</Button>
        </Link>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="max-w-xl mx-auto py-24 px-4 text-center space-y-4">
        <p className="font-body-md text-body-md text-error">{error}</p>
        <Link to="/play">
          <Button variant="outline">Về trang chính</Button>
        </Link>
      </div>
    )
  }

  const totalGames = (profile.wins ?? 0) + (profile.losses ?? 0) + (profile.draws ?? 0)
  const winRate = totalGames > 0 ? Math.round((profile.wins / totalGames) * 100) : 0

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 space-y-6">
      <div className="glass-panel border border-gold-shimmer/30 rounded-2xl p-8 text-center">
        <Avatar src={profile.avatarUrl} name={profile.displayName || profile.username} size={96} className="mx-auto mb-4" />
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{profile.username}</h1>
        {profile.bio && <p className="font-body-md text-body-md text-on-surface-variant mt-2 italic">"{profile.bio}"</p>}
        <p className="font-label-sm text-label-sm text-on-surface-variant/70 mt-3 flex items-center justify-center gap-1.5">
          <Icon name="event" className="text-[16px]" />
          Tham gia từ {formatDate(profile.createdAt)}
        </p>
        <FriendAction userId={userId} />
        <ChallengeAction userId={userId} />
      </div>

      <div>
        <h2 className="font-headline-sm text-headline-sm text-on-surface mb-3">Thống kê</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Rating" value={profile.rating} />
          <StatCard label="Tổng số trận" value={totalGames} />
          <StatCard label="Thắng" value={profile.wins} />
          <StatCard label="Thua" value={profile.losses} />
          <StatCard label="Hòa" value={profile.draws} />
          <StatCard label="Tỷ lệ thắng" value={`${winRate}%`} />
        </div>
      </div>

      <GameHistorySection userId={userId} />
    </div>
  )
}

export default PublicProfile
