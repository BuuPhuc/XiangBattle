import Play from '../pages/Play/Play'
import ChessGame from '../pages/ChessGame/ChessGame'

export const appRoutes = [
  { path: '/play', element: <Play /> },
  { path: '/game', element: <ChessGame /> },
]

export default appRoutes
