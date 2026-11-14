import RequireAuth from '../components/auth/RequireAuth'
import Replay from '../pages/Replay/Replay'
import Profile from '../pages/Profile/Profile'
import EditProfile from '../pages/Profile/EditProfile'
import PublicProfile from '../pages/Profile/PublicProfile'
import Friends from '../pages/Friends/Friends'

// Pages that need an account — each one sits behind RequireAuth
// (src/components/auth/RequireAuth.jsx), which shows a sign-in prompt in
// place of the page to anyone not signed in.
export const privateRoutes = [
  {
    element: <RequireAuth />,
    children: [
      { path: '/replay/:gameId', element: <Replay /> },
      { path: '/profile', element: <Profile /> },
      { path: '/profile/edit', element: <EditProfile /> },
      { path: '/profile/:userId', element: <PublicProfile /> },
      { path: '/friends', element: <Friends /> },
    ],
  },
]

export default privateRoutes
