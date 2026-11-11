import Play from '../pages/Play/Play'
import ChessGame from '../pages/ChessGame/ChessGame'
import Room from '../pages/Room/Room'
import AiGame from '../pages/AiGame/AiGame'
import Academy from '../pages/Academy/Academy'
import AcademyCourse from '../pages/Academy/AcademyCourse'
import AcademyLesson from '../pages/Academy/AcademyLesson'
import AcademyChallenge from '../pages/Academy/AcademyChallenge'

export const appRoutes = [
  { path: '/play', element: <Play /> },
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
]

export default appRoutes
