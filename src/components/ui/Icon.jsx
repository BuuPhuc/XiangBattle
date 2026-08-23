import { cn } from '../utils/cn'

export function Icon({ name, filled = false, className = '', ...props }) {
  return (
    <span
      className={cn('material-symbols-outlined', className)}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
      {...props}
    >
      {name}
    </span>
  )
}

export default Icon
