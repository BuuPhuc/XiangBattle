import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      state.user = action.payload.user
      state.token = action.payload.token
      state.isAuthenticated = true
      state.status = 'succeeded'
      state.error = null
    },
    // Patches the current user object in place (e.g. after a profile edit)
    // without touching token/isAuthenticated — unlike setCredentials, which
    // requires a full { user, token } pair and is meant for actually
    // (re)establishing a session.
    updateUser: (state, action) => {
      if (state.user) state.user = { ...state.user, ...action.payload }
    },
    logout: (state) => {
      state.user = null
      state.token = null
      state.isAuthenticated = false
      state.status = 'idle'
      state.error = null
    },
    setStatus: (state, action) => {
      state.status = action.payload
    },
    setError: (state, action) => {
      state.error = action.payload
    },
  },
})

export const { setCredentials, updateUser, logout, setStatus, setError } = authSlice.actions
export default authSlice.reducer
