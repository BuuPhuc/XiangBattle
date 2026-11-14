import { useEffect } from 'react'
import { Provider } from 'react-redux'
import store from './store'
import AppRouter from './routes'
import socket from './socket/socket'
import useAuth from './components/hooks/useAuth'
import { onStoredUserChange } from './features/auth/authStorage'
import authService from './services/authService'
import {
  setSessionEndHandler,
  reportSessionEnded,
  endSessionAndLeave,
  isOwnLogoutAllInFlight,
} from './features/auth/sessionEnd'
import useAccountSettingsSync from './features/settings/useAccountSettingsSync'

// Runs inside <Provider> so useAuth (Redux) is available: on mount, restore
// a saved login session (if any) and arm the socket with its token *before*
// connecting, so the very first connection already carries the right
// identity instead of connecting as a guest and reconnecting a moment later.
function AppContent() {
  const { restoreSession } = useAuth()
  // Signed-in user's sound / arrow settings, available app-wide.
  useAccountSettingsSync()

  useEffect(() => {
    function handleConnect() {
      console.log('[socket] connected:', socket.id)
    }
    function handleDisconnect(reason) {
      console.log('[socket] disconnected:', reason)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)

    restoreSession().finally(() => {
      socket.connect()
    })

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only
  }, [])

  // Every tab of a browser shares one login (localStorage). If another tab
  // logs in as someone else or logs out, this tab would otherwise keep
  // showing — and acting as — a session that no longer exists. Reload so
  // the page, Redux and the socket all pick up the session actually stored.
  useEffect(
    () =>
      onStoredUserChange((storedUser) => {
        const currentId = store.getState().auth.user?.id ?? null
        const storedId = storedUser?.id ?? null
        if (currentId !== storedId) window.location.reload()
      }),
    []
  )

  // The server ended this browser's login (expired, invalid, or revoked by
  // "Đăng xuất khỏi tất cả thiết bị" on any device) — reported by a refused
  // API call (config/axios.js) or by the socket (`session_ended`, sent both
  // to sockets open at the moment of a revoke and to one that connects with
  // a token that no longer works). Signs out and lands on the login page,
  // but only for the session actually in use: a session that was never
  // confirmed is restoreSession's to clear (unchanged start-up behavior,
  // no redirect), and a refusal of some older token is ignored.
  useEffect(() => {
    const unregister = setSessionEndHandler((code, token, source) => {
      const { auth } = store.getState()
      if (!auth.isAuthenticated) return
      if (token && token !== auth.token) return
      if (source === 'socket' && isOwnLogoutAllInFlight()) return
      endSessionAndLeave(code)
    })

    function handleSessionEnded(payload) {
      reportSessionEnded(payload && payload.code, socket.auth && socket.auth.token, 'socket')
    }
    // A revoke disconnects the account's sockets from the server side, which
    // Socket.IO never retries on its own. session_ended normally arrives
    // first; should it ever not, ask the API whether the session still
    // holds — a session-ending 401 signs out through the interceptor —
    // and otherwise just reconnect.
    function handleServerDisconnect(reason) {
      if (reason !== 'io server disconnect') return
      if (!store.getState().auth.isAuthenticated) {
        socket.connect()
        return
      }
      authService
        .getMe()
        .catch(() => {})
        .finally(() => {
          if (store.getState().auth.isAuthenticated) socket.connect()
        })
    }
    socket.on('session_ended', handleSessionEnded)
    socket.on('disconnect', handleServerDisconnect)
    return () => {
      unregister()
      socket.off('session_ended', handleSessionEnded)
      socket.off('disconnect', handleServerDisconnect)
    }
  }, [])

  return <AppRouter />
}

function App() {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  )
}

export default App
