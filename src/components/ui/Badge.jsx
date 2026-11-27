import { cn } from '../utils/cn'
import Icon from './Icon'

const TONES = {
  // Plain label: a course level, "Chưa học", "Giao hữu".
  neutral: 'bg-surface-container text-on-surface-variant',
  // Something good or done: "Đã hoàn thành", "Tính điểm".
  success: 'bg-jade-light text-secondary',
  // In progress / needs attention: "Đang học".
  warning: 'bg-tertiary-fixed/60 text-on-tertiary-fixed-variant',
  // On a photo or tinted panel (home page feature cards).
  glass: 'bg-white/50 text-on-surface border border-outline-variant/20',
}

const SIZES = {
  sm: 'px-2 py-0.5',
  md: 'px-2.5 py-1',
}

// A small rounded label. Not clickable — a pill you can press is a Button
// (or a tab / toggle), not a Badge.
export function Badge({ tone = 'neutral', size = 'md', icon, iconFilled = false, className, children, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-label-sm text-label-sm whitespace-nowrap',
        TONES[tone],
        SIZES[size],
        className
      )}
      {...props}
    >
      {icon && <Icon name={icon} size="xs" filled={iconFilled} />}
      {children}
    </span>
  )
}

export default Badge
