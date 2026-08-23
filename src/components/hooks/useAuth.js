import { useSelector, useDispatch } from 'react-redux'
import { setCredentials, logout } from '../../store/slices/authSlice'

export function useAuth() {
  const dispatch = useDispatch()
  const { user, isAuthenticated, status } = useSelector((state) => state.auth)

  return {
    user,
    isAuthenticated,
    status,
    login: (user) => dispatch(setCredentials({ user })),
    logout: () => dispatch(logout()),
  }
}

export default useAuth
