// Registers the base Socket.IO connection lifecycle. Game-specific events
// (rooms, moves, timers, ...) are out of scope for this step and will get
// their own handler modules registered from here later.
function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[socket] client connected: ${socket.id} (${socket.handshake.address})`)

    socket.on('disconnect', (reason) => {
      console.log(`[socket] client disconnected: ${socket.id} (${reason})`)
    })
  })
}

module.exports = registerSocketHandlers
