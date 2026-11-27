import { cn } from '../utils/cn'

const TONES = {
  // The usual frosted panel with a thin gold edge.
  default: 'border-gold-shimmer/30',
  // Quieter edge for a card inside another panel or a list of many cards.
  subtle: 'border-outline-variant/30',
  // Draws the eye: "your rank" on the leaderboard.
  highlight: 'border-primary/40',
}

const PADDING = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

const RADIUS = {
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
}

// The frosted, gold-edged panel used for forms, lists and content blocks.
// Layout classes (flex, gap, space-y, text-center, overflow-hidden…) go in
// `className`; padding other than the three steps above too.
// - `as`: render as a form, section, Link… instead of a div.
// - `interactive`: the whole card is clickable — edge darkens and it lifts
//   its shadow on hover.
export function Card({
  as: Component = 'div',
  tone = 'default',
  padding = 'none',
  radius = 'xl',
  interactive = false,
  className,
  children,
  ...props
}) {
  return (
    <Component
      className={cn(
        'glass-panel border',
        TONES[tone],
        RADIUS[radius],
        PADDING[padding],
        interactive && 'hover:border-primary/40 hover:shadow-lg transition-all duration-200',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  )
}

export default Card
