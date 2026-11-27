import { useId, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Icon from '../ui/Icon'
import { cn } from '../utils/cn'
import {
  TIME_CONTROLS,
  getTimeControl,
  formatTimeControlShort,
  formatTimeControlLabel,
  describeTimeControl,
} from '../../features/game/timeControls.js'
import { selectTimeControlId, setTimeControlId } from '../../store/slices/settingsSlice'

// The time control for the next online game (Quick Play and "Tạo phòng"):
// a compact card showing the current choice ("10 + 0" and what it means)
// that opens into a grid of the presets. The choice lives in Redux
// (settings.timeControlId), so the Play page and the Room page share it and
// this browser remembers it (timeControlStorage.js).
export function TimeControlPicker({ className = '', defaultOpen = false }) {
  const dispatch = useDispatch()
  const selectedId = useSelector(selectTimeControlId)
  const selected = getTimeControl(selectedId)
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()

  return (
    <div
      className={cn(
        'w-full rounded-xl border bg-white/40 backdrop-blur-xl transition-colors',
        open ? 'border-primary/40' : 'border-outline-variant/40',
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Thời gian: ${formatTimeControlLabel(selected)}. Bấm để ${open ? 'đóng' : 'đổi'}`}
        className="w-full flex items-center gap-4 px-5 py-4 text-left"
      >
        <span className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <Icon name="timer" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-headline-sm text-headline-sm text-primary tabular-nums" data-testid="time-control-current">
            {formatTimeControlShort(selected)}
          </span>
          <span className="block font-body-sm text-body-sm text-on-surface-variant">{describeTimeControl(selected)}</span>
        </span>
        <Icon
          name="expand_more"
          className={cn('text-primary transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div id={panelId} role="radiogroup" aria-label="Chọn thời gian" className="grid grid-cols-2 gap-3 px-5 pb-5">
          {TIME_CONTROLS.map((control) => {
            const active = control.id === selected.id
            return (
              <button
                key={control.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => dispatch(setTimeControlId(control.id))}
                className={cn(
                  'rounded-lg border px-3 py-3 font-label-lg text-label-lg transition-colors',
                  active
                    ? 'bg-primary text-on-primary border-primary shadow-sm'
                    : 'bg-surface-container-lowest/70 text-on-surface border-outline-variant/60 hover:border-primary/50 hover:text-primary'
                )}
              >
                {formatTimeControlLabel(control)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default TimeControlPicker
