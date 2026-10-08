import { useEffect, useState } from 'react'
import Icon from '../../../components/ui/Icon'
import Button from '../../../components/ui/Button'
import friendService from '../../../services/friendService'

// The friend-relationship action area on Public Profile — one of five
// states ('NONE' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | 'FRIENDS', plus a
// transient 'loading'/'error'), each rendering the one action that's valid
// from the *viewer's* side. Entirely self-contained (own fetch, own
// loading/error state) so a slow or failed relationship lookup never blocks
// the rest of the profile from rendering — same independence
// GameHistorySection.jsx already has from the profile card above it.
export function FriendAction({ userId }) {
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [relation, setRelation] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const [loadedUserId, setLoadedUserId] = useState(userId)
  if (loadedUserId !== userId) {
    setLoadedUserId(userId)
    setStatus('loading')
    setRelation(null)
    setError(null)
  }

  useEffect(() => {
    let cancelled = false

    friendService
      .getStatus(userId)
      .then((data) => {
        if (cancelled) return
        setRelation(data.status)
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setError((err.response && err.response.data && err.response.data.message) || 'Không thể tải trạng thái kết bạn.')
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  const run = async (action, nextRelation, fallbackMessage) => {
    setError(null)
    setBusy(true)
    try {
      await action()
      setRelation(nextRelation)
    } catch (err) {
      setError((err.response && err.response.data && err.response.data.message) || fallbackMessage)
    } finally {
      setBusy(false)
    }
  }

  const handleAdd = () => run(() => friendService.sendRequest(userId), 'REQUEST_SENT', 'Không thể gửi lời mời kết bạn.')
  const handleCancel = () => run(() => friendService.cancelRequest(userId), 'NONE', 'Không thể hủy lời mời.')
  const handleAccept = () => run(() => friendService.acceptRequest(userId), 'FRIENDS', 'Không thể chấp nhận lời mời.')
  const handleReject = () => run(() => friendService.rejectRequest(userId), 'NONE', 'Không thể từ chối lời mời.')
  const handleRemove = () => {
    if (!window.confirm('Xóa người này khỏi danh sách bạn bè?')) return
    run(() => friendService.removeFriend(userId), 'NONE', 'Không thể xóa bạn.')
  }

  if (status === 'loading') {
    return <div className="h-10 w-36 mx-auto mt-4 rounded-md bg-surface-container-high animate-pulse" />
  }

  if (status === 'error') {
    return <p className="font-body-sm text-body-sm text-error mt-4">{error}</p>
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {relation === 'NONE' && (
          <Button size="sm" disabled={busy} onClick={handleAdd}>
            <Icon name="person_add" className="text-[18px]" />
            Thêm bạn
          </Button>
        )}

        {relation === 'REQUEST_SENT' && (
          <>
            <Button variant="outline" size="sm" disabled className="cursor-default">
              <Icon name="schedule" className="text-[18px]" />
              Đã gửi lời mời
            </Button>
            <Button variant="outline-sm" size="sm" disabled={busy} onClick={handleCancel}>
              Hủy lời mời
            </Button>
          </>
        )}

        {relation === 'REQUEST_RECEIVED' && (
          <>
            <Button size="sm" disabled={busy} onClick={handleAccept}>
              Chấp nhận
            </Button>
            <Button variant="outline-sm" size="sm" disabled={busy} onClick={handleReject}>
              Từ chối
            </Button>
          </>
        )}

        {relation === 'FRIENDS' && (
          <>
            <Button variant="outline" size="sm" disabled className="cursor-default">
              <Icon name="check" className="text-[18px]" />
              Bạn bè
            </Button>
            <Button variant="outline-sm" size="sm" disabled={busy} onClick={handleRemove}>
              Xóa bạn
            </Button>
          </>
        )}
      </div>
      {error && <p className="font-label-sm text-label-sm text-error">{error}</p>}
    </div>
  )
}

export default FriendAction
