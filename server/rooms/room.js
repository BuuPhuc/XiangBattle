// Reused as-is rather than re-deriving the same `u:<userId>` parsing here —
// gameHistoryService.js already owns the one definition of "which playerId
// strings are a real logged-in account".
const { parseUserId } = require('../services/gameHistoryService')
const { initialBoard, validateMove, judgeRepetition } = require('../game/xiangqiEngine')

const ROOM_STATUS = {
  WAITING: 'waiting',
  PLAYING: 'playing',
}

const COLORS = {
  RED: 'red',
  BLACK: 'black',
}

// Every way a match can end, all decided by the server — each mirrors the
// matching frontend GAME_STATUS.* value in src/features/game/gameLogic.js
// exactly.
const GAME_STATUS = {
  CHECKMATE: 'checkmate',
  STALEMATE: 'stalemate',
  // Repetition verdicts (src/features/game/utils/repetitionUtils.js).
  PERPETUAL_CHECK: 'perpetual-check',
  PERPETUAL_CHASE: 'perpetual-chase',
  REPETITION_DRAW: 'repetition-draw',
  TIMEOUT_MOVE: 'timeout-move',
  TIMEOUT_GAME: 'timeout-game',
  OPPONENT_LEFT: 'opponent-left',
  RESIGN: 'resign',
  DRAW: 'draw',
}

// Called when the side to move runs out of time. Registered once by the
// socket layer (see sockets/gameHandler.js), since only it has `io` to
// broadcast the result — Room itself stays transport-agnostic.
let turnTimeoutHandler = null
function setTurnTimeoutHandler(handler) {
  turnTimeoutHandler = handler
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
// demand. The server is the referee: it keeps its own copy of the board,
// validates every move against it (game/xiangqiEngine.js), detects
// checkmate/stalemate itself and enforces the clocks with its own timer —
// nothing about a match's outcome is ever taken from a client.
class Room {
  constructor(roomId, hostSocketId, hostPlayerId) {
    this.roomId = roomId
    this.status = ROOM_STATUS.WAITING
    this.createdAt = Date.now()
    this.currentTurn = null // assigned by startGame()
    this.moveHistory = [] // same shape as the frontend's moveHistory entries
    this.resetBoard() // this.pieces (the server's authoritative board) + this.positions
    this.turnTimer = null // fires when the side to move runs out of time
    this.timeControl = { ...DEFAULT_TIME_CONTROL }
    this.remainingGameTime = { red: DEFAULT_TIME_CONTROL.gameTimeMs, black: DEFAULT_TIME_CONTROL.gameTimeMs }
    this.turnStartedAt = null // wall-clock ms the current turn began; combined with remainingGameTime this reconstructs each side's live clock without the server ever having to "tick"
    // Set once the match ends, by whichever server-side path decided it
    // (checkmate/stalemate in playMove, clock timeout, resign, draw,
    // disconnect forfeit). { status, winner, loser } | null
    this.matchResult = null
    // Color of whichever player currently has an outstanding draw offer
    // awaiting the other side's response, or null. Purely a live
    // request/response handshake between the two connected sockets — never
    // part of the reconnect snapshot (toGameStarted), so it's never
    // persisted beyond the moment it's resolved. Always cleared the instant
    // any match result is recorded (see recordMatchResult), which is what
    // guarantees a resign/checkmate/timeout cancels a pending offer.
    this.drawOfferBy = null
    // Color of whichever player has asked for a rematch once this match
    // concluded and is waiting on the other side's response, or null. Same
    // lifecycle as drawOfferBy — a live handshake only, cleared the instant
    // a new match actually starts (startGame) or a player leaves for good
    // (removePlayer).
    this.playAgainRequestBy = null
    // { red: number|null, black: number|null } | null — each seated
    // account's rating as of match start, looked up once both colors are
    // assigned (see gameHistoryService.js's attachPlayerRatings, called
    // alongside createGameRecord). null for a guest seat (no User row to
    // read), and null for the whole object until the lookup resolves —
    // toPublic()/toGameStarted() below fall back to null per player rather
    // than ever inventing a number. Reset on every fresh match (startGame)
    // and cleared when the room empties back out (removePlayer), same
    // lifecycle as moveHistory/matchResult.
    this.playerRatings = null
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
    // Takes whichever seat is free rather than assuming seat 2: when the
    // host (seat 1) has left and someone joins the remaining player — e.g.
    // an opponent accepting a rematch invite after leaving — "length + 1"
    // would hand out a second seat 2 and startGame() would make both black.
    const seatOneTaken = this.players.some((existing) => existing.playerNumber === 1)
    const player = { socketId, playerId, playerNumber: seatOneTaken ? this.players.length + 1 : 1, color: null, connected: true }
    this.players.push(player)
    return player
  }

  removePlayer(socketId) {
    this.players = this.players.filter((player) => player.socketId !== socketId)
    // A player leaving for good (explicit leave, or a disconnect that ran
    // out its reconnect grace period) always drops the room back to
    // waiting — there's no resume-a-match-with-a-stranger flow, so any
    // in-progress match state is cleared along with them.
    this.clearTurnTimer()
    this.status = ROOM_STATUS.WAITING
    this.currentTurn = null
    this.moveHistory = []
    this.resetBoard()
    this.matchResult = null
    this.drawOfferBy = null
    this.playAgainRequestBy = null
    this.turnStartedAt = null
    this.remainingGameTime = { red: this.timeControl.gameTimeMs, black: this.timeControl.gameTimeMs }
    this.messages = []
    this.playerRatings = null
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
    this.resetBoard()
    this.matchResult = null
    this.drawOfferBy = null
    this.playAgainRequestBy = null
    this.remainingGameTime = { red: this.timeControl.gameTimeMs, black: this.timeControl.gameTimeMs }
    this.turnStartedAt = Date.now()
    this.scheduleTurnDeadline()
    // A rematch (play_again reuses this same Room) starts a clean chat too —
    // never let the previous match's messages bleed into the new one.
    this.messages = []
    // Cleared here (rather than left stale from the previous match) — the
    // caller re-fetches it fresh right after this (see
    // gameHistoryService.js's attachPlayerRatings), same async-fill-in
    // pattern as dbGameId/createGameRecord below it.
    this.playerRatings = null
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

  // Marks `color` as having just asked for a rematch. Callers are expected
  // to have already checked there isn't one pending from this same color
  // (see gameHandler.js) — this never overwrites/stacks requests itself.
  requestPlayAgain(color) {
    this.playAgainRequestBy = color
  }

  // Withdraws/resolves whatever rematch request is currently pending,
  // without touching anything else about the match.
  clearPlayAgainRequest() {
    this.playAgainRequestBy = null
  }

  // Validates and plays a move proposed by the side to move — the client
  // only says which square to move from/to; the board after, the captured
  // piece and the notation are all computed here from the server's own
  // board. Returns { ok: false, code, message } for an illegal move
  // (nothing changes), or { ok: true, entry, outcome, winner } where
  // `outcome` is null, or the GAME_STATUS this move ended the game with —
  // CHECKMATE / STALEMATE (the mover wins), or a repetition verdict
  // (PERPETUAL_CHECK / PERPETUAL_CHASE: `winner` is the side NOT at fault;
  // REPETITION_DRAW: `winner` is null). The caller records the result.
  // Call sites are expected to have already checked it's this player's
  // turn and their clock hasn't expired.
  playMove(from, to) {
    const mover = this.currentTurn
    const result = validateMove(this.pieces, mover, from, to)
    if (!result.ok) return result

    const now = Date.now()
    const elapsed = this.turnStartedAt ? Math.max(0, now - this.turnStartedAt) : 0
    this.remainingGameTime[mover] = Math.max(0, this.remainingGameTime[mover] - elapsed)

    const entry = { ply: this.moveHistory.length + 1, ...result.move, timestamp: now }
    this.moveHistory.push(entry)
    this.pieces = entry.piecesAfter
    this.currentTurn = mover === COLORS.RED ? COLORS.BLACK : COLORS.RED
    this.positions.push({ pieces: this.pieces, side: this.currentTurn })
    this.turnStartedAt = now
    this.scheduleTurnDeadline()

    if (result.outcome) return { ok: true, entry, outcome: result.outcome, winner: mover }
    const repetition = judgeRepetition(this.positions)
    if (repetition) return { ok: true, entry, outcome: repetition.status, winner: repetition.winner }
    return { ok: true, entry, outcome: null, winner: null }
  }

  // Back to the starting position: the board, plus the list of positions
  // played so far ({ pieces, side to move }) that repetition is judged on.
  resetBoard() {
    this.pieces = initialBoard()
    this.positions = [{ pieces: this.pieces, side: COLORS.RED }]
  }

  // The clock timeout the side to move has hit as of `now`, or null if
  // they still have time: { status: TIMEOUT_MOVE | TIMEOUT_GAME, loser }.
  // A turn ends at whichever limit comes first — the side's remaining game
  // time or the per-move limit.
  getExpiredTimeout(now = Date.now()) {
    if (this.status !== ROOM_STATUS.PLAYING || this.matchResult || !this.turnStartedAt) return null
    const side = this.currentTurn
    const elapsed = now - this.turnStartedAt
    if (elapsed >= this.remainingGameTime[side]) return { status: GAME_STATUS.TIMEOUT_GAME, loser: side }
    if (elapsed >= this.timeControl.moveTimeMs) return { status: GAME_STATUS.TIMEOUT_MOVE, loser: side }
    return null
  }

  // (Re)arms the timer for the current turn's deadline, so a timeout ends
  // the match even if neither client ever reports it.
  scheduleTurnDeadline() {
    this.clearTurnTimer()
    if (this.status !== ROOM_STATUS.PLAYING || this.matchResult || !this.turnStartedAt) return
    const side = this.currentTurn
    const budget = Math.min(this.timeControl.moveTimeMs, this.remainingGameTime[side])
    const delay = Math.max(0, this.turnStartedAt + budget - Date.now())
    this.turnTimer = setTimeout(() => {
      this.turnTimer = null
      if (turnTimeoutHandler) turnTimeoutHandler(this)
    }, delay)
  }

  clearTurnTimer() {
    if (this.turnTimer) clearTimeout(this.turnTimer)
    this.turnTimer = null
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
    this.clearTurnTimer()
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

  // This seat's rating as of match start, or null — before playerRatings
  // has resolved, for a color-less (not-yet-seated) player, or for a guest
  // seat with no User row to read. Never a guessed/placeholder number.
  ratingFor(color) {
    if (!this.playerRatings || !color) return null
    return this.playerRatings[color] ?? null
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
        rating: this.ratingFor(player.color),
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
      // userId (never the raw playerId string) is what lets a client link a
      // PlayerCard to /profile/:userId — see src/pages/ChessGame/sections/
      // PlayerCard.jsx. null for a guest seat, same as ratingFor.
      you: you
        ? { playerNumber: you.playerNumber, color: you.color, rating: this.ratingFor(you.color), userId: parseUserId(you.playerId) }
        : null,
      opponent: opponent
        ? {
            playerNumber: opponent.playerNumber,
            color: opponent.color,
            connected: opponent.connected,
            rating: this.ratingFor(opponent.color),
            userId: parseUserId(opponent.playerId),
          }
        : null,
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

module.exports = { Room, ROOM_STATUS, COLORS, GAME_STATUS, MAX_PLAYERS, DEFAULT_TIME_CONTROL, setTurnTimeoutHandler }
