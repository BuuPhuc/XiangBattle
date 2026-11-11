// Shared helpers for the frontend-side tests (node:test). The game and AI
// modules are plain ES modules with no browser/React dependencies, so the
// tests import them straight from src/.
export const P = (id, side, type, col, row) => ({ id, side, type, char: '?', col, row })

// Plain copies — NOT Object.freeze'd: frozen objects make V8 deoptimise the
// search 3–5x, which would skew every timing assertion. Immutability is
// tested separately (see *-immutability / rules tests) in its own process.
export const clone = (pieces) => pieces.map((p) => ({ ...p }))

export const deepFreeze = (pieces) => Object.freeze(pieces.map((p) => Object.freeze({ ...p })))

// Deterministic RNG so self-play and random-position tests are repeatable.
export function seededRandom(seed = 12345) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x80000000
  }
}
