import { cn } from '../utils/cn'

const VARIANTS = {
  primary:
    'bg-primary text-on-primary hover:bg-on-primary-fixed-variant wood-shadow',
  container:
    'bg-primary-container text-on-primary-container shadow-md',
  outline:
    'bg-transparent text-primary border-2 border-primary hover:bg-primary/5',
  'outline-sm':
    'bg-transparent text-primary border border-primary hover:bg-jade-light/50',
  gold:
    'bg-gold-shimmer text-wood-dark shadow-xl shadow-black/20 font-bold tracking-wide',
}

const SIZES = {
  sm: 'px-4 py-2 text-label-sm font-label-sm rounded-md',
  md: 'px-6 py-2 text-label-md font-label-md rounded-md',
  lg: 'px-8 py-4 text-label-md font-label-md rounded-lg',
  xl: 'px-10 py-5 text-lg font-label-md rounded-lg',
}

export function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) {
  return (
    <Component
      className={cn(
        'inline-flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-90 transition-transform duration-200',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {children}
    </Component>
  )
}

export default Button
