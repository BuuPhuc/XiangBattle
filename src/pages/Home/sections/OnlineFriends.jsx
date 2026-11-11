import { Link } from 'react-router-dom'
import Avatar from '../../../components/ui/Avatar'
import useAuth from '../../../components/hooks/useAuth'
import useOnlineFriends from '../../../features/friends/useOnlineFriends'

const MAX_VISIBLE = 5
const MAX_NAMES = 3

const ROW_CLASS = 'flex items-center gap-6 pt-8 border-t border-outline-variant/30'
const TEXT_CLASS = 'text-label-sm font-label-sm text-on-surface-variant'

function nameOf(friend) {
  return friend.displayName || friend.username
}

function summarize(friends) {
  const names = friends.slice(0, MAX_NAMES).map(nameOf).join(', ')
  const rest = friends.length - MAX_NAMES
  return rest > 0 ? `${names} và ${rest} người khác` : names
}

// The strip under the hero's buttons: the logged-in user's friends who are
// online right now (see useOnlineFriends). A guest gets nothing here at all
// — there is no personal list to show them, and nothing is made up to fill
// the space.
export function OnlineFriends() {
  const { user, isAuthenticated } = useAuth()
  const { status, friends, reload } = useOnlineFriends(isAuthenticated && user ? user.id : null)

  if (status === 'guest') return null

  if (status === 'loading') {
    return (
      <div className={ROW_CLASS}>
        <span className="w-3 h-3 rounded-full bg-secondary animate-pulse" aria-hidden="true" />
        <div className={TEXT_CLASS}>Đang tải bạn bè online...</div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className={ROW_CLASS}>
        <div className={TEXT_CLASS}>Không thể tải danh sách bạn bè online.</div>
        <button type="button" onClick={reload} className="text-label-sm font-label-sm font-semibold text-primary hover:underline">
          Thử lại
        </button>
      </div>
    )
  }

  if (friends.length === 0) {
    return (
      <div className={ROW_CLASS}>
        <div className={TEXT_CLASS}>
          Chưa có bạn bè nào online.
          <span className="block opacity-70">Hãy quay lại sau nhé.</span>
        </div>
      </div>
    )
  }

  const visible = friends.slice(0, MAX_VISIBLE)
  const hiddenCount = friends.length - visible.length

  return (
    <div className={ROW_CLASS}>
      <div className="flex -space-x-2">
        {visible.map((friend, index) => (
          // Earlier avatars sit on top of later ones, so each one's online
          // dot (bottom-right) stays clear of its neighbour.
          <Link
            key={friend.id}
            to={`/profile/${friend.id}`}
            title={nameOf(friend)}
            className="relative rounded-full"
            style={{ zIndex: visible.length - index }}
          >
            <Avatar src={friend.avatarUrl} name={nameOf(friend)} size={40} className="border-2 border-surface" />
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-surface bg-secondary" aria-hidden="true" />
          </Link>
        ))}
        {hiddenCount > 0 && (
          <Link
            to="/friends"
            title="Xem tất cả bạn bè"
            className="w-10 h-10 rounded-full border-2 border-surface bg-surface-container-high flex items-center justify-center text-label-sm font-label-sm font-medium text-on-surface-variant"
          >
            +{hiddenCount}
          </Link>
        )}
      </div>
      <div className={`${TEXT_CLASS} min-w-0`}>
        {friends.length} bạn bè đang online
        <span className="block opacity-70 truncate">{summarize(friends)}</span>
      </div>
    </div>
  )
}

export default OnlineFriends
