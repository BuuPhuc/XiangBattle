import { useCallback, useEffect, useState } from 'react'
import socket from '../../socket/socket'

// Matches being played right now (the server's list_live_games), refreshed
// every `intervalMs` while mounted and again on every (re)connect. Used by
// the "Ván đang diễn ra" page and to put a "Xem" button next to friends who
// are playing.
const DEFAULT_INTERVAL_MS = 10_000

export function useLiveGames({ intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  const [games, setGames] = useState([])
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(() => {
    if (!socket.connected) return
    socket.emit('list_live_games', {}, (reply) => {
      setGames(Array.isArray(reply?.games) ? reply.games : [])
      setLoaded(true)
    })
  }, [])

  useEffect(() => {
    refresh()
    socket.on('connect', refresh)
    const timer = setInterval(refresh, intervalMs)
    return () => {
      socket.off('connect', refresh)
      clearInterval(timer)
    }
  }, [refresh, intervalMs])

  return { games, loaded, refresh }
}

// The live game `userId` is seated in, or null.
export function findLiveGameOf(games, userId) {
  if (userId == null) return null
  return games.find((game) => game.players.some((player) => player.userId === userId)) ?? null
}

export default useLiveGames
