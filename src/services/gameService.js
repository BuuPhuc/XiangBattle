import api from '../config/axios'

export const gameService = {
  getGame: (gameId) => api.get(`/games/${gameId}`).then((res) => res.data.game),
}

export default gameService
