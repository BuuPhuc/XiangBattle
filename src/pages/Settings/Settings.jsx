import { useEffect, useState } from 'react'
import Icon from '../../components/ui/Icon'
import Button from '../../components/ui/Button'
import userService from '../../services/userService'
import SettingRow from './sections/SettingRow'
import ToggleSwitch from './sections/ToggleSwitch'
import SettingSelect from './sections/SettingSelect'

const RECENT_GAMES_OPTIONS = [
  { value: 'PUBLIC', label: 'Công cộng' },
  { value: 'FRIENDS', label: 'Chỉ bạn bè' },
  { value: 'PRIVATE', label: 'Chỉ mình tôi' },
]

const CHALLENGE_OPTIONS = [
  { value: 'EVERYONE', label: 'Tất cả người dùng' },
  { value: 'FRIENDS', label: 'Chỉ bạn bè' },
  { value: 'NOBODY', label: 'Không ai' },
]

const SETTING_KEYS = ['soundEnabled', 'arrowsEnabled', 'recentGamesVisibility', 'challengePermission']

// "Cài đặt" — the current user's preferences. `savedSettings` is what the
// server last confirmed, `currentSettings` is what the form shows; the two
// only differ while there are unsaved edits (hasChanges), and Save sends
// just the fields that actually differ. Sound and arrow-drawing are
// stored-only placeholders — nothing in the app reads them yet. The two
// selects are enforced by the server (see gameAccessService.js and
// challengeService.js), never by this page.
export function Settings() {
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [loadError, setLoadError] = useState(null)
  const [savedSettings, setSavedSettings] = useState(null)
  const [currentSettings, setCurrentSettings] = useState(null)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null) // { type: 'success' | 'error', message } | null
  // Bumped by the "Thử lại" retry to re-run the fetch effect below.
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false

    userService
      .getSettings()
      .then((data) => {
        if (cancelled) return
        setSavedSettings(data.settings)
        setCurrentSettings(data.settings)
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError((err.response && err.response.data && err.response.data.message) || 'Không thể tải cài đặt.')
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const retry = () => {
    setStatus('loading')
    setLoadError(null)
    setReloadToken((t) => t + 1)
  }

  const changedKeys =
    savedSettings && currentSettings ? SETTING_KEYS.filter((key) => savedSettings[key] !== currentSettings[key]) : []
  const hasChanges = changedKeys.length > 0

  const setField = (key, value) => {
    setFeedback(null)
    setCurrentSettings((current) => ({ ...current, [key]: value }))
  }

  const handleSave = async () => {
    if (!hasChanges || saving) return
    setSaving(true)
    setFeedback(null)
    try {
      const payload = Object.fromEntries(changedKeys.map((key) => [key, currentSettings[key]]))
      const data = await userService.updateSettings(payload)
      setSavedSettings(data.settings)
      setCurrentSettings(data.settings)
      setFeedback({ type: 'success', message: 'Đã lưu thay đổi' })
    } catch {
      // currentSettings is left untouched — the user's picks stay on screen
      // so they can simply press Lưu again.
      setFeedback({ type: 'error', message: 'Không thể lưu thay đổi. Vui lòng thử lại.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface flex items-center gap-2">
          <Icon name="settings" className="text-primary" />
          Cài đặt
        </h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Tùy chỉnh trải nghiệm và quyền riêng tư của bạn.</p>
      </div>

      {status === 'loading' && (
        <div className="py-16 text-center space-y-3">
          <span className="w-3 h-3 rounded-full bg-secondary animate-pulse inline-block" />
          <p className="font-body-md text-body-md text-on-surface-variant">Đang tải cài đặt...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="py-16 text-center space-y-4">
          <p className="font-body-md text-body-md text-error">{loadError}</p>
          <Button variant="outline" onClick={retry}>
            Thử lại
          </Button>
        </div>
      )}

      {status === 'ready' && (
        <>
          <div className="glass-panel border border-gold-shimmer/30 rounded-xl overflow-hidden">
            <SettingRow icon="volume_up" label="Âm thanh" htmlFor="setting-sound">
              <ToggleSwitch
                id="setting-sound"
                checked={currentSettings.soundEnabled}
                onChange={(value) => setField('soundEnabled', value)}
                disabled={saving}
              />
            </SettingRow>
            <SettingRow icon="draw" label="Vẽ mũi tên và đánh dấu" htmlFor="setting-arrows">
              <ToggleSwitch
                id="setting-arrows"
                checked={currentSettings.arrowsEnabled}
                onChange={(value) => setField('arrowsEnabled', value)}
                disabled={saving}
              />
            </SettingRow>
            <SettingRow
              icon="history"
              label="Ván đấu gần đây"
              description="Ai có thể xem các ván đấu đã kết thúc của bạn."
              htmlFor="setting-recent-games"
            >
              <SettingSelect
                id="setting-recent-games"
                value={currentSettings.recentGamesVisibility}
                options={RECENT_GAMES_OPTIONS}
                onChange={(value) => setField('recentGamesVisibility', value)}
                disabled={saving}
              />
            </SettingRow>
            <SettingRow
              icon="swords"
              label="Ai có thể thách đấu tôi"
              description="Ai có thể gửi lời mời thách đấu, chơi lại cho bạn."
              htmlFor="setting-challenge"
            >
              <SettingSelect
                id="setting-challenge"
                value={currentSettings.challengePermission}
                options={CHALLENGE_OPTIONS}
                onChange={(value) => setField('challengePermission', value)}
                disabled={saving}
              />
            </SettingRow>
          </div>

          <div className="flex flex-col items-center gap-3">
            <Button onClick={handleSave} disabled={!hasChanges || saving} className="min-w-40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
              {saving ? 'Đang lưu...' : 'Lưu'}
            </Button>
            <p className="font-label-sm text-label-sm min-h-4 text-center" role="status" aria-live="polite">
              {feedback ? (
                <span className={feedback.type === 'success' ? 'text-secondary' : 'text-error'}>{feedback.message}</span>
              ) : hasChanges ? (
                <span className="text-on-surface-variant">Bạn có thay đổi chưa lưu</span>
              ) : null}
            </p>
          </div>
        </>
      )}
    </div>
  )
}

export default Settings
