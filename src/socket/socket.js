import { io } from 'socket.io-client'

// Single shared connection for the whole app — components/hooks should
// import this instance rather than each calling io() themselves, so there
// is ever only one socket connection to the backend.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'

export const socket = io(SOCKET_URL, {
  autoConnect: false,
})

export default socket
