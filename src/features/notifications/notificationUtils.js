// Material Symbols icon per notification type (see server's
// NotificationType enum). An unknown/future type falls back to a plain bell.
const TYPE_ICON = {
  FRIEND_REQUEST: 'person_add',
  FRIEND_ACCEPTED: 'how_to_reg',
  REMATCH_REQUEST: 'replay',
  CHALLENGE: 'swords',
  GAME_RESULT: 'emoji_events',
}

export function iconForType(type) {
  return TYPE_ICON[type] || 'notifications'
}

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// "2 phút trước" style timestamp. Anything older than a week reads as a
// plain date — a relative "37 ngày trước" stops being useful.
export function formatRelativeTime(isoString, now = Date.now()) {
  if (!isoString) return ''
  const elapsed = now - new Date(isoString).getTime()
  if (Number.isNaN(elapsed)) return ''
  if (elapsed < MINUTE) return 'Vừa xong'
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} phút trước`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} giờ trước`
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)} ngày trước`
  return new Date(isoString).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatBadgeCount(count) {
  return count > 99 ? '99+' : String(count)
}
