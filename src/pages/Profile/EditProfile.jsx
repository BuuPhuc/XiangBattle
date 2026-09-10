import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/ui/Icon'
import Button from '../../components/ui/Button'
import Avatar from '../../components/ui/Avatar'
import useAuth from '../../components/hooks/useAuth'
import userService from '../../services/userService'

const BIO_MAX_LENGTH = 300
const MAX_AVATAR_BYTES = 5 * 1024 * 1024
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export function EditProfile() {
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [username, setUsername] = useState(user.username)
  const [bio, setBio] = useState(user.bio || '')
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)

  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState(null)

  const handleAvatarClick = () => fileInputRef.current?.click()

  const handleAvatarChange = async (event) => {
    const file = event.target.files && event.target.files[0]
    event.target.value = '' // allow re-selecting the same file later
    if (!file) return

    setAvatarError(null)
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setAvatarError('Vui lòng chọn một tệp ảnh hợp lệ (JPEG, PNG, WEBP hoặc GIF).')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError('Ảnh vượt quá dung lượng cho phép (tối đa 5MB).')
      return
    }

    setAvatarUploading(true)
    try {
      const data = await userService.uploadAvatar(file)
      // Updates everywhere current-user data is read from (Header, Sidebar,
      // this form's own preview) — see useAuth.updateUser.
      updateUser(data.user)
    } catch (err) {
      setAvatarError((err.response && err.response.data && err.response.data.message) || 'Không thể tải ảnh lên. Vui lòng thử lại sau.')
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError(null)

    const trimmedUsername = username.trim()
    if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
      setFormError('Tên đăng nhập phải từ 3-20 ký tự.')
      return
    }
    if (bio.length > BIO_MAX_LENGTH) {
      setFormError(`Tiểu sử tối đa ${BIO_MAX_LENGTH} ký tự.`)
      return
    }

    setSaving(true)
    try {
      const data = await userService.updateProfile({ username: trimmedUsername, bio })
      updateUser(data.user)
      navigate('/profile')
    } catch (err) {
      setFormError((err.response && err.response.data && err.response.data.message) || 'Không thể lưu thông tin hồ sơ.')
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto py-12 px-4">
      <h1 className="font-headline-lg text-headline-lg text-on-surface mb-6 text-center">Chỉnh sửa hồ sơ</h1>

      <form onSubmit={handleSubmit} className="glass-panel border border-gold-shimmer/30 p-8 rounded-xl space-y-6">
        {formError && (
          <div className="px-4 py-3 rounded-lg bg-error/10 border border-error/30 text-error font-label-md text-label-md text-center">
            {formError}
          </div>
        )}

        <div className="flex flex-col items-center gap-3">
          <Avatar src={user.avatarUrl} name={user.displayName || user.username} size={96} />
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAvatarChange} className="hidden" />
          <Button type="button" variant="outline" size="sm" onClick={handleAvatarClick} disabled={avatarUploading}>
            <Icon name="photo_camera" />
            {avatarUploading ? 'Đang tải ảnh lên...' : 'Thay đổi ảnh'}
          </Button>
          {avatarError && <p className="font-label-sm text-label-sm text-error text-center">{avatarError}</p>}
        </div>

        <div className="space-y-1">
          <label className="font-label-sm text-label-sm text-on-surface-variant">Email</label>
          <input
            type="email"
            value={user.email || ''}
            readOnly
            disabled
            className="w-full px-4 py-2 rounded-lg border border-outline-variant bg-surface-container-high text-on-surface-variant cursor-not-allowed"
          />
          <p className="font-label-sm text-label-sm text-on-surface-variant/70">Email không thể thay đổi.</p>
        </div>

        <div className="space-y-1">
          <label className="font-label-sm text-label-sm text-on-surface-variant">Tên đăng nhập</label>
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            minLength={3}
            maxLength={20}
            placeholder="player01"
            className="w-full px-4 py-2 rounded-lg border border-outline-variant bg-surface-container focus:outline-none focus:border-primary"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="font-label-sm text-label-sm text-on-surface-variant">Tiểu sử</label>
            <span className="font-label-sm text-label-sm text-on-surface-variant/70">
              {bio.length}/{BIO_MAX_LENGTH}
            </span>
          </div>
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value.slice(0, BIO_MAX_LENGTH))}
            rows={4}
            maxLength={BIO_MAX_LENGTH}
            placeholder="Yêu thích cờ tướng..."
            className="w-full px-4 py-2 rounded-lg border border-outline-variant bg-surface-container focus:outline-none focus:border-primary resize-none"
          />
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={() => navigate('/profile')}>
            Hủy
          </Button>
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu thông tin'}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default EditProfile
