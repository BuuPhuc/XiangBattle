// Starts the real backend (server.js) as a child process on a free port for
// socket-level tests, and connects socket.io clients to it.
//
// Uses the project's own server/.env (DATABASE_URL, JWT_SECRET) like
// `npm run dev` does — nothing secret is copied into the tests. The tests
// only use guest players and made-up account ids and never let a rated
// match start, so they write nothing to the database.
const path = require('node:path')
const net = require('node:net')
const { spawn } = require('node:child_process')

const SERVER_DIR = path.resolve(__dirname, '..', '..')
const REPO_ROOT = path.resolve(SERVER_DIR, '..')
const FAKE_TOKEN_STORE = path.join(__dirname, 'fakeTokenVersionStore.js')

// socket.io-client lives in the frontend's node_modules (the server package
// only has the socket.io server).
const { io } = require(path.join(REPO_ROOT, 'node_modules', 'socket.io-client'))

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

async function startServer() {
  const port = await freePort()
  // fakeTokenVersionStore.js keeps account token versions in memory, so the
  // made-up account ids below need no database rows — preloaded here, the
  // only place it is ever loaded (it refuses to load without this env flag).
  const child = spawn(process.execPath, ['-r', FAKE_TOKEN_STORE, 'server.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, PORT: String(port), XIANGBATTLE_FAKE_TOKEN_STORE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server did not start:\n${output}`)), 20_000)
    const onData = (chunk) => {
      output += chunk
      if (/listening on/i.test(output)) {
        clearTimeout(timer)
        resolve()
      }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`server exited (${code}) before listening:\n${output}`))
    })
  })
  return {
    url: `http://localhost:${port}`,
    stop: () =>
      new Promise((resolve) => {
        child.removeAllListeners('exit')
        child.once('exit', resolve)
        child.kill()
      }),
  }
}

// `setup(socket)` runs before the handshake — for listeners that must not
// miss an event the server sends right on connect.
function connect(url, auth = {}, setup) {
  return new Promise((resolve, reject) => {
    const socket = io(url, { transports: ['websocket'], auth, reconnection: false })
    if (setup) setup(socket)
    socket.once('connect', () => resolve(socket))
    socket.once('connect_error', reject)
  })
}

// Resolves with { event, payload } for whichever of `events` arrives first,
// or null after `ms`.
function firstOf(socket, events, ms = 1500) {
  return new Promise((resolve) => {
    const handlers = {}
    const done = (result) => {
      clearTimeout(timer)
      events.forEach((e) => socket.off(e, handlers[e]))
      resolve(result)
    }
    const timer = setTimeout(() => done(null), ms)
    events.forEach((e) => {
      handlers[e] = (payload) => done({ event: e, payload })
      socket.on(e, handlers[e])
    })
  })
}

module.exports = { SERVER_DIR, startServer, connect, firstOf }
