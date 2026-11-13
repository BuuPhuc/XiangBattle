import { useCallback, useEffect, useRef } from 'react'
import { runPuzzleTask } from '../engine/tasks.js'

// Asks the puzzle Web Worker to judge / hint / solve, as a Promise. One
// worker per page, created on first use. If workers are unavailable or the
// worker crashes, the same task runs on the main thread instead (puzzle
// positions are small, so that stays quick). Pending answers are dropped
// when the page unmounts.
export function usePuzzleSolver() {
  const workerRef = useRef(null)
  const pendingRef = useRef(new Map())
  const brokenRef = useRef(false)

  const runHere = (type, payload) =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(runPuzzleTask(type, payload))
        } catch (error) {
          reject(error)
        }
      }, 0)
    })

  const getWorker = () => {
    if (workerRef.current || brokenRef.current || typeof Worker === 'undefined') return workerRef.current
    try {
      const worker = new Worker(new URL('../puzzleWorker.js', import.meta.url), { type: 'module' })
      worker.onmessage = (event) => {
        const entry = pendingRef.current.get(event.data.id)
        if (!entry) return
        pendingRef.current.delete(event.data.id)
        if (event.data.error) entry.reject(new Error(event.data.error))
        else entry.resolve(event.data.result)
      }
      worker.onerror = (event) => {
        event.preventDefault()
        console.error('[puzzles] worker crashed:', event.message)
        worker.terminate()
        workerRef.current = null
        brokenRef.current = true
        // Re-run whatever was waiting on the main thread.
        for (const [, entry] of pendingRef.current) runHere(entry.type, entry.payload).then(entry.resolve, entry.reject)
        pendingRef.current.clear()
      }
      workerRef.current = worker
    } catch {
      brokenRef.current = true
    }
    return workerRef.current
  }

  const ask = useCallback((type, payload) => {
    const worker = getWorker()
    if (!worker) return runHere(type, payload)
    return new Promise((resolve, reject) => {
      const id = `${Date.now()}-${Math.random()}`
      pendingRef.current.set(id, { resolve, reject, type, payload })
      worker.postMessage({ id, type, payload })
    })
    // getWorker / runHere only touch refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(
    () => () => {
      workerRef.current?.terminate()
      workerRef.current = null
      pendingRef.current.clear()
    },
    []
  )

  return ask
}

export default usePuzzleSolver
