// Pure helpers for the clock's time control and its mm:ss display. Kept
// separate from useTimer.js (owns the ticking state) so a future "5+1",
// "15+5" etc. preset just becomes a different TIME_CONTROL object passed
// into useTimer, with no logic to touch.
export const DEFAULT_TIME_CONTROL = {
  moveTimeMs: 2 * 60 * 1000,
  gameTimeMs: 10 * 60 * 1000,
}

// Ceils to the next whole second so the display starts at e.g. 02:00 the
// instant a turn begins (0ms elapsed) and only steps down once a full
// second has actually elapsed, instead of visibly skipping 02:00 -> 01:59
// immediately on turn switch.
export function formatClockTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
