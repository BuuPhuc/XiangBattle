const express = require('express')
const http = require('http')
const cors = require('cors')
const dotenv = require('dotenv')
const { Server } = require('socket.io')
const registerSocketHandlers = require('./sockets/socketHandler')

dotenv.config()

const PORT = process.env.PORT || 3000

// Accepts any localhost/127.0.0.1 origin regardless of port, since Vite
// picks the next free port (5173, 5174, ...) when the default is busy.
const isAllowedOrigin = (origin) => !origin || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
}

const app = express()
app.use(cors(corsOptions))

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'XiangBattle backend is running' })
})

const httpServer = http.createServer(app)

const io = new Server(httpServer, {
  cors: corsOptions,
})

registerSocketHandlers(io)

httpServer.listen(PORT, () => {
  console.log(`XiangBattle backend listening on http://localhost:${PORT}`)
})
