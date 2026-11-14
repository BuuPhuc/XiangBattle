import { useCallback, useState } from 'react'
import Icon from '../../../components/ui/Icon'
import Button from '../../../components/ui/Button'
import LogoutConfirmModal from '../../../components/ui/LogoutConfirmModal'
import useAuth from '../../../components/hooks/useAuth'

// "Đăng xuất khỏi tất cả thiết bị" — signed-in users only (Settings renders
// it for them alone). Always asks first. On success useAuth's logoutAll has
// already left for the login page; on failure the dialog stays open with
// the error and the user is still signed in.
export function LogoutAllDevices() {
  const { logoutAll } = useAuth()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const close = useCallback(() => {
    setConfirming(false)
    setError(null)
  }, [])

  const confirm = async () => {
    setBusy(true)
    setError(null)
    const result = await logoutAll()
    if (!result.success) {
      setBusy(false)
      setError(result.message)
    }
  }

  return (
    <div className="glass-panel border border-gold-shimmer/30 rounded-xl overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3 flex-grow min-w-0">
          <Icon name="devices" className="text-error flex-shrink-0" />
          <div className="min-w-0">
            <p className="font-body-md text-body-md text-on-surface">Đăng xuất khỏi tất cả thiết bị</p>
            <p className="font-label-sm text-label-sm text-on-surface-variant/70 mt-0.5">
              Kết thúc mọi phiên đăng nhập của tài khoản, kể cả trên thiết bị này.
            </p>
          </div>
        </div>
        <div className="flex-shrink-0 pl-9 sm:pl-0">
          <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
            Đăng xuất tất cả
          </Button>
        </div>
      </div>

      {confirming && (
        <LogoutConfirmModal
          message="Đăng xuất khỏi tất cả thiết bị?"
          detail="Mọi thiết bị đang đăng nhập tài khoản này, kể cả thiết bị này, sẽ bị đăng xuất. Ván online đang chơi sẽ bị ngắt kết nối."
          confirmLabel={busy ? 'Đang đăng xuất...' : 'Đăng xuất tất cả'}
          busy={busy}
          error={error}
          onConfirm={confirm}
          onCancel={close}
        />
      )}
    </div>
  )
}

export default LogoutAllDevices
