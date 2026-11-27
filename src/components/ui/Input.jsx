import { createContext, useContext, useId } from 'react'
import { cn } from '../utils/cn'
import Icon from './Icon'

// Field hands its ids to the Input inside it, so the label, the hint and
// the error line are wired to the box without passing ids around by hand.
const FieldContext = createContext(null)

// A labelled form row: label, the control, then an optional hint and error.
//   <Field label="Email"><Input type="email" … /></Field>
// The label is tied to the input (clicking it focuses the box, screen
// readers and tests find the box by its label), and the hint / error are
// read out with it (aria-describedby). An error also marks the box invalid.
// `aside` sits at the right end of the label row (e.g. a "12/200" counter).
export function Field({ label, aside, hint, error, className, children }) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : null
  const errorId = error ? `${id}-error` : null
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
      <div className={cn('space-y-1', className)}>
        {aside ? (
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={id} className="block font-label-sm text-label-sm text-on-surface-variant">
              {label}
            </label>
            <span className="font-label-sm text-label-sm text-on-surface-variant/70">{aside}</span>
          </div>
        ) : (
          // Inline on purpose: it then sits in a full-height line box, which
          // gives the label-to-box gap every form had before Field existed.
          <label htmlFor={id} className="font-label-sm text-label-sm text-on-surface-variant">
            {label}
          </label>
        )}
        {children}
        {hint && (
          <p id={hintId} className="font-label-sm text-label-sm text-on-surface-variant/70">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="font-label-sm text-label-sm text-error">
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  )
}

const VARIANTS = {
  // Form box: Đăng nhập, Đăng ký, Sửa hồ sơ…
  default:
    'px-4 py-2 rounded-lg border border-outline-variant bg-surface-container focus:outline-none focus:border-primary disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:cursor-not-allowed',
  // Search box above a list (Bạn bè, Học viện); usually with an icon.
  search:
    'py-2.5 rounded-lg border border-outline-variant/30 bg-surface-container/40 font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary',
}

// A text box. `icon` puts a Material icon inside on the left (the search
// boxes). Any other prop (type, value, onChange, autoComplete, name…) goes
// straight to the <input>.
export function Input({ variant = 'default', icon, className, wrapperClassName, ...props }) {
  const field = useContext(FieldContext)
  const input = (
    <input
      id={field?.id}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      className={cn(
        'w-full',
        VARIANTS[variant],
        variant === 'search' && (icon ? 'pl-10 pr-4' : 'px-4'),
        variant === 'default' && icon && 'pl-10',
        className
      )}
      {...props}
    />
  )
  if (!icon) return input
  return (
    <div className={cn('relative', wrapperClassName)}>
      <Icon
        name={icon}
        size="md"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 pointer-events-none"
      />
      {input}
    </div>
  )
}

// Multi-line version of the default Input (Tiểu sử on Sửa hồ sơ).
export function Textarea({ className, ...props }) {
  const field = useContext(FieldContext)
  return (
    <textarea
      id={field?.id}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      className={cn('w-full resize-none', VARIANTS.default, className)}
      {...props}
    />
  )
}

export default Input
