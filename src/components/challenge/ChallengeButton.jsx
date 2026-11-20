import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSelector } from 'react-redux'
import Icon from '../ui/Icon'
import Button from '../ui/Button'
import { TIME_CONTROLS, getTimeControl, formatTimeControlShort, describeTimeControl } from '../../features/game/timeControls.js'
import { selectTimeControlId } from '../../store/slices/settingsSlice'

// "Ván 15 + 5" for a challenge's time control id, or null when unknown.
function clockLabel(timeControlId) {
  return timeControlId ? `Ván ${formatTimeControlShort(getTimeControl(timeControlId))}` : null
}

const MENU_WIDTH = 288
const MENU_HEIGHT_GUESS = 280
const VIEWPORT_GUTTER = 16

// Where the menu goes for a button at `rect`: right-aligned under it, kept
// inside the window, and above the button when there is no room below.
function menuPosition(rect) {
  const left = Math.min(
    Math.max(VIEWPORT_GUTTER, rect.right - MENU_WIDTH),
    window.innerWidth - MENU_WIDTH - VIEWPORT_GUTTER
  )
  const fitsBelow = rect.bottom + 8 + MENU_HEIGHT_GUESS <= window.innerHeight
  return fitsBelow ? { left, top: rect.bottom + 8 } : { left, bottom: window.innerHeight - rect.top + 8 }
}

// "Thách đấu" → a small menu of the time controls; picking one sends the
// challenge at that clock. The one picked last for Quick Play / "Tạo phòng"
// is marked as the usual choice. Friend challenges are friendly (no Elo),
// which the menu says up front.
//
// The menu is drawn in a portal on <body> at a fixed position next to the
// button: the button sits inside cards that clip their content
// (overflow-hidden, Friends list) or start their own stacking context
// (backdrop-blur, Public Profile), and a menu drawn inside them was cut off
// or covered by the cards after it. It closes on scroll / resize rather
// than drifting away from the button.
function ChallengeMenu({ busy, onChallenge }) {
  const [position, setPosition] = useState(null) // null = closed
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const usualId = useSelector(selectTimeControlId)
  const open = position !== null

  useEffect(() => {
    if (!open) return undefined
    const close = () => setPosition(null)
    const onPointerDown = (event) => {
      const inside = [buttonRef.current, menuRef.current].some((el) => el && el.contains(event.target))
      if (!inside) close()
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const toggle = () => {
    if (open) {
      setPosition(null)
      return
    }
    const el = buttonRef.current
    if (el) setPosition(menuPosition(el.getBoundingClientRect()))
  }

  return (
    <span ref={buttonRef} className="inline-flex">
      <Button size="sm" disabled={busy} onClick={toggle} aria-expanded={open} className="disabled:opacity-50">
        <Icon name="swords" className="text-[16px]" />
        {busy ? 'Đang gửi...' : 'Thách đấu'}
      </Button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Chọn thời gian ván"
            style={{ position: 'fixed', width: MENU_WIDTH, ...position }}
            className="z-[60] max-w-[calc(100vw-32px)] rounded-xl border border-outline-variant/40 bg-surface shadow-xl p-2 text-left"
          >
            <p className="px-2 pt-1 font-label-md text-label-md text-on-surface">Chọn thời gian ván</p>
            <p className="px-2 pb-2 font-label-sm text-label-sm text-on-surface-variant">
              Thách đấu là ván giao hữu — không tính điểm.
            </p>
            {TIME_CONTROLS.map((control) => (
              <button
                key={control.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setPosition(null)
                  onChallenge(control.id)
                }}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-container transition-colors"
              >
                <span className="w-14 flex-shrink-0 font-label-md text-label-md text-primary tabular-nums">
                  {formatTimeControlShort(control)}
                </span>
                <span className="flex-1 min-w-0 font-label-sm text-label-sm text-on-surface-variant">
                  {describeTimeControl(control)}
                </span>
                {control.id === usualId && <Icon name="check" className="text-[16px] text-primary flex-shrink-0" />}
              </button>
            ))}
          </div>,
          document.body
        )}
    </span>
  )
}

// The Thách đấu control for one other player, in whichever of its states
// applies (see useChallenges' stateFor). Purely presentational — it draws
// what it is told and reports clicks; `busy` disables every button while a
// request for this player is in flight, so a double click sends nothing
// twice. `timeControlId` is the open challenge's clock (sent or received).
export function ChallengeButton({ state, busy, timeControlId, onChallenge, onCancel, onAccept, onReject }) {
  const clock = clockLabel(timeControlId)

  if (state === 'accepted') {
    return (
      <Button variant="outline" size="sm" disabled className="cursor-default opacity-80">
        <Icon name="check" className="text-[16px]" />
        Đã chấp nhận
      </Button>
    )
  }

  if (state === 'received') {
    return (
      <>
        {clock && (
          <span className="font-label-sm text-label-sm text-on-surface-variant tabular-nums" data-testid="challenge-clock">
            {clock} · Giao hữu
          </span>
        )}
        <Button size="sm" disabled={busy} onClick={onAccept} className="disabled:opacity-50" title="Chấp nhận lời mời thách đấu">
          <Icon name="swords" className="text-[16px]" />
          {busy ? 'Đang vào trận...' : 'Nhận thách đấu'}
        </Button>
        <Button variant="outline-sm" size="sm" disabled={busy} onClick={onReject} className="disabled:opacity-50">
          Từ chối
        </Button>
      </>
    )
  }

  if (state === 'sent') {
    return (
      <>
        <Button variant="outline" size="sm" disabled className="cursor-default opacity-80">
          <Icon name="schedule" className="text-[16px]" />
          Đang chờ...{clock && <span className="tabular-nums"> ({clock})</span>}
        </Button>
        <Button
          variant="outline-sm"
          size="sm"
          disabled={busy}
          onClick={onCancel}
          className="disabled:opacity-50"
          title="Hủy lời mời thách đấu"
        >
          {busy ? '...' : 'Hủy'}
        </Button>
      </>
    )
  }

  if (state === 'blocked') {
    return (
      <Button variant="outline-sm" size="sm" disabled className="cursor-not-allowed opacity-50">
        <Icon name="block" className="text-[16px]" />
        Không thể thách đấu
      </Button>
    )
  }

  return <ChallengeMenu busy={busy} onChallenge={onChallenge} />
}

export default ChallengeButton
