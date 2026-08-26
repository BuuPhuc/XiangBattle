import { useEffect } from 'react'
import { Provider } from 'react-redux'
import store from './store'
import AppRouter from './routes'
import socket from './socket/socket'

function App() {
  // One connection for the app's whole lifetime: connect on mount, clean up
  // listeners and disconnect on unmount.
  useEffect(() => {
    function handleConnect() {
      console.log('[socket] connected:', socket.id)
    }
    function handleDisconnect(reason) {
      console.log('[socket] disconnected:', reason)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.connect()

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.disconnect()
    }
  }, [])

  return (
    <Provider store={store}>
      <AppRouter />
    </Provider>
  )
}

export default App
