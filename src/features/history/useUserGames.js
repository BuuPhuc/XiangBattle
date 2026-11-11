import { useCallback, useEffect, useState } from 'react'
import userService from '../../services/userService'

const LOADING = { status: 'loading', error: null, games: [] }

// A user's most recent FINISHED online matches (GET /users/:id/games) —
// the one place that fetches match history, shared by the Profile pages'
// and the Play page's "Ván đấu gần đây". Only persisted online games exist
// there; bot games are never saved, so they never show up.
//
// status: 'loading' | 'ready' | 'empty' | 'hidden' | 'error'
//   'hidden' = 403: that player's own "Ván đấu gần đây" setting excludes the
//   viewer (an expected state, not a failure).
// `userId` null/undefined = nothing to load yet (stays 'loading').
// `reload()` fetches again (the "Thử lại" button).
export function useUserGames(userId, { limit = 10 } = {}) {
  const [state, setState] = useState(LOADING)
  const [request, setRequest] = useState({ userId, attempt: 0 })

  // "Reset during render" (see PublicProfile.jsx): back to 'loading' the
  // moment `userId` changes, instead of a synchronous setState in the effect.
  if (request.userId !== userId) {
    setRequest({ userId, attempt: 0 })
    setState(LOADING)
  }

  useEffect(() => {
    if (userId == null) return undefined
    let cancelled = false

    userService
      .getUserGames(userId, { page: 1, limit })
      .then((data) => {
        if (cancelled) return
        const games = data.games || []
        setState({ status: games.length > 0 ? 'ready' : 'empty', error: null, games })
      })
      .catch((err) => {
        if (cancelled) return
        setState({
          status: err.response && err.response.status === 403 ? 'hidden' : 'error',
          error: (err.response && err.response.data && err.response.data.message) || 'Không thể tải lịch sử đấu.',
          games: [],
        })
      })

    return () => {
      cancelled = true
    }
  }, [userId, limit, request.attempt])

  const reload = useCallback(() => {
    setState(LOADING)
    setRequest((current) => ({ ...current, attempt: current.attempt + 1 }))
  }, [])

  return { ...state, reload }
}

export default useUserGames
