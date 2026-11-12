import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import userService from '../../services/userService'
import { setAccountSettings } from '../../store/slices/settingsSlice'

// Loads the signed-in user's settings once per sign-in (and again if a
// different account signs in), so sound / arrow drawing follow them on every
// page — not only after the Settings page has been opened. Never runs for a
// guest: no settings API call is made while signed out. A failed load just
// leaves the account defaults in place.
export function useAccountSettingsSync() {
  const dispatch = useDispatch()
  const userId = useSelector((state) => (state.auth.isAuthenticated ? (state.auth.user?.id ?? null) : null))

  useEffect(() => {
    if (userId == null) return
    let cancelled = false
    userService
      .getSettings()
      .then((data) => {
        if (!cancelled) dispatch(setAccountSettings(data.settings))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userId, dispatch])
}

export default useAccountSettingsSync
