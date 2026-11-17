import { createSlice } from '@reduxjs/toolkit'
import { logout } from './authSlice'
import { loadGuestSettings } from '../../features/settings/guestSettingsStorage'
import { loadTimeControlId } from '../../features/settings/timeControlStorage'
import { isTimeControlId } from '../../features/game/timeControls.js'

// Same defaults the database gives a new account (server/prisma
// contract.prisma) — used while a signed-in user's settings are still
// loading, or if loading them failed.
const ACCOUNT_DEFAULTS = { soundEnabled: true, arrowsEnabled: true }

// The preferences the rest of the app reads (sound, arrow drawing), shared
// app-wide instead of only existing while the Settings page is open.
//   guest   — this browser's signed-out preferences (guestSettingsStorage)
//   account — the signed-in user's server settings; null until loaded and
//             again after logout
//   timeControlId — the online time control this browser last picked
//             (signed in or not; timeControlStorage.js)
// The two are kept apart on purpose: signing in never touches `guest`, and
// signing out just drops `account`, so neither overwrites the other.
const settingsSlice = createSlice({
  name: 'settings',
  initialState: () => ({
    guest: loadGuestSettings(),
    account: null,
    timeControlId: loadTimeControlId(),
  }),
  reducers: {
    setAccountSettings: (state, action) => {
      const { soundEnabled, arrowsEnabled } = action.payload ?? {}
      state.account = {
        soundEnabled: typeof soundEnabled === 'boolean' ? soundEnabled : ACCOUNT_DEFAULTS.soundEnabled,
        arrowsEnabled: typeof arrowsEnabled === 'boolean' ? arrowsEnabled : ACCOUNT_DEFAULTS.arrowsEnabled,
      }
    },
    setGuestSoundEnabled: (state, action) => {
      state.guest.soundEnabled = Boolean(action.payload)
    },
    setTimeControlId: (state, action) => {
      if (isTimeControlId(action.payload)) state.timeControlId = action.payload
    },
  },
  extraReducers: (builder) => {
    builder.addCase(logout, (state) => {
      state.account = null
    })
  },
})

// Primitive-valued selectors (never a fresh object), so useSelector only
// re-renders when the value actually changes.
export const selectSoundEnabled = (state) =>
  state.auth.isAuthenticated
    ? (state.settings.account ?? ACCOUNT_DEFAULTS).soundEnabled
    : state.settings.guest.soundEnabled

// Guests have no switch for this; they get the same default an account
// starts with (on).
export const selectArrowsEnabled = (state) =>
  state.auth.isAuthenticated ? (state.settings.account ?? ACCOUNT_DEFAULTS).arrowsEnabled : ACCOUNT_DEFAULTS.arrowsEnabled

export const selectTimeControlId = (state) => state.settings.timeControlId

export const { setAccountSettings, setGuestSoundEnabled, setTimeControlId } = settingsSlice.actions
export default settingsSlice.reducer
