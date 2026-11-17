// The time control this browser last picked for an online game (the picker
// above "CHƠI NGAY" and on the Room page), so the next visit starts on it.
// A per-device convenience only — nothing on the server depends on it.
//
// Only read once, when the Redux store is created (settingsSlice's initial
// state) — never during a render — and written by the store subscriber in
// src/store/index.js whenever the choice changes.
import { DEFAULT_TIME_CONTROL_ID, isTimeControlId } from '../game/timeControls.js'

const TIME_CONTROL_KEY = 'xiangbattle_time_control'

export function loadTimeControlId() {
  try {
    const saved = localStorage.getItem(TIME_CONTROL_KEY)
    return isTimeControlId(saved) ? saved : DEFAULT_TIME_CONTROL_ID
  } catch {
    // No storage (private mode, blocked site data).
    return DEFAULT_TIME_CONTROL_ID
  }
}

export function saveTimeControlId(id) {
  try {
    localStorage.setItem(TIME_CONTROL_KEY, id)
  } catch {
    // Not remembered this time; the choice still applies to this visit.
  }
}
