import { useEffect } from 'react'
import { Provider } from 'react-redux'
import store from './store'
import AppRouter from './routes'
import socket from './socket/socket'
import useAuth from './components/hooks/useAuth'
import { onStoredUserChange } from './features/auth/authStorage'
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
