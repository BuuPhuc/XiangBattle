import { useCallback, useEffect, useState } from 'react'
import useAuth from '../../../components/hooks/useAuth'
import academyService from '../../../services/academyService'
import { loadAuthSession } from '../../auth/authStorage'

// A guest's progress only has to survive moving between Academy pages, so it
// lives in sessionStorage: gone when the tab closes, never sent anywhere.
const GUEST_PROGRESS_KEY = 'xiangbattle_academy_guest_progress'

const NO_PROGRESS = new Set()

function loadGuestProgress() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(GUEST_PROGRESS_KEY))
    return Array.isArray(stored) ? stored : []
  } catch {
    return []
  }
}

function saveGuestProgress(challengeIds) {
  try {
    sessionStorage.setItem(GUEST_PROGRESS_KEY, JSON.stringify(challengeIds))
  } catch {
    // Storage unavailable (private mode, quota) — progress just stays in memory.
  }
}

// Which challenges the current viewer has completed, and how to add one.
//   - Signed in: read from and written to the server (PostgreSQL), so it
//     survives a refresh, a re-login and another device.
//   - Guest: kept for this tab only; `isGuest` lets a page say "Đăng nhập để
//     lưu tiến độ học tập."
// `completedIds` is a Set of challenge ids. `status` is 'loading' | 'ready' |
// 'error' ('error' = the saved progress could not be fetched).
export function useAcademyProgress() {
  const { isAuthenticated, user } = useAuth()
  const userId = isAuthenticated && user ? user.id : null
  // On a page refresh the saved session is still being confirmed with the
  // server for a moment (see useAuth's restoreSession). Until that settles
  // this is neither a guest nor a known user — treating it as a guest would
  // flash empty progress, and bounce a deep link back to challenge 1.
  const sessionPending = !isAuthenticated && Boolean(loadAuthSession())

  const [guestIds, setGuestIds] = useState(() => new Set(loadGuestProgress()))
  // What the server last answered, tagged with who it was for and which
  // request it answers. Anything fetched for a previous viewer (just logged
  // in/out) or before a "Thử lại" simply reads as loading — it is never
  // shown as the current user's.
  const [server, setServer] = useState({ ownerId: null, request: -1, completedIds: NO_PROGRESS, error: null })
  // Bumped by a page's "Thử lại" to re-run the fetch below.
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (sessionPending || userId === null) return undefined

    let cancelled = false
    const settle = (completedIds, error) => {
      if (!cancelled) setServer({ ownerId: userId, request: reloadToken, completedIds, error })
    }

    academyService
      .getProgress()
      .then((data) => settle(new Set(data.completedChallengeIds || []), null))
      .catch((err) =>
        settle(NO_PROGRESS, (err.response && err.response.data && err.response.data.message) || 'Không thể tải tiến độ học tập.'),
      )

    return () => {
      cancelled = true
    }
  }, [userId, sessionPending, reloadToken])

  // Marks a challenge completed. `moves` is what the player actually played
  // — the server re-checks it before saving. The challenge counts as done on
  // this screen either way (the board already judged it), so a failed save
  // never blocks the lesson; it resolves `{ saved: false }` so the page can
  // say the progress was not stored.
  const completeChallenge = useCallback(
    async (courseId, challengeId, moves) => {
      if (userId === null) {
        setGuestIds((current) => {
          if (current.has(challengeId)) return current
          const next = new Set(current).add(challengeId)
          saveGuestProgress([...next])
          return next
        })
        return { saved: false, guest: true }
      }

      setServer((current) =>
        current.ownerId !== userId || current.completedIds.has(challengeId)
          ? current
          : { ...current, completedIds: new Set(current.completedIds).add(challengeId) },
      )

      try {
        await academyService.completeChallenge(courseId, challengeId, moves)
        return { saved: true, guest: false }
      } catch {
        return { saved: false, guest: false }
      }
    },
    [userId],
  )

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  if (sessionPending) {
    return { status: 'loading', error: null, completedIds: NO_PROGRESS, isGuest: false, completeChallenge, reload }
  }
  if (userId === null) {
    return { status: 'ready', error: null, completedIds: guestIds, isGuest: true, completeChallenge, reload }
  }

  const settled = server.ownerId === userId && server.request === reloadToken
  return {
    status: !settled ? 'loading' : server.error ? 'error' : 'ready',
    error: settled ? server.error : null,
    completedIds: server.ownerId === userId ? server.completedIds : NO_PROGRESS,
    isGuest: false,
    completeChallenge,
    reload,
  }
}

export default useAcademyProgress
