import { Link, useParams } from 'react-router-dom'
import Icon from '../../components/ui/Icon'
import Button from '../../components/ui/Button'
import { findCourse, findLesson, getLessonProgress } from '../../features/academy/catalog.js'
import { LESSON_ACTION_LABEL } from '../../features/academy/constants.js'
import { academyPaths, lessonResumePath } from '../../features/academy/paths.js'
import useAcademyProgress from '../../features/academy/hooks/useAcademyProgress'
import {
  BackButton,
  LoadingState,
  NotFoundState,
  PieceBadge,
  ProgressBar,
  ProgressNotice,
  StatusBadge,
} from './sections/AcademyParts'

// One lesson (one piece): what it teaches, how far the learner has got, and
// its challenges. Challenges open in order — a later one unlocks once the
// one before it is done; finished ones stay open for review.
export function AcademyLesson() {
  const { courseId, lessonId } = useParams()
  const course = findCourse(courseId)
  const lesson = findLesson(course, lessonId)
  const progress = useAcademyProgress()

  if (!course) {
    return <NotFoundState message="Không tìm thấy khóa học" backTo={academyPaths.home()} backLabel="Về Học viện" />
  }
  if (!lesson) {
    return <NotFoundState message="Không tìm thấy bài học" backTo={academyPaths.course(course.id)} backLabel="Về khóa học" />
  }

  const lessonProgress = getLessonProgress(lesson, progress.completedIds)

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <BackButton to={academyPaths.course(course.id)} label="Về khóa học" />
        <span className="font-label-md text-label-md text-on-surface-variant truncate">{course.title}</span>
      </div>

      <ProgressNotice progress={progress} />

      {progress.status === 'loading' ? (
        <LoadingState />
      ) : (
        <>
          <div className="glass-panel border border-gold-shimmer/30 rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-4">
              <PieceBadge type={lesson.piece} size={72} />
              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-surface">
                    {lesson.title}
                  </h1>
                  <StatusBadge status={lessonProgress.status} />
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant">{lesson.description}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-label-md text-label-md font-bold text-on-surface-variant">Tiến độ</span>
                <span className="font-label-md text-label-md text-on-surface tabular-nums">
                  {lessonProgress.done} / {lessonProgress.total} thử thách
                </span>
              </div>
              <ProgressBar done={lessonProgress.done} total={lessonProgress.total} label={`Tiến độ ${lesson.title}`} />
            </div>

            <Button as={Link} to={lessonResumePath(course.id, lesson, lessonProgress)} size="lg" className="w-full sm:w-auto">
              <Icon name="play_arrow" filled />
              {LESSON_ACTION_LABEL[lessonProgress.status]}
            </Button>
          </div>

          <div className="glass-panel border border-gold-shimmer/30 rounded-xl overflow-hidden divide-y divide-outline-variant/20">
            {lesson.challenges.map((challenge, index) => {
              const done = progress.completedIds.has(challenge.id)
              const unlocked = index <= lessonProgress.firstIncompleteIndex
              const content = (
                <>
                  <span
                    className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center font-label-md text-label-md ${
                      done ? 'bg-jade-light text-secondary' : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {done ? <Icon name="check" className="text-[18px]" /> : index + 1}
                  </span>
                  <span className="flex-1 min-w-0 font-body-md text-body-md text-on-surface truncate">{challenge.title}</span>
                  <Icon
                    name={unlocked ? 'chevron_right' : 'lock'}
                    className={`text-[20px] ${unlocked ? 'text-on-surface-variant' : 'text-on-surface-variant/40'}`}
                  />
                </>
              )

              return unlocked ? (
                <Link
                  key={challenge.id}
                  to={academyPaths.challenge(course.id, lesson.id, index + 1)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-container/60 transition-colors"
                >
                  {content}
                </Link>
              ) : (
                <div key={challenge.id} className="flex items-center gap-3 px-4 py-3 opacity-60" aria-disabled="true">
                  {content}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default AcademyLesson
