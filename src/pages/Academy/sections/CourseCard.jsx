import { Link } from 'react-router-dom'
import Card from '../../../components/ui/Card'
import Badge from '../../../components/ui/Badge'
import { countCourseChallenges, getCourseProgress } from '../../../features/academy/catalog.js'
import { COURSE_LEVELS } from '../../../features/academy/constants.js'
import { academyPaths } from '../../../features/academy/paths.js'
import { PieceBadge, ProgressBar, StatusBadge } from './AcademyParts'

export function CourseCard({ course, completedIds }) {
  const progress = getCourseProgress(course, completedIds)
  const level = COURSE_LEVELS.find((item) => item.id === course.level)

  return (
    <Card
      as={Link}
      interactive
      to={academyPaths.course(course.id)}
      className="group overflow-hidden flex flex-col"
    >
      <div className="h-32 flex items-center justify-center gap-3 bg-board-felt border-b border-gold-shimmer/30">
        {course.thumbnail.map((type) => (
          <PieceBadge key={type} type={type} size={52} />
        ))}
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {level && (
            <Badge>{level.label}</Badge>
          )}
          <StatusBadge status={progress.status} />
        </div>

        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors">
            {course.title}
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{course.description}</p>
        </div>

        <p className="font-label-sm text-label-sm text-on-surface-variant">
          {course.lessons.length} bài học · {countCourseChallenges(course)} thử thách
        </p>

        <div className="mt-auto space-y-1.5">
          <ProgressBar done={progress.done} total={progress.total} label="Tiến độ khóa học" />
          <p className="font-label-sm text-label-sm text-on-surface-variant tabular-nums">
            {progress.done} / {progress.total} bài học
          </p>
        </div>
      </div>
    </Card>
  )
}

export default CourseCard
