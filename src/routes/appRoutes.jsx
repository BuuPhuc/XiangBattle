import { Navigate } from 'react-router-dom'
import Play from '../pages/Play/Play'
import ChessGame from '../pages/ChessGame/ChessGame'
import Room from '../pages/Room/Room'
import AiGame from '../pages/AiGame/AiGame'
import Academy from '../pages/Academy/Academy'
import AcademyCourse from '../pages/Academy/AcademyCourse'
import AcademyLesson from '../pages/Academy/AcademyLesson'
import AcademyChallenge from '../pages/Academy/AcademyChallenge'
import Settings from '../pages/Settings/Settings'
import Leaderboard from '../pages/Leaderboard/Leaderboard'
import ClubComingSoon from '../pages/Social/ClubComingSoon'

export const appRoutes = [
  { path: '/play', element: <Play /> },
  // The old "Dashboard" placeholder page is gone — Play already shows the
  // player's recent matches. Old links / bookmarks land on Play instead.
  { path: '/dashboard', element: <Navigate to="/play" replace /> },
  { path: '/game', element: <ChessGame /> },
  { path: '/room', element: <Room /> },
  // Đối đầu AI — local only (no account needed, nothing saved or rated).
  { path: '/ai', element: <AiGame /> },
  // Học viện — open to guests like /play; only saving progress needs an
  // account. Paths are built by features/academy/paths.js.
  { path: '/academy', element: <Academy /> },
  { path: '/academy/course/:courseId', element: <AcademyCourse /> },
  { path: '/academy/course/:courseId/:lessonId', element: <AcademyLesson /> },
  { path: '/academy/course/:courseId/:lessonId/challenge/:number', element: <AcademyChallenge /> },
  // Cài đặt — guests get the sound switch (kept in their browser); signed-in
  // users get the full page. The page itself decides which (Settings.jsx).
  { path: '/settings', element: <Settings /> },
  // Bảng xếp hạng — public (the API is too, see server leaderboardRoutes.js);
  // a signed-in user also sees their own rank.
  { path: '/leaderboard', element: <Leaderboard /> },
  // Câu lạc bộ — only a "coming soon" page so far, nothing private on it.
  { path: '/clubs', element: <ClubComingSoon /> },
]

export default appRoutes
