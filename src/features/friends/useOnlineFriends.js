import { useCallback, useEffect, useState } from 'react'
import socket from '../../socket/socket'
import friendService from '../../services/friendService'

// The current user's friends who are online right now, kept live.
//
// The server is the source of truth: the list always comes from
// GET /friends/online (already filtered to this user's own friends), and the
// socket events on the shared app-wide connection only say *when* to change
// it — a friend going offline is dropped locally, anything that could add
// someone (a friend coming online, a friendship starting or ending, this
// client's own (re)connect) re-reads the list. Nothing here ever builds an
// entry from a socket payload.
//
// `userId` is the logged-in user's id, or null for a guest — a guest makes
// no request and subscribes to nothing. Results are tagged with the user
// they were loaded for, so switching account never shows the previous
// user's friends.
export function useOnlineFriends(userId) {
  const [state, setState] = useState({ ownerId: null, status: 'loading', friends: [] })
  // Bumped by reload() to re-run the effect below after a failed load.
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!userId) return undefined

    let cancelled = false
    let inFlight = false
    // Something changed while a request was already on its way, so its
    // answer may predate the change — it is thrown away and asked again.
    let stale = false

    function sync() {
      if (inFlight) {
        stale = true
        return
      }
      inFlight = true
      friendService
        .getOnlineFriends()
        .then((data) => {
          if (cancelled || stale) return
          setState({ ownerId: userId, status: 'ready', friends: data.friends || [] })
        })
        .catch(() => {
          if (cancelled || stale) return
          setState({ ownerId: userId, status: 'error', friends: [] })
        })
        .finally(() => {
          inFlight = false
          if (cancelled || !stale) return
          stale = false
          sync()
        })
    }

    function handlePresence({ userId: friendId, online }) {
      if (online) {
        sync()
        return
      }
      if (inFlight) stale = true
      setState((current) =>
        current.friends.some((friend) => friend.id === friendId)
          ? { ...current, friends: current.friends.filter((friend) => friend.id !== friendId) }
          : current,
      )
    }

    // The socket is down and still failing to come back: presence can't be
    // followed, so say so rather than sit on "loading". Socket.IO keeps
    // retrying on its own, and the connect that eventually succeeds loads
    // the list.
    function handleConnectError() {
      setState((current) =>
        current.ownerId === userId && current.status === 'ready' ? current : { ownerId: userId, status: 'error', friends: [] },
      )
    }

    socket.on('connect', sync)
    socket.on('connect_error', handleConnectError)
    socket.on('friend_presence', handlePresence)
    socket.on('friends:changed', sync)

    // Presence events only reach this client once its socket is connected,
    // so a list read before that could miss a change that follows it — when
    // still connecting, the 'connect' handler above does the first load.
    if (socket.connected || reloadToken > 0) sync()

    return () => {
      cancelled = true
      socket.off('connect', sync)
      socket.off('connect_error', handleConnectError)
      socket.off('friend_presence', handlePresence)
      socket.off('friends:changed', sync)
    }
  }, [userId, reloadToken])

  const reload = useCallback(() => {
    setState((current) => ({ ...current, status: 'loading' }))
    setReloadToken((token) => token + 1)
  }, [])

  if (!userId) return { status: 'guest', friends: [], reload }
  if (state.ownerId !== userId) return { status: 'loading', friends: [], reload }
  return { status: state.status, friends: state.friends, reload }
}

export default useOnlineFriends
