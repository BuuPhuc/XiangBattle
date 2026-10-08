import { Link } from 'react-router-dom'
import Icon from '../../../components/ui/Icon'
import Button from '../../../components/ui/Button'
import { academyPaths } from '../../../features/academy/paths.js'
import { ProgressBar } from './AcademyParts'

// Shown in place of the instruction panel once a lesson's last challenge is
// done.
export function LessonComplete({ course, lesson, lessonProgress, nextLesson, onReplay }) {
  return (
    <div className="academy-fade-in glass-panel border border-gold-shimmer/30 rounded-2xl p-6 space-y-5 text-center">
      <Icon name="emoji_events" filled className="text-6xl text-tertiary-fixed-dim block" />
      <div className="space-y-1">
        <h1 className="font-headline-md text-headline-md text-on-surface">Chúc mừng!</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">Bạn đã hoàn thành khóa học {lesson.title}.</p>
      </div>

      <div className="space-y-1.5">
        <ProgressBar done={lessonProgress.done} total={lessonProgress.total} label={`Tiến độ ${lesson.title}`} />
        <p className="font-label-md text-label-md text-on-surface tabular-nums">
          {lessonProgress.done} / {lessonProgress.total} thử thách
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {nextLesson && (
          <Button as={Link} to={academyPaths.lesson(course.id, nextLesson.id)} size="lg" className="w-full">
            Học {nextLesson.title}
            <Icon name="arrow_forward" />
          </Button>
        )}
        <Button
          as={Link}
          to={academyPaths.course(course.id)}
          variant={nextLesson ? 'outline-sm' : 'primary'}
          size="lg"
          className="w-full"
        >
          Về khóa học
        </Button>
        <button
          type="button"
          onClick={onReplay}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
        >
          <Icon name="replay" className="text-[18px]" />
          Chơi lại
        </button>
      </div>
    </div>
  )
}

export default LessonComplete
