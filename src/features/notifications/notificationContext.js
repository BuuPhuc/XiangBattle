import { createContext, useContext } from 'react'

// Kept apart from NotificationProvider.jsx so that file only exports a
// component (react-refresh's only-export-components rule).
export const NotificationContext = createContext(null)

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) throw new Error('useNotifications must be used inside <NotificationProvider>')
  return context
}

export default useNotifications
