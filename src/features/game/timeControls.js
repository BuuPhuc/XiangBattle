// The time controls an online match can be played at — the one list both the
// picker (src/components/game/TimeControlPicker.jsx) and the server referee
// (server/rooms/room.js, loaded through require(esm)) read, so the two can
// never disagree about what "15 + 5" means.
//
//   gameTimeMs  — each side's total time for the whole game
//   moveTimeMs  — the most a single move may take (a turn ends at whichever
//                 of the two runs out first)
//   incrementMs — added to the mover's game time after every move they make
//
// Pure data and functions only: no React, no browser APIs.
const MINUTE = 60 * 1000
const SECOND = 1000

export const TIME_CONTROLS = [
  { id: '5+0', gameTimeMs: 5 * MINUTE, moveTimeMs: 1 * MINUTE, incrementMs: 0 },
  { id: '10+0', gameTimeMs: 10 * MINUTE, moveTimeMs: 2 * MINUTE, incrementMs: 0 },
  { id: '15+5', gameTimeMs: 15 * MINUTE, moveTimeMs: 2 * MINUTE, incrementMs: 5 * SECOND },
  { id: '20+5', gameTimeMs: 20 * MINUTE, moveTimeMs: 5 * MINUTE, incrementMs: 5 * SECOND },
]

export const DEFAULT_TIME_CONTROL_ID = '10+0'

const BY_ID = new Map(TIME_CONTROLS.map((control) => [control.id, control]))

export function isTimeControlId(id) {
  return typeof id === 'string' && BY_ID.has(id)
}

// The preset for `id`, or the default one for anything that is not a known
// id (missing, mistyped, or sent by a tampered client).
export function getTimeControl(id) {
  return BY_ID.get(id) ?? BY_ID.get(DEFAULT_TIME_CONTROL_ID)
}

// The preset a saved game was played at, from what the Game row stores
// (initialTime / increment, both in seconds). null when it matches none of
// today's presets.
export function findTimeControlBySeconds(initialTime, increment) {
  return (
    TIME_CONTROLS.find(
      (control) => control.gameTimeMs === initialTime * SECOND && control.incrementMs === (increment ?? 0) * SECOND
    ) ?? null
  )
}

// "10 + 0", "15 + 5" — minutes + seconds added per move.
export function formatTimeControlShort({ gameTimeMs, incrementMs }) {
  return `${Math.round(gameTimeMs / MINUTE)} + ${Math.round(incrementMs / SECOND)}`
}

// "10 phút", "15 phút + 5 giây".
export function formatTimeControlLabel({ gameTimeMs, incrementMs }) {
  const minutes = `${Math.round(gameTimeMs / MINUTE)} phút`
  return incrementMs > 0 ? `${minutes} + ${Math.round(incrementMs / SECOND)} giây` : minutes
}

// One sentence spelling the whole rule out, for under the picker's heading.
export function describeTimeControl({ gameTimeMs, moveTimeMs, incrementMs }) {
  const parts = [`Mỗi bên có ${Math.round(gameTimeMs / MINUTE)} phút`]
  if (incrementMs > 0) parts.push(`cộng ${Math.round(incrementMs / SECOND)} giây sau mỗi nước`)
  parts.push(`tối đa ${Math.round(moveTimeMs / MINUTE)} phút cho một nước`)
  return `${parts.join(', ')}.`
}

// "Ván 15 + 5" for a saved game's initialTime / increment (seconds) — works
// for older games too, which were all 10 minutes with no increment.
export function formatSavedTimeControl(initialTime, increment) {
  if (!Number.isFinite(initialTime) || initialTime <= 0) return null
  return formatTimeControlShort({ gameTimeMs: initialTime * SECOND, incrementMs: (increment ?? 0) * SECOND })
}
