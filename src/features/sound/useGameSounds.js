import { useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { selectSoundEnabled } from '../../store/slices/settingsSlice'
import { nextGameSound } from './moveSound.js'
import { playSound, preloadSounds } from './soundPlayer.js'

// Sounds for a live game (useGame's state): one sound whenever a NEW move is
// added — whoever made it (this player, an online opponent, the bot) — and
// the game-end sound when the game finishes without a move (timeout,
// resignation, accepted draw, opponent left). Nothing plays on the first
// render (opening the page, resuming an online game), for undo / redo /
// clicking an old move, or when a move the server rejected is taken back.
// The game-end sound plays once per game, even when an online checkmate is
// seen both here and in the server's game_over. The rules themselves live
// in moveSound.js's nextGameSound (tested in tests/rules/move-sound.test.js).
//
// `externalResult` is useGame's result that doesn't come from the board
// (null while there is none).
export function useGameSounds({ moveHistory, isGameOver, externalResult }) {
  const soundEnabled = useSelector(selectSoundEnabled)
  const lastMove = moveHistory.length > 0 ? moveHistory[moveHistory.length - 1] : null
  const previous = useRef(null)

  useEffect(() => {
    if (soundEnabled) preloadSounds()
  }, [soundEnabled])

  useEffect(() => {
    const { sound, endPlayed } = nextGameSound(previous.current, { lastMove, externalResult, isGameOver })
    previous.current = { lastMove, externalResult, endPlayed }
    if (sound && soundEnabled) playSound(sound)
  }, [lastMove, isGameOver, externalResult, soundEnabled])
}

export default useGameSounds
