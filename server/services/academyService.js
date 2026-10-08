const { db } = require('../prisma/db')

const AcademyProgress = db.orm.public.AcademyProgress

// The Academy catalog (courses, lessons, challenges, accepted solutions) and
// the engine that judges a solution live in the client's source tree — one
// copy, used by both sides: the board in the browser, and this service
// before it saves anything. Importing it here rather than keeping a second
// copy is what guarantees the server can never disagree with the board about
// what solves a challenge, or about how a piece moves. Those files are ES
// modules (this server is CommonJS), hence the dynamic import; it is loaded
// once and reused. A failed load is not cached, so the next request retries.
let catalogPromise = null

function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = import('../../src/features/academy/catalog.js').catch((error) => {
      catalogPromise = null
      throw error
    })
  }
  return catalogPromise
}

// Loaded at boot rather than on the first request. Under `npm run dev`
// (node --watch) a module imported for the first time joins the watch list,
// and that can restart the server once — at boot that costs nothing, in the
// middle of a learner's first "complete" request it would drop the save.
loadCatalog().catch((error) => {
  console.error('[academy] failed to load the challenge catalog:', error.message)
})

function academyServiceError(code, message) {
  return Object.assign(new Error(message), { code })
}

function isUniqueViolation(error) {
  return error && (error.sqlState === '23505' || error.code === '23505')
}

// Ids of every challenge userId has completed. Rows whose challenge has since
// been removed from the catalog are simply ignored by the client.
async function listCompletedChallengeIds(userId) {
  const rows = await AcademyProgress.select('challengeId').where({ userId }).all()
  return rows.map((row) => row.challengeId)
}

// Records that userId solved `challengeId` of `courseId` — but only after
// replaying the moves they made against the challenge itself. The client
// never gets to say "completed": it sends what it played, and whether that
// solves the challenge is decided here. Idempotent — solving a challenge
// again (review, double submit, a second tab) reports alreadyCompleted
// instead of failing or inserting a second row.
async function completeChallenge(userId, courseId, challengeId, moves) {
  const catalog = await loadCatalog()

  if (!catalog.findCourse(courseId)) {
    throw academyServiceError('COURSE_NOT_FOUND', 'Không tìm thấy khóa học.')
  }
  // Looked up inside the course from the URL, so a real challenge id paired
  // with the wrong course is "not found" too.
  const found = catalog.findChallengeInCourse(courseId, challengeId)
  if (!found) {
    throw academyServiceError('CHALLENGE_NOT_FOUND', 'Không tìm thấy thử thách.')
  }
  if (!catalog.verifySolution(found.challenge, moves)) {
    throw academyServiceError('INCORRECT_SOLUTION', 'Lời giải chưa đúng.')
  }

  try {
    await AcademyProgress.create({ userId, courseId, lessonId: found.lesson.id, challengeId })
    return { alreadyCompleted: false }
  } catch (error) {
    if (isUniqueViolation(error)) return { alreadyCompleted: true }
    throw error
  }
}

module.exports = { listCompletedChallengeIds, completeChallenge }
