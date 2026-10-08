// Every Academy URL is built here, so the route table (routes/appRoutes.jsx)
// and the links between pages cannot drift apart. Challenges are addressed
// by their 1-based position in the lesson — what the page itself shows
// ("Thử thách 3 / 6").
export const academyPaths = {
  home: () => '/academy',
  course: (courseId) => `/academy/course/${courseId}`,
  lesson: (courseId, lessonId) => `/academy/course/${courseId}/${lessonId}`,
  challenge: (courseId, lessonId, number) => `/academy/course/${courseId}/${lessonId}/challenge/${number}`,
}

// Where a lesson's main button leads: the first unfinished challenge, or the
// first one again once the lesson is complete (review).
export function lessonResumePath(courseId, lesson, lessonProgress) {
  const index = lessonProgress.firstIncompleteIndex < lessonProgress.total ? lessonProgress.firstIncompleteIndex : 0
  return academyPaths.challenge(courseId, lesson.id, index + 1)
}

export default academyPaths
