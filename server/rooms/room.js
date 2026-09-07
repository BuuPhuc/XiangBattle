const ROOM_STATUS = {
  WAITING: 'waiting',
  PLAYING: 'playing',
}

const COLORS = {
  RED: 'red',
  BLACK: 'black',
}

// Server-produced game-over reasons that aren't a chess outcome the client
// derived on its own — each mirrors the matching frontend
// GAME_STATUS.* value in src/features/game/gameLogic.js exactly (the two
// codebases can't share a module, red/black and 'waiting'/'playing' are
// duplicated the same way already).
const GAME_STATUS = {
  OPPONENT_LEFT: 'opponent-left',
  RESIGN: 'resign',
  DRAW: 'draw',
}

const MAX_PLAYERS = 2

// Simple memory safeguard for a very long-lived room/match — chat is never
// persisted or paginated, so this just stops the in-memory array from
// growing without bound. Well above anything a real 2-player match chat
// would ever reach.
const MAX_MESSAGES = 200

const DEFAULT_TIME_CONTROL = {
  moveTimeMs: 2 * 60 * 1000,
  gameTimeMs: 10 * 60 * 1000,
}

// A Room is membership + minimal match bookkeeping — roomId, players (with
// their assigned color once a game starts), status, whose turn it is, the
// move history needed to keep both clients' boards in lockstep, and enough
// clock bookkeeping to answer "how much time does each side have left" on
// demand. The server never validates a move's chess legality (that stays
// entirely in the existing frontend game logic, on the moving client) — it
// only owns turn order/sequencing and, for reconnect, who's still here.
class Room {
  constructor(roomId, hostSocketId, hostPlayerId) {
    this.roomId = roomId
    this.status = ROOM_STATUS.WAITING
    this.createdAt = Date.now()
    this.currentTurn = null // assigned by startGame()
    this.moveHistory = [] // same shape as the frontend's moveHistory entries
    this.timeControl = { ...DEFAULT_TIME_CONTROL }
    this.remainingGameTime = { red: DEFAULT_TIME_CONTROL.gameTimeMs, black: DEFAULT_TIME_CONTROL.gameTimeMs }
    this.turnStartedAt = null // wall-clock ms the current turn began; combined with remainingGameTime this reconstructs each side's live clock without the server ever having to "tick"
    // Only ever set by the disconnect-forfeit path (see reconnectHandler.js)
    // — a checkmate doesn't need this, since replaying moveHistory on any
    // client re-derives it identically via the existing (unchanged) rule
    // engine. { status, winner, loser } | null
    this.matchResult = null
    // Color of whichever player currently has an outstanding draw offer
    // awaiting the other side's response, or null. Purely a live
    // request/response handshake between the two connected sockets — never
    // part of the reconnect snapshot (toGameStarted), so it's never
    // persisted beyond the moment it's resolved. Always cleared the instant
    // any match result is recorded (see recordMatchResult), which is what
    // guarantees a resign/checkmate/timeout cancels a pending offer.
    this.drawOfferBy = null
    // In-memory-only chat log for this room — never persisted anywhere, and
    // wiped on every rematch/leave alongside moveHistory (see startGame()
    // and removePlayer() below) so a new match never carries over the old
    // one's chat. Garbage-collected along with the rest of the Room when
    // roomManager deletes it (empty room, or explicit deleteRoom) — nothing
    // extra needed for "room destroy frees the chat".
    this.messages = []
    // No auth/user system yet, so playerId is a client-generated identity
    // (persisted in sessionStorage) used purely to recognize "this new
    // socket is still the same player" across a refresh/reconnect —
    // socketId alone can't do that, since it changes every time.
    this.players = [
      { socketId: hostSocketId, playerId: hostPlayerId, playerNumber: 1, color: null, connected: true },
    ]
  }

  isFull() {
    return this.players.length >= MAX_PLAYERS
  }

  isEmpty() {
    return this.players.length === 0
  }

  hasPlayer(socketId) {
    return this.players.some((player) => player.socketId === socketId)
  }

  getPlayer(socketId) {
    return this.players.find((player) => player.socketId === socketId) || null
  }

  getPlayerByPlayerId(playerId) {
    return this.players.find((player) => player.playerId === playerId) || null
  }

  getOpponent(socketId) {
    return this.players.find((player) => player.socketId !== socketId) || null
  }

  addPlayer(socketId, playerId) {
    const player = { socketId, playerId, playerNumber: this.players.length + 1, color: null, connected: true }
    this.players.push(player)
    return player
  }

  removePlayer(socketId) {
    this.players = this.players.filter((player) => player.socketId !== socketId)
    // A player leaving for good (explicit leave, or a disconnect that ran
    // out its reconnect grace period) always drops the room back to
    // waiting — there's no resume-a-match-with-a-stranger flow, so any
    // in-progress match state is cleared along with them.
    this.status = ROOM_STATUS.WAITING
    this.currentTurn = null
    this.moveHistory = []
    this.matchResult = null
    this.drawOfferBy = null
    this.turnStartedAt = null
    this.remainingGameTime = { red: this.timeControl.gameTimeMs, black: this.timeControl.gameTimeMs }
    this.messages = []
    this.players.forEach((player) => {
      player.color = null
    })
    return this.players
  }

  // Marks the player behind `socketId` as disconnected without touching
  // anything about the match itself — board, turn, history and clocks all
  // keep existing exactly as they were, so a reconnect has something to
  // resume. Returns the player record, or null if socketId isn't in here.
  markDisconnected(socketId) {
    const player = this.getPlayer(socketId)
    if (player) player.connected = false
    return player
  }

  // Reattaches a fresh socket to an existing player identity (found by the
  // stable playerId, not the now-dead old socketId). Never creates a new
  // player — if playerId doesn't match anyone here, returns null and the
  // caller should treat it as "nothing to reconnect to".
  reconnectPlayer(playerId, newSocketId) {
    const player = this.getPlayerByPlayerId(playerId)
    if (!player) return null
    player.socketId = newSocketId
    player.connected = true
    return player
  }

  // Called once the room reaches MAX_PLAYERS. The server is the sole
  // authority on color: the creator (seat 1) plays red and always moves
  // first, matching standard Xiangqi. Never let a client pick its own color.
  startGame() {
    this.players.forEach((player) => {
      player.color = player.playerNumber === 1 ? COLORS.RED : COLORS.BLACK
    })
    this.status = ROOM_STATUS.PLAYING
    this.currentTurn = COLORS.RED
    this.moveHistory = []
    this.matchResult = null
    this.drawOfferBy = null
    this.remainingGameTime = { red: this.timeControl.gameTimeMs, black: this.timeControl.gameTimeMs }
    this.turnStartedAt = Date.now()
    // A rematch (play_again reuses this same Room) starts a clean chat too —
    // never let the previous match's messages bleed into the new one.
    this.messages = []
  }

  // Appends a chat message to this room's in-memory log — the only place
  // messages are ever stored, never a database. Server-authoritative shape:
  // callers (chatHandler.js) supply the already-validated/trimmed text plus
  // the sender identity it derived itself from the socket/room, never
  // anything the client claims about who it is.
  addMessage(playerId, playerName, message) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      playerId,
      playerName,
      message,
      createdAt: Date.now(),
    }
    this.messages.push(entry)
    if (this.messages.length > MAX_MESSAGES) this.messages.shift()
    return entry
  }

  // Marks `color` as having just offered a draw. Callers are expected to
  // have already checked there isn't one pending (see gameHandler.js) —
  // this never overwrites/stacks offers itself.
  offerDraw(color) {
    this.drawOfferBy = color
  }

  // Withdraws/resolves whatever draw offer is currently pending, without
  // touching anything else about the match.
  clearDrawOffer() {
    this.drawOfferBy = null
  }

  // Appends a move the mover's own client already fully computed and
  // validated (piece/from/to/captured/piecesAfter/notation) — the server
  // doesn't re-derive any of that, it only stamps the authoritative ply
  // number, turn and timestamp, banks the elapsed time against whoever's
  // turn is ending, then flips whose turn it is next. Call sites are
  // expected to have already checked it's this player's turn.
  recordMove(move) {
    const now = Date.now()
    const elapsed = this.turnStartedAt ? Math.max(0, now - this.turnStartedAt) : 0
    this.remainingGameTime[this.currentTurn] = Math.max(0, this.remainingGameTime[this.currentTurn] - elapsed)

    const entry = {
      ply: this.moveHistory.length + 1,
      turn: this.currentTurn,
      piece: move.piece,
      from: move.from,
      to: move.to,
      captured: move.captured ?? null,
      piecesAfter: move.piecesAfter,
      notation: move.notation,
      timestamp: now,
    }
    this.moveHistory.push(entry)
    this.currentTurn = this.currentTurn === COLORS.RED ? COLORS.BLACK : COLORS.RED
    this.turnStartedAt = now
    return entry
  }

  // First (and only) result ever recorded for a match — idempotent so a
  // late-firing grace-period timeout (or a draw response arriving after
  // the game already ended some other way) can never overwrite/contest a
  // result that already exists for some other reason. `winner` is null
  // for a draw (GAME_STATUS.DRAW) — the only case with no losing side —
  // and a real color for every other outcome. Always clears any pending
  // draw offer, since a match result of any kind (resign/checkmate/timeout
  // included) makes an outstanding offer moot.
  recordMatchResult(status, winner) {
    if (this.matchResult) return this.matchResult
    this.drawOfferBy = null
    const loser = winner ? (winner === COLORS.RED ? COLORS.BLACK : COLORS.RED) : null
    this.matchResult = { status, winner, loser }
    return this.matchResult
  }

  // Reconstructs each side's live remaining move-time/game-time on demand
  // — mirrors exactly how the frontend's useTimer computes its own display
  // (committed-at-last-boundary minus elapsed-since), so a client that
  // receives this can seed its own timer and continue ticking seamlessly.
  getTimerSnapshot() {
    const now = Date.now()
    const elapsed = this.status === ROOM_STATUS.PLAYING && this.turnStartedAt ? Math.max(0, now - this.turnStartedAt) : 0
    const build = (side) => {
      if (side !== this.currentTurn || this.status !== ROOM_STATUS.PLAYING) {
        return { moveTime: this.timeControl.moveTimeMs, gameTime: this.remainingGameTime[side] }
      }
      return {
        moveTime: Math.max(0, this.timeControl.moveTimeMs - elapsed),
        gameTime: Math.max(0, this.remainingGameTime[side] - elapsed),
      }
    }
    return { red: build(COLORS.RED), black: build(COLORS.BLACK) }
  }

  // Shape sent to clients — never leak socketId, clients only need seat
  // numbers/colors/connection status and (via the separate `you`/`opponent`
  // fields on their own events) which seat is theirs.
  toPublic() {
    return {
      roomId: this.roomId,
      status: this.status,
      players: this.players.map((player) => ({
        playerNumber: player.playerNumber,
        color: player.color,
        connected: player.connected,
      })),
    }
  }

  // Full per-recipient game snapshot — used for game_started (a fresh
  // match, moveHistory/matchResult always empty/null) and reused as-is for
  // the reconnect restore payload (game_state), where moveHistory and a
  // possible matchResult are exactly what let the client pick back up
  // without recreating anything.
  toGameStarted(recipientSocketId) {
    const you = this.getPlayer(recipientSocketId)
    const opponent = this.getOpponent(recipientSocketId)
    return {
      ...this.toPublic(),
      you: you ? { playerNumber: you.playerNumber, color: you.color } : null,
      opponent: opponent ? { playerNumber: opponent.playerNumber, color: opponent.color, connected: opponent.connected } : null,
      currentTurn: this.currentTurn,
      moveHistory: this.moveHistory,
      matchResult: this.matchResult,
      timerState: this.getTimerSnapshot(),
      // Empty for a brand new match, populated on a reconnect's game_state —
      // this is what lets a reconnecting client restore the chat log without
      // a separate chat:history round trip.
      messages: this.messages,
    }
  }
}

module.exports = { Room, ROOM_STATUS, COLORS, GAME_STATUS, MAX_PLAYERS, DEFAULT_TIME_CONTROL }
