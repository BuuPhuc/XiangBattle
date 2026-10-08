import { Link } from 'react-router-dom'
import Icon from '../../../components/ui/Icon'
import Button from '../../../components/ui/Button'
import Avatar from '../../../components/ui/Avatar'

// One username-search result row. `user.relationshipStatus` comes straight
// from the server (userController.js's searchUsers reuses
// friendService.getRelationshipStatus — the exact same relationship logic
// Public Profile's FriendAction already uses), so the button shown here is
// never a second, parallel relationship system. The current user never
// appears in their own search results (server-side exclusion), so there is
// no 'SELF' case to render.
export function UserSearchResult({ user, onSendRequest, onCancel, onAccept, onReject, busy }) {
  const name = user.displayName || user.username

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant/20 last:border-b-0">
      <Link to={`/profile/${user.id}`} className="relative flex-shrink-0">
        <Avatar src={user.avatarUrl} name={name} size={44} />
        <span
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-surface dark:border-inverse-surface ${
            user.online ? 'bg-secondary' : 'bg-on-surface-variant/40'
          }`}
          aria-hidden="true"
        />
      </Link>
      <div className="flex-grow min-w-0">
        <Link to={`/profile/${user.id}`} className="font-body-md text-body-md text-on-surface truncate hover:text-primary transition-colors">
          {name}
        </Link>
        <p className="font-label-sm text-label-sm text-on-surface-variant/70 flex items-center gap-1.5 mt-0.5">
          <Icon name="star" className="text-[14px] text-gold-shimmer" filled />
          Rating {user.rating}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {user.relationshipStatus === 'NONE' && (
          <Button size="sm" disabled={busy} onClick={() => onSendRequest(user)}>
            <Icon name="person_add" className="text-[16px]" />
            Kết bạn
          </Button>
        )}

        {user.relationshipStatus === 'REQUEST_SENT' && (
          <>
            <Button variant="outline" size="sm" disabled className="cursor-default">
              Đã gửi lời mời
            </Button>
            <Button variant="outline-sm" size="sm" disabled={busy} onClick={() => onCancel(user)}>
              Hủy
            </Button>
          </>
        )}

        {user.relationshipStatus === 'REQUEST_RECEIVED' && (
          <>
            <Button size="sm" disabled={busy} onClick={() => onAccept(user)}>
              Chấp nhận
            </Button>
            <Button variant="outline-sm" size="sm" disabled={busy} onClick={() => onReject(user)}>
              Từ chối
            </Button>
          </>
        )}

        {user.relationshipStatus === 'FRIENDS' && (
          <Button variant="outline" size="sm" disabled className="cursor-default">
            <Icon name="check" className="text-[16px]" />
            Bạn bè
          </Button>
        )}
      </div>
    </div>
  )
}

export default UserSearchResult
