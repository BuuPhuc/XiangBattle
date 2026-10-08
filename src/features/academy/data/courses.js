// The Academy catalog: Course -> Lesson -> Challenge. Everything the UI and
// the server know about a course comes from here — adding a lesson or a
// whole new course (khai cuộc, chiến thuật, tàn cuộc, ...) means adding data
// in this folder, never touching a page or the challenge engine.
//
// Challenge shape (see engine/challengeEngine.js for how each field is used):
//   id           globally unique across the whole catalog — it is what a
//                user's saved progress is keyed by, so never rename one
//   title, instruction
//   pieces       starting position: [{ side, type, col, row }]
//   steps        one entry per move the player must make, each with
//                  accept    [{ from: [col, row], to: [col, row] }] — any one
//                            of these completes the step
//                  target    optional [col, row] to mark on the board
//                  mistakes  optional [{ to: [col, row], message }] — a
//                            specific explanation for a tempting wrong square
//                  successMessage  optional, shown before the next step
//   showMoves    optional — show the selected piece's legal-move dots
//   hint         optional text for the first hint level
//   successMessage / failureMessage  optional overrides
import { rookLesson } from './lessons/rook.js'
import { horseLesson } from './lessons/horse.js'
import { elephantLesson } from './lessons/elephant.js'
import { advisorLesson } from './lessons/advisor.js'
import { generalLesson } from './lessons/general.js'
import { cannonLesson } from './lessons/cannon.js'
import { pawnLesson } from './lessons/pawn.js'

export const COURSES = [
  {
    id: 'pieces',
    title: 'Quân cờ và nước đi',
    description: 'Tìm hiểu cách di chuyển và bắt ăn quân của từng quân cờ.',
    level: 'beginner',
    // Pieces drawn on the course card's thumbnail.
    thumbnail: ['rook', 'horse', 'cannon'],
    lessons: [rookLesson, horseLesson, elephantLesson, advisorLesson, generalLesson, cannonLesson, pawnLesson],
  },
]

export default COURSES
