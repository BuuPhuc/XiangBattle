import { io } from 'socket.io-client'

// Single shared connection for the whole app — components/hooks should
// import this instance rather than each calling io() themselves, so there
// is ever only one socket connection to the backend.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  auth: {},
})

// Updates the JWT the socket presents on its next (re)connect — the
// server's io.use() middleware (see server/sockets/socketHandler.js) reads
// this to attach socket.user, but never requires it: passing `null` just
// makes the next connection a guest one, exactly like before auth existed.
export function setSocketAuthToken(token) {
  socket.auth = token ? { token } : {}
}

export default socket
