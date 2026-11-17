import { useCallback, useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { saveGameAnalysis, selectGameAnalysis } from '../../store/slices/analysisSlice'

// Phân tích ván for one saved game on the Replay page.
//   status   — 'idle' (not analysed), 'running', 'done', or 'error'
//   evals    — one evaluation per position (analysis.js's analyzePosition),
//              filled in as the worker gets through them; null when idle
//   progress — { done, total } positions
//   start() / cancel()
// A finished analysis is saved (Redux → this browser, analysisStorage.js),
// so reopening the game shows it at once. Leaving the page or cancelling
// stops the worker; a half-done analysis is not kept.
export function useGameAnalysis(gameId, moveHistory) {
  const dispatch = useDispatch()
  const saved = useSelector((state) => selectGameAnalysis(state, gameId))
  const [run, setRun] = useState(null) // { gameId, status: 'running' | 'error', evals, error }
  const workerRef = useRef(null)
  const evalsRef = useRef([]) // the running analysis's results so far (what `run.evals` shows)

  const stopWorker = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
  }, [])

  // A different game, or leaving the page: whatever was running is dropped.
  useEffect(() => stopWorker, [gameId, stopWorker])

  const start = useCallback(() => {
    stopWorker()
    if (!moveHistory || moveHistory.length === 0) return
    let worker
    try {
      worker = new Worker(new URL('./analysisWorker.js', import.meta.url), { type: 'module' })
    } catch {
      setRun({ gameId, status: 'error', evals: [], error: 'Trình duyệt này không chạy được phân tích.' })
      return
    }
    workerRef.current = worker
    evalsRef.current = []
    setRun({ gameId, status: 'running', evals: [], error: null })

    worker.onmessage = (event) => {
      if (workerRef.current !== worker) return
      const message = event.data
      if (message.type === 'progress') {
        const evals = evalsRef.current.slice()
        evals[message.index] = message.evaluation
        evalsRef.current = evals
        setRun((current) => (current ? { ...current, evals } : current))
      } else if (message.type === 'done') {
        stopWorker()
        dispatch(saveGameAnalysis({ gameId, evals: evalsRef.current, savedAt: Date.now() }))
        setRun(null)
      } else if (message.type === 'error') {
        stopWorker()
        setRun((current) => ({ ...current, status: 'error', error: 'Phân tích bị lỗi. Hãy thử lại.' }))
      }
    }
    worker.onerror = () => {
      if (workerRef.current !== worker) return
      stopWorker()
      setRun((current) => ({ ...current, status: 'error', error: 'Phân tích bị lỗi. Hãy thử lại.' }))
    }
    worker.postMessage({ moveHistory })
  }, [dispatch, gameId, moveHistory, stopWorker])

  const cancel = useCallback(() => {
    stopWorker()
    setRun(null)
  }, [stopWorker])

  const total = (moveHistory?.length ?? 0) + 1
  const current = run && run.gameId === gameId ? run : null
  if (current) {
    return {
      status: current.status,
      evals: current.evals,
      error: current.error,
      progress: { done: current.evals.filter(Boolean).length, total },
      start,
      cancel,
    }
  }
  if (saved && saved.evals.length === total) {
    return { status: 'done', evals: saved.evals, error: null, progress: { done: total, total }, start, cancel }
  }
  return { status: 'idle', evals: null, error: null, progress: { done: 0, total }, start, cancel }
}

export default useGameAnalysis
