import { Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import SignInPrompt from './SignInPrompt'

// Wraps the pages that need an account (src/routes/privateRoutes.jsx).
// Waits for a saved session to be confirmed before deciding (reloading a
// private page while signed in used to bounce because the session hadn't
// been restored yet on the first render). A guest — or a saved session that
// turned out expired — gets a sign-in prompt right there, inside the app
// shell, instead of being sent to the home page with no explanation;
// signing in returns them to this page.
export function RequireAuth() {
  const { isAuthenticated, isRestoring } = useAuth()
  if (isAuthenticated) return <Outlet />
  if (isRestoring) {
    return (
      <div className="py-24 text-center" aria-label="Đang tải">
        <span className="w-3 h-3 rounded-full bg-secondary animate-pulse inline-block" />
      </div>
    )
  }
  return <SignInPrompt />
}

export default RequireAuth
