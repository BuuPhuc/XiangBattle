import { useEffect } from 'react'
import { Provider } from 'react-redux'
import store from './store'
import AppRouter from './routes'
import socket from './socket/socket'
import useAuth from './components/hooks/useAuth'

// Runs inside <Provider> so useAuth (Redux) is available: on mount, restore
// a saved login session (if any) and arm the socket with its token *before*
// connecting, so the very first connection already carries the right
// identity instead of connecting as a guest and reconnecting a moment later.
function AppContent() {
  const { restoreSession } = useAuth()

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
