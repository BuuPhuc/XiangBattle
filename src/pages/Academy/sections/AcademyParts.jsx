import { Link } from 'react-router-dom'
import Icon from '../../../components/ui/Icon'
import Button from '../../../components/ui/Button'
import { LESSON_STATUS, PIECE_CHARS, PIECE_NAMES } from '../../../features/academy/constants.js'

// Small presentational pieces shared by every Academy page.

const STATUS_LABEL = {
  [LESSON_STATUS.NOT_STARTED]: 'Chưa bắt đầu',
  [LESSON_STATUS.IN_PROGRESS]: 'Đang học',
  [LESSON_STATUS.COMPLETED]: 'Hoàn thành',
}

const STATUS_CLASS = {
  [LESSON_STATUS.NOT_STARTED]: 'bg-surface-container text-on-surface-variant',
  [LESSON_STATUS.IN_PROGRESS]: 'bg-tertiary-fixed/60 text-on-tertiary-fixed-variant',
  [LESSON_STATUS.COMPLETED]: 'bg-jade-light text-secondary',
}

export function BackButton({ to, label }) {
  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg bg-surface-container text-primary hover:bg-surface-container-high transition-colors"
    >
      <Icon name="arrow_back" />
    </Link>
  )
}

export function PageHeader({ backTo, backLabel, icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3">
      <BackButton to={backTo} label={backLabel} />
      <div className="min-w-0">
        <h1 className="font-headline-md text-headline-md md:font-headline-lg md:text-headline-lg text-on-surface flex items-center gap-2">
          {icon && <Icon name={icon} className="text-primary" />}
          {title}
        </h1>
        {subtitle && <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}

export function PieceBadge({ type, size = 48 }) {
  return (
    <span
      className="academy-piece-badge"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      role="img"
      aria-label={`Quân ${PIECE_NAMES[type]}`}
    >
      {PIECE_CHARS.red[type]}
    </span>
  )
}

export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-label-sm text-label-sm ${STATUS_CLASS[status]}`}>
      {status === LESSON_STATUS.COMPLETED && <Icon name="check_circle" filled className="text-[14px]" />}
      {STATUS_LABEL[status]}
    </span>
  )
}

export function ProgressBar({ done, total, label }) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div
      className="h-2 rounded-full bg-surface-container-high overflow-hidden"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
    >
      <div className="h-full rounded-full bg-secondary transition-all duration-500" style={{ width: `${percent}%` }} />
    </div>
  )
}

export function LoadingState({ label = 'Đang tải tiến độ học tập...' }) {
  return (
    <div className="py-16 text-center space-y-3">
      <span className="w-3 h-3 rounded-full bg-secondary animate-pulse inline-block" />
      <p className="font-body-sm text-body-sm text-on-surface-variant">{label}</p>
    </div>
  )
}

// For a course / lesson / challenge id in the URL that isn't in the catalog.
export function NotFoundState({ message, backTo, backLabel }) {
  return (
    <div className="max-w-xl mx-auto py-24 px-4 text-center space-y-4">
      <Icon name="school" className="text-5xl text-on-surface-variant/40 block" />
      <h1 className="font-headline-sm text-headline-sm text-on-surface">{message}</h1>
      <Button as={Link} to={backTo} variant="outline">
        <Icon name="arrow_back" />
        {backLabel}
      </Button>
    </div>
  )
}

// What a page says about where its progress numbers come from: nothing for
// a signed-in user whose progress loaded, a sign-in nudge for a guest, a
// retry when the saved progress could not be fetched.
export function ProgressNotice({ progress }) {
  if (progress.status === 'error') {
    return (
      <div className="px-4 py-2.5 rounded-lg bg-error-container/40 border border-error/30 flex items-center justify-between gap-3 flex-wrap">
        <p className="font-body-sm text-body-sm text-error">{progress.error}</p>
        <button
          type="button"
          onClick={progress.reload}
          className="font-label-md text-label-md font-semibold text-primary hover:underline"
        >
          Thử lại
        </button>
      </div>
    )
  }

  if (progress.status === 'ready' && progress.isGuest) {
    return (
      <div className="px-4 py-2.5 rounded-lg bg-secondary/10 border border-secondary/30 flex items-center gap-2">
        <Icon name="info" className="text-[18px] text-secondary" />
        <p className="font-body-sm text-body-sm text-on-surface">
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Đăng nhập
          </Link>{' '}
          để lưu tiến độ học tập.
        </p>
      </div>
    )
  }

  return null
}
