// Plays the board sounds (public/sounds/, see CREDITS.md there). One
// <audio> element per sound, created on first use and reused after that.
// Never blocks: play() is fire-and-forget — if the file hasn't loaded yet the
// browser starts it when it can, and if the browser refuses (no user
// interaction with the page yet, no audio device) the error is swallowed.
import { SOUND } from './moveSound.js'

const BASE = import.meta.env.BASE_URL

const SOUND_FILES = {
  [SOUND.MOVE]: `${BASE}sounds/move.mp3`,
  [SOUND.CAPTURE]: `${BASE}sounds/capture.mp3`,
  [SOUND.CHECK]: `${BASE}sounds/check.mp3`,
  [SOUND.GAME_END]: `${BASE}sounds/game-end.mp3`,
}

// Full volume (the most an <audio> element allows). 0.5 was tried first and
// was too quiet: these are very short knocks, quiet on average even though
// their peaks are near 0 dB.
const VOLUME = 1

const elements = {}

function getAudio(name) {
  if (typeof Audio === 'undefined' || !SOUND_FILES[name]) return null
  if (!elements[name]) {
    const audio = new Audio(SOUND_FILES[name])
    audio.preload = 'auto'
    audio.volume = VOLUME
    elements[name] = audio
  }
  return elements[name]
}

// Starts downloading every sound in the background, so the first move
// doesn't wait on the network. Safe to call more than once.
export function preloadSounds() {
  for (const name of Object.keys(SOUND_FILES)) getAudio(name)
}

export function playSound(name) {
  const audio = getAudio(name)
  if (!audio) return
  try {
    // Restart if the same sound is still playing from the previous move.
    audio.currentTime = 0
    const result = audio.play()
    if (result && typeof result.catch === 'function') result.catch(() => {})
  } catch {
    // Some browsers throw synchronously instead of rejecting — same thing.
  }
}
