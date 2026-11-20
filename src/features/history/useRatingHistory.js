import { useCallback, useEffect, useState } from 'react'
import userService from '../../services/userService'

const LOADING = { status: 'loading', error: null, history: null, fetchedAt: null }

// A player's "Lịch sử Elo" (GET /users/:id/rating-history): the chart
// points of their rated games, highest Elo, rated-game count, and win
// streaks (all games). Shared by both Profile pages.
//
// status: 'loading' | 'ready' | 'error'. `fetchedAt` is when it arrived —
// the "30 ngày" / "90 ngày" filters count back from it (reading the clock
// during render is not allowed under the React Compiler).
export function useRatingHistory(userId) {
  const [state, setState] = useState(LOADING)
  const [request, setRequest] = useState({ userId, attempt: 0 })

  if (request.userId !== userId) {
    setRequest({ userId, attempt: 0 })
    setState(LOADING)
  }

  useEffect(() => {
    if (userId == null) return undefined
    let cancelled = false
    userService
      .getRatingHistory(userId)
      .then((history) => {
        if (!cancelled) setState({ status: 'ready', error: null, history, fetchedAt: Date.now() })
      })
      .catch((err) => {
        if (cancelled) return
        setState({
          status: 'error',
          error: (err.response && err.response.data && err.response.data.message) || 'Không thể tải lịch sử Elo.',
          history: null,
          fetchedAt: null,
        })
      })
    return () => {
      cancelled = true
    }
  }, [userId, request.attempt])

  const reload = useCallback(() => {
    setState(LOADING)
    setRequest((current) => ({ ...current, attempt: current.attempt + 1 }))
  }, [])

  return { ...state, reload }
}

export default useRatingHistory
