// The signed-out visitor's own preferences, kept in this browser only — a
// guest has no account to store them on. Deliberately a separate key from
// the account's settings (those live on the server and in Redux only), so
// signing in or out never overwrites one set with the other.
//
// Only read once, when the Redux store is created (settingsSlice's initial
// state) — never during a render — and written when the guest presses Lưu.
const GUEST_SETTINGS_KEY = 'xiangbattle_guest_settings'

export const GUEST_DEFAULTS = { soundEnabled: true }

export function loadGuestSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(GUEST_SETTINGS_KEY))
    return {
      soundEnabled: typeof saved?.soundEnabled === 'boolean' ? saved.soundEnabled : GUEST_DEFAULTS.soundEnabled,
    }
  } catch {
    // No storage (private mode, blocked site data) or a corrupt value.
    return { ...GUEST_DEFAULTS }
  }
}

export function saveGuestSettings(settings) {
  try {
    localStorage.setItem(GUEST_SETTINGS_KEY, JSON.stringify({ soundEnabled: Boolean(settings.soundEnabled) }))
    return true
  } catch {
    return false
  }
}
