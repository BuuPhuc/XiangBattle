import { Link } from 'react-router-dom'
import Icon from '../../../components/ui/Icon'
import Button from '../../../components/ui/Button'
import Avatar from '../../../components/ui/Avatar'

// One row for either the "Lời mời nhận" or "Lời mời đã gửi" tab. `mode`
// picks which action pair renders — 'received' gets Accept/Reject, 'sent'
// gets a single Cancel — everything else about the row is identical.
export function RequestRow({ request, mode, onAccept, onReject, onCancel, busy }) {
  const name = request.displayName || request.username

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant/20 last:border-b-0">
      <Link to={`/profile/${request.id}`} className="flex-shrink-0">
        <Avatar src={request.avatarUrl} name={name} size={44} />
      </Link>
      <div className="flex-grow min-w-0">
        <Link
          to={`/profile/${request.id}`}
          className="font-body-md text-body-md text-on-surface truncate hover:text-primary transition-colors"
        >
          {name}
        </Link>
        <p className="font-label-sm text-label-sm text-on-surface-variant/70 flex items-center gap-1.5 mt-0.5">
          <Icon name="star" className="text-[14px] text-gold-shimmer" filled />
          Rating {request.rating}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {mode === 'received' ? (
          <>
            <Button size="sm" disabled={busy} onClick={() => onAccept(request)}>
              Chấp nhận
            </Button>
            <Button variant="outline-sm" size="sm" disabled={busy} onClick={() => onReject(request)}>
              Từ chối
            </Button>
          </>
        ) : (
          <Button variant="outline-sm" size="sm" disabled={busy} onClick={() => onCancel(request)}>
            Hủy lời mời
          </Button>
        )}
      </div>
    </div>
  )
}

export default RequestRow
