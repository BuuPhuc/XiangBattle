import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { findCourse, findLesson, getLessonProgress } from '../../features/academy/catalog.js'
import { academyPaths } from '../../features/academy/paths.js'
import useAcademyProgress from '../../features/academy/hooks/useAcademyProgress'
import { LoadingState, NotFoundState } from './sections/AcademyParts'
import ChallengePlayer from './sections/ChallengePlayer'

// The interactive challenge screen. This component only resolves the URL
// (course / lesson / challenge number) against the catalog and the learner's
// progress; the board itself is ChallengePlayer, mounted under a key so
// every challenge — and every "Làm lại" — starts from a clean state.
export function AcademyChallenge() {
  const { courseId, lessonId, number } = useParams()
  const course = findCourse(courseId)
  const lesson = findLesson(course, lessonId)
  const progress = useAcademyProgress()
  // Bumped by "Làm lại" to remount the same challenge.
  const [attempt, setAttempt] = useState(0)

  if (!course) {
    return <NotFoundState message="Không tìm thấy khóa học" backTo={academyPaths.home()} backLabel="Về Học viện" />
  }
  if (!lesson) {
    return <NotFoundState message="Không tìm thấy bài học" backTo={academyPaths.course(course.id)} backLabel="Về khóa học" />
  }

  const index = /^\d+$/.test(number) ? Number(number) - 1 : -1
  const challenge = lesson.challenges[index]
  if (!challenge) {
    return <Navigate to={academyPaths.lesson(course.id, lesson.id)} replace />
  }

  if (progress.status === 'loading') {
    return <LoadingState />
  }

  // Challenges are taken in order: a link (or a typed URL) to one further
  // ahead than the first unfinished challenge lands on that one instead.
  const lessonProgress = getLessonProgress(lesson, progress.completedIds)
  if (index > lessonProgress.firstIncompleteIndex) {
    return <Navigate to={academyPaths.challenge(course.id, lesson.id, lessonProgress.firstIncompleteIndex + 1)} replace />
  }

  return (
    <ChallengePlayer
      key={`${challenge.id}:${attempt}`}
      course={course}
      lesson={lesson}
      challenge={challenge}
      index={index}
      lessonProgress={lessonProgress}
      progress={progress}
      onRetry={() => setAttempt((current) => current + 1)}
    />
  )
}

export default AcademyChallenge
