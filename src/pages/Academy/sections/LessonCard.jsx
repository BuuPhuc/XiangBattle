import { Link } from 'react-router-dom'
import Button from '../../../components/ui/Button'
import { getLessonProgress } from '../../../features/academy/catalog.js'
import { LESSON_ACTION_LABEL, LESSON_STATUS } from '../../../features/academy/constants.js'
import { academyPaths, lessonResumePath } from '../../../features/academy/paths.js'
import { PieceBadge, ProgressBar, StatusBadge } from './AcademyParts'

// The piece and its text open the lesson's own page; the button goes
// straight to the next challenge.
export function LessonCard({ course, lesson, completedIds }) {
  const progress = getLessonProgress(lesson, completedIds)

  return (
    <div className="glass-panel border border-gold-shimmer/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-primary/40 transition-colors">
      <Link to={academyPaths.lesson(course.id, lesson.id)} className="group flex items-center gap-4 flex-1 min-w-0">
        <PieceBadge type={lesson.piece} size={56} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors">
              {lesson.title}
            </h2>
            <StatusBadge status={progress.status} />
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{lesson.description}</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 max-w-[220px]">
              <ProgressBar done={progress.done} total={progress.total} label={`Tiến độ ${lesson.title}`} />
            </div>
            <span className="font-label-sm text-label-sm text-on-surface-variant tabular-nums whitespace-nowrap">
              {progress.done} / {progress.total} thử thách
            </span>
          </div>
        </div>
      </Link>

      <Button
        as={Link}
        to={lessonResumePath(course.id, lesson, progress)}
        variant={progress.status === LESSON_STATUS.COMPLETED ? 'outline-sm' : 'primary'}
        size="sm"
        className="whitespace-nowrap self-stretch sm:self-auto"
      >
        {LESSON_ACTION_LABEL[progress.status]}
      </Button>
    </div>
  )
}

export default LessonCard
