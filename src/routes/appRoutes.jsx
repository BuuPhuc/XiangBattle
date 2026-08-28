import Play from '../pages/Play/Play'
import ChessGame from '../pages/ChessGame/ChessGame'
import Room from '../pages/Room/Room'

export const appRoutes = [
  { path: '/play', element: <Play /> },
  { path: '/game', element: <ChessGame /> },
  { path: '/room', element: <Room /> },
]

export default appRoutes
