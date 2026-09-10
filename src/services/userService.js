import api from '../config/axios'

export const userService = {
  getMe: () => api.get('/users/me').then((res) => res.data),
  // Only username/bio ever belong in this payload — the backend whitelists
  // anyway, but keeping the caller's intent narrow here too.
  updateProfile: (payload) => api.patch('/users/me', payload).then((res) => res.data),
  // FormData — axios sets the multipart Content-Type (with boundary)
  // automatically as long as it's not overridden here.
  uploadAvatar: (file) => {
    const formData = new FormData()
    formData.append('avatar', file)
    return api.post('/users/me/avatar', formData).then((res) => res.data)
  },
}

export default userService
