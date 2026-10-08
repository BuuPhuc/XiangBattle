import { Link } from 'react-router-dom'
import Icon from '../../../components/ui/Icon'
import Button from '../../../components/ui/Button'
import Avatar from '../../../components/ui/Avatar'
import ChallengeButton from '../../../components/challenge/ChallengeButton'

// One row in the "Bạn bè" tab. `online` is live, in-memory presence (see
// server/services/presenceService.js) merged in by the API response and
// kept fresh afterward by the 'friend_presence' socket event the Friends
// page listens for — never something this component tracks itself. Same for
// `challenge` (the Thách đấu button's state and handlers, from the page's
// useChallenges).
export function FriendRow({ friend, onRemove, removing, challenge }) {
  const name = friend.displayName || friend.username

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-outline-variant/20 last:border-b-0">
      <Link to={`/profile/${friend.id}`} className="relative flex-shrink-0">
        <Avatar src={friend.avatarUrl} name={name} size={44} />
        <span
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-surface dark:border-inverse-surface ${
            friend.online ? 'bg-secondary' : 'bg-on-surface-variant/40'
          }`}
          aria-hidden="true"
        />
      </Link>
      <div className="flex-1 min-w-[8rem]">
        <Link to={`/profile/${friend.id}`} className="font-body-md text-body-md text-on-surface truncate hover:text-primary transition-colors">
          {name}
        </Link>
        <p className="font-label-sm text-label-sm text-on-surface-variant/70 flex items-center gap-1.5 mt-0.5">
          <Icon name="star" className="text-[14px] text-gold-shimmer" filled />
          {friend.rating}
          <span className="mx-1">·</span>
          <span className={friend.online ? 'text-secondary' : ''}>{friend.online ? 'Đang online' : 'Offline'}</span>
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 ml-auto">
        {challenge && <ChallengeButton {...challenge} />}
        <Link to={`/profile/${friend.id}`}>
          <Button variant="outline-sm" size="sm">
            Xem
          </Button>
        </Link>
        <Button variant="outline-sm" size="sm" disabled={removing} onClick={() => onRemove(friend)}>
          {removing ? '...' : 'Xóa'}
        </Button>
      </div>
    </div>
  )
}

export default FriendRow
