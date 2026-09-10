import { useState } from 'react'
import { cn } from '../utils/cn'
import Icon from './Icon'

// A user's avatar image, or a graceful fallback when there's no
// avatarUrl (or it fails to load): the initial letter of their name on a
// tinted circle, matching the placeholder circles Header/Sidebar already
// used before any real avatar existed in this codebase. `key={src}` at
// call sites isn't required — this resets its own broken-image flag
// whenever `src` itself changes, so switching users/avatars never gets
// stuck showing a stale broken-image fallback.
export function Avatar({ src, name, size = 40, className = '' }) {
  const [failedSrc, setFailedSrc] = useState(null)
  const showImage = Boolean(src) && failedSrc !== src
  const initial = name ? name.trim().charAt(0).toUpperCase() : null
  const dimensionStyle = { width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.4)) }

  if (showImage) {
    return (
      <img
        src={src}
        alt={name ? `Ảnh đại diện của ${name}` : 'Ảnh đại diện'}
        style={dimensionStyle}
        onError={() => setFailedSrc(src)}
        className={cn('rounded-full object-cover flex-shrink-0 bg-surface-container', className)}
      />
    )
  }

  return (
    <div
      style={dimensionStyle}
      className={cn(
        'rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold flex-shrink-0',
        className
      )}
    >
      {initial || <Icon name="person" />}
    </div>
  )
}

export default Avatar
