const dotenv = require('dotenv')
dotenv.config()

// Loaded only after dotenv.config() — utils/token.js reads JWT_SECRET at
// module-load time, so anything requiring it (directly or transitively)
// must come after the env is populated.
const express = require('express')
const http = require('http')
const cors = require('cors')
const { Server } = require('socket.io')
const registerSocketHandlers = require('./sockets/socketHandler')
const authRoutes = require('./routes/authRoutes')
const gameRoutes = require('./routes/gameRoutes')
const userRoutes = require('./routes/userRoutes')

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
app.use(express.json())

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'XiangBattle backend is running' })
})

app.use('/api/auth', authRoutes)
app.use('/api/games', gameRoutes)
app.use('/api/users', userRoutes)

const httpServer = http.createServer(app)

const io = new Server(httpServer, {
  cors: corsOptions,
})

registerSocketHandlers(io)

httpServer.listen(PORT, () => {
  console.log(`XiangBattle backend listening on http://localhost:${PORT}`)
})
