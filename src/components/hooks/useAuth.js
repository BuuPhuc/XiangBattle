import { useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { setCredentials, updateUser as updateUserAction, logout as logoutAction, setStatus, setError } from '../../store/slices/authSlice'
import authService from '../../services/authService'
import { saveAuthSession, clearAuthSession, loadAuthSession } from '../../features/auth/authStorage'
import socket, { setSocketAuthToken } from '../../socket/socket'

// Forces the shared socket to reconnect under its current auth — used right
// after login/logout so the server's socket.user reflects the new identity
// immediately, instead of waiting for the next natural reconnect.
function reconnectSocket() {
  if (socket.connected) socket.disconnect()
  socket.connect()
}

function extractErrorResponse(error, fallbackMessage) {
  const data = error.response && error.response.data
  return {
    success: false,
    code: data && data.code,
    message: (data && data.message) || fallbackMessage,
  }
}

export function useAuth() {
  const dispatch = useDispatch()
  const { user, token, isAuthenticated, status, error } = useSelector((state) => state.auth)

  const login = useCallback(
    async (credentials) => {
      dispatch(setStatus('loading'))
      dispatch(setError(null))
      try {
        const res = await authService.login(credentials)
        saveAuthSession(res.token, res.user)
        setSocketAuthToken(res.token)
        reconnectSocket()
        dispatch(setCredentials({ user: res.user, token: res.token }))
        return { success: true, user: res.user }
      } catch (err) {
        const result = extractErrorResponse(err, 'Đăng nhập thất bại.')
        dispatch(setStatus('failed'))
        dispatch(setError(result.message))
        return result
      }
    },
    [dispatch],
  )

  const register = useCallback(
    async (payload) => {
      dispatch(setStatus('loading'))
      dispatch(setError(null))
      try {
        const res = await authService.register(payload)
        dispatch(setStatus('idle'))
        return { success: true, ...res }
      } catch (err) {
        const result = extractErrorResponse(err, 'Đăng ký thất bại.')
        dispatch(setStatus('failed'))
        dispatch(setError(result.message))
        return result
      }
    },
    [dispatch],
  )

  // Patches the current user (e.g. after Edit Profile saves a new
  // username/bio/avatarUrl) everywhere it's read from: Redux (so
  // Header/Sidebar/Profile re-render immediately, no logout/login needed)
  // and the localStorage snapshot authStorage.js keeps (read synchronously
  // elsewhere, e.g. roomSession's getPlayerId) — same token, since only the
  // user object actually changed.
  const updateUser = useCallback(
    (patch) => {
      const merged = { ...user, ...patch }
      saveAuthSession(token, merged)
      dispatch(updateUserAction(patch))
    },
    [dispatch, user, token],
  )

  const logout = useCallback(() => {
    clearAuthSession()
    setSocketAuthToken(null)
    reconnectSocket()
    dispatch(logoutAction())
  }, [dispatch])

  // Called once on app start: if a session was saved, re-arm the socket's
  // auth immediately (no need to wait on the network round trip below),
  // then confirm the token is still valid against the server before
  // trusting it — an expired/invalid token clears the saved session instead
  // of leaving the UI in a stuck "logged in" state.
  const restoreSession = useCallback(async () => {
    const saved = loadAuthSession()
    if (!saved) {
      dispatch(setStatus('idle'))
      return
    }
    setSocketAuthToken(saved.token)
    dispatch(setStatus('loading'))
    try {
      const res = await authService.getMe()
      dispatch(setCredentials({ user: res.user, token: saved.token }))
    } catch {
      clearAuthSession()
      setSocketAuthToken(null)
      dispatch(logoutAction())
    }
  }, [dispatch])

  return { user, token, isAuthenticated, status, error, login, register, updateUser, logout, restoreSession }
}

export default useAuth
