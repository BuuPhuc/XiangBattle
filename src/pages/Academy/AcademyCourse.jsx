import { useParams } from 'react-router-dom'
import { findCourse, getCourseProgress } from '../../features/academy/catalog.js'
import { academyPaths } from '../../features/academy/paths.js'
import useAcademyProgress from '../../features/academy/hooks/useAcademyProgress'
import { LoadingState, NotFoundState, PageHeader, ProgressBar, ProgressNotice } from './sections/AcademyParts'
import LessonCard from './sections/LessonCard'

// One course: its lessons (for "Quân cờ và nước đi", one per piece), each
// with its own progress and a button straight into its challenges.
export function AcademyCourse() {
  const { courseId } = useParams()
  const course = findCourse(courseId)
  const progress = useAcademyProgress()

  if (!course) {
    return <NotFoundState message="Không tìm thấy khóa học" backTo={academyPaths.home()} backLabel="Về Học viện" />
  }

  const courseProgress = getCourseProgress(course, progress.completedIds)

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 space-y-6">
      <PageHeader backTo={academyPaths.home()} backLabel="Về Học viện" title={course.title} subtitle={course.description} />

      <ProgressNotice progress={progress} />

      {progress.status === 'loading' ? (
        <LoadingState />
      ) : (
        <>
          <div className="glass-panel border border-gold-shimmer/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="font-label-md text-label-md font-bold text-on-surface-variant">Tiến độ khóa học</span>
              <span className="font-label-md text-label-md text-on-surface tabular-nums">
                {courseProgress.done} / {courseProgress.total}
              </span>
            </div>
            <ProgressBar done={courseProgress.done} total={courseProgress.total} label="Tiến độ khóa học" />
          </div>

          <div className="space-y-3">
            {course.lessons.map((lesson) => (
              <LessonCard key={lesson.id} course={course} lesson={lesson} completedIds={progress.completedIds} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default AcademyCourse
