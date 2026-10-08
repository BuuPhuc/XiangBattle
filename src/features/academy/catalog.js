// Lookups and progress math over the Academy catalog. Also the single entry
// point the server imports (together with verifySolution, re-exported at the
// bottom) — keep this file and everything it pulls in free of React and
// browser-only APIs, and keep the `.js` extensions on imports so Node can
// load it as-is.
import { COURSES } from './data/courses.js'
import { LESSON_STATUS } from './constants.js'

export { COURSES }
export { verifySolution } from './engine/challengeEngine.js'

export function findCourse(courseId) {
  return COURSES.find((course) => course.id === courseId) ?? null
}

export function findLesson(course, lessonId) {
  return course?.lessons.find((lesson) => lesson.id === lessonId) ?? null
}

// The challenge with `challengeId` inside `courseId`, with the lesson it
// belongs to — null if the course doesn't exist or doesn't contain it.
export function findChallengeInCourse(courseId, challengeId) {
  const course = findCourse(courseId)
  if (!course) return null
  for (const lesson of course.lessons) {
    const challenge = lesson.challenges.find((entry) => entry.id === challengeId)
    if (challenge) return { course, lesson, challenge }
  }
  return null
}

export function countCourseChallenges(course) {
  return course.lessons.reduce((total, lesson) => total + lesson.challenges.length, 0)
}

// `completedIds` is a Set of challenge ids. firstIncompleteIndex is where
// "Tiếp tục học" resumes, and equals total once the lesson is finished.
export function getLessonProgress(lesson, completedIds) {
  const total = lesson.challenges.length
  const done = lesson.challenges.filter((challenge) => completedIds.has(challenge.id)).length
  const firstIncompleteIndex = lesson.challenges.findIndex((challenge) => !completedIds.has(challenge.id))

  let status = LESSON_STATUS.IN_PROGRESS
  if (done === 0) status = LESSON_STATUS.NOT_STARTED
  else if (done === total) status = LESSON_STATUS.COMPLETED

  return { done, total, status, firstIncompleteIndex: firstIncompleteIndex === -1 ? total : firstIncompleteIndex }
}

// A course is measured in finished lessons ("2 / 7").
export function getCourseProgress(course, completedIds) {
  const total = course.lessons.length
  const lessonProgress = course.lessons.map((lesson) => getLessonProgress(lesson, completedIds))
  const done = lessonProgress.filter((progress) => progress.status === LESSON_STATUS.COMPLETED).length
  const started = lessonProgress.some((progress) => progress.done > 0)

  let status = LESSON_STATUS.IN_PROGRESS
  if (!started) status = LESSON_STATUS.NOT_STARTED
  else if (done === total) status = LESSON_STATUS.COMPLETED

  return { done, total, status }
}
