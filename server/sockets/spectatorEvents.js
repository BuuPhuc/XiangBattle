// How the rest of the server talks to the people watching a room.
//
// Spectators sit in their own Socket.IO channel, `watch:<roomId>`, never in
// the players' `<roomId>` channel: much of what goes to that channel is the
// players' own business (draw offers, rematch requests, their chat), so
// nothing reaches spectators unless it is sent here on purpose. Every event
// they get is named `spectate:<event>`, so the watch page's listeners can
// never mix with a player's.
//
// No requires on purpose: rooms, handlers and gameHistoryService all use
// this, and it must not pull any of them in.

function watchChannel(roomId) {
  return `watch:${roomId}`
}

function toWatchers(io, roomId, event, payload) {
  io.to(watchChannel(roomId)).emit(`spectate:${event}`, payload)
}

// A match result: the players get `game_over` as always, spectators the
// same result as `spectate:game_over`. Every path that ends a match goes
// through here, so spectators can't miss one.
function emitGameOver(io, room, result) {
  io.to(room.roomId).emit('game_over', result)
  toWatchers(io, room.roomId, 'game_over', result)
}

// The full picture for spectators — on watch, and whenever a new match
// starts in the room (a rematch).
function sendSpectatorState(io, room) {
  toWatchers(io, room.roomId, 'state', room.toSpectatorState())
}

// Who is watching changed: both players and spectators show it (the eye
// next to the time control), under the same event name.
function broadcastSpectators(io, room) {
  io.to([room.roomId, watchChannel(room.roomId)]).emit('spectators_update', room.spectatorSummary())
}

module.exports = { watchChannel, toWatchers, emitGameOver, sendSpectatorState, broadcastSpectators }
