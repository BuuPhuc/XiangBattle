import api from '../config/axios'

// Mirrors server/routes/academyRoutes.js. Only progress goes over the wire —
// the catalog is bundled (features/academy), and "complete" sends the moves
// that were played, never a completed flag (the server replays them).
export const academyService = {
  getProgress: () => api.get('/academy/progress').then((res) => res.data),
  completeChallenge: (courseId, challengeId, moves) =>
    api.post(`/academy/courses/${courseId}/challenges/${challengeId}/complete`, { moves }).then((res) => res.data),
}

export default academyService
