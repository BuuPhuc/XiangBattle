// The three things the puzzle page asks of the solver — shared by the Web
// Worker and its main-thread fallback, so both answer identically.
import { createSolver, findHintMove, judgeMove, solutionLine } from './solver.js'

export function runPuzzleTask(type, { pieces, attacker, move, remaining }) {
  const solver = createSolver()
  switch (type) {
    case 'judge':
      return judgeMove(pieces, attacker, move, remaining, solver)
    case 'hint':
      return { move: findHintMove(pieces, attacker, remaining, solver) }
    case 'solution':
      return { line: solutionLine(pieces, attacker, remaining, solver) }
    default:
      throw new Error(`unknown puzzle task: ${type}`)
  }
}
