import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import friendService from '../../services/friendService'
import userService from '../../services/userService'
import socket from '../../socket/socket'
import useDebouncedValue from '../../components/hooks/useDebouncedValue'
import useChallenges from '../../features/challenge/useChallenges'
import FriendRow from './sections/FriendRow'
import { useLiveGames, findLiveGameOf } from '../../features/spectate/useLiveGames'
import RequestRow from './sections/RequestRow'
import UserSearchResult from './sections/UserSearchResult'

const USER_SEARCH_DEBOUNCE_MS = 400

const TABS = [
  { key: 'friends', label: 'Bạn bè' },
  { key: 'received', label: 'Lời mời nhận' },
  { key: 'sent', label: 'Lời mời đã gửi' },
]

// "Bạn bè" — the current user's full social picture: friends (with live
// online/offline), requests received, and requests sent. All three load up
// front (each list is small for a project this size, and switching tabs
// should feel instant rather than re-fetching), each action updates local
// state directly instead of refetching/reloading, and online/offline stays
// live via the shared socket connection's 'friend_presence' event — never
// a second Socket.IO connection (see server/services/presenceService.js).
export function Friends() {
  // Which friends are in a match right now — a "Xem ván" button for them.
  const { games: liveGames } = useLiveGames()
  // A friend-request notification links here with `state.tab = 'received'`
  // (see NotificationPanel.jsx) so it lands on the requests, not the
  // default friends list.
  const location = useLocation()
  const requestedTab = location.state && location.state.tab
  const [activeTab, setActiveTab] = useState(TABS.some((tab) => tab.key === requestedTab) ? requestedTab : 'friends')
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [error, setError] = useState(null)
  const [friends, setFriends] = useState([])
  const [received, setReceived] = useState([])
  const [sent, setSent] = useState([])
  const [search, setSearch] = useState('')
  const [busyIds, setBusyIds] = useState(() => new Set())
  const [actionError, setActionError] = useState(null)
  // Bumped by the "Thử lại" retry to re-run the fetch effect below.
  const [reloadToken, setReloadToken] = useState(0)

  // Username search, shown inside the "Lời mời nhận" tab — separate from
  // `search`/`filteredFriends` above, which only filters the already-loaded
  // friends list client-side. This one calls the server (GET
  // /users/search), since it searches every user, not just friends.
  const [userQuery, setUserQuery] = useState('')
  const debouncedUserQuery = useDebouncedValue(userQuery, USER_SEARCH_DEBOUNCE_MS)
  // Exactly the string sent to the server — and the one every result below
  // is tagged with, so "is this result for the current search?" compares
  // like with like and can never leave the box stuck on "Đang tìm kiếm...".
  const searchQuery = debouncedUserQuery.trim()
  // status: 'idle' | 'loading' | 'ready' | 'error'
  const [userSearch, setUserSearch] = useState({ query: '', status: 'idle', error: null, results: [] })
  // A new search (the debounced, trimmed query changed): start it over right
  // here while rendering — React's "adjust state when a prop changes" —
  // instead of from inside the effect below, which would render once more
  // with the previous search's state first.
  if (userSearch.query !== searchQuery) {
    setUserSearch({ query: searchQuery, status: searchQuery ? 'loading' : 'idle', error: null, results: [] })
  }
  const { status: userSearchStatus, error: userSearchError, results: userSearchResults } = userSearch

  // Thách đấu state for every friend row — one fetch and one socket
  // listener for the whole list (see useChallenges), never one per row.
  const challenges = useChallenges()

  // The initial state is already 'loading'; a retry resets it in load()
  // below, so this effect itself only ever sets state once the lists answer.
  useEffect(() => {
    let cancelled = false

    Promise.all([friendService.getFriends(), friendService.getReceivedRequests(), friendService.getSentRequests()])
      .then(([friendsRes, receivedRes, sentRes]) => {
        if (cancelled) return
        setFriends(friendsRes.friends || [])
        setReceived(receivedRes.requests || [])
        setSent(sentRes.requests || [])
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setError((err.response && err.response.data && err.response.data.message) || 'Không thể tải danh sách bạn bè.')
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  // Live presence — the socket connection already exists app-wide (see
  // App.jsx), this only ever adds a listener to it. A friend_presence event
  // for someone not currently in `friends` (shouldn't happen, but harmless)
  // is a no-op map over an unmatched id.
  useEffect(() => {
    function handlePresence({ userId, online }) {
      setFriends((current) => current.map((friend) => (friend.id === userId ? { ...friend, online } : friend)))
    }
    socket.on('friend_presence', handlePresence)
    return () => socket.off('friend_presence', handlePresence)
  }, [])

  // Fires only once the user stops typing for USER_SEARCH_DEBOUNCE_MS (see
  // useDebouncedValue) — never once per keystroke. An empty/whitespace-only
  // query never reaches the server at all.
  //
  // A reply only ever lands on the search it was made for: the effect's
  // cleanup drops it once the query moves on, and it is also matched
  // against the query it carries, so a late reply for "ab" can never
  // replace the results for "abc".
  useEffect(() => {
    if (!searchQuery) return
    let cancelled = false
    const settle = (patch) => {
      if (cancelled) return
      setUserSearch((current) => (current.query === searchQuery ? { ...current, ...patch } : current))
    }

    userService
      .searchUsers(searchQuery)
      .then((data) => settle({ status: 'ready', results: data.users || [] }))
      .catch((err) =>
        settle({
          status: 'error',
          error: (err.response && err.response.data && err.response.data.message) || 'Không thể tìm kiếm người chơi.',
        })
      )

    return () => {
      cancelled = true
    }
  }, [searchQuery])

  // Keeps a search result row's button in sync whenever the same
  // relationship changes via the Received/Sent/Friends tabs (or vice
  // versa) — a no-op if that user isn't currently in the search results.
  const updateSearchRelationship = useCallback((userId, relationshipStatus) => {
    setUserSearch((current) => ({
      ...current,
      results: current.results.map((u) => (u.id === userId ? { ...u, relationshipStatus } : u)),
    }))
  }, [])

  const setBusy = useCallback((id, isBusy) => {
    setBusyIds((current) => {
      const next = new Set(current)
      if (isBusy) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const runAction = useCallback(
    async (userId, action, onSuccess, fallbackMessage) => {
      setActionError(null)
      setBusy(userId, true)
      try {
        await action()
        onSuccess()
      } catch (err) {
        setActionError((err.response && err.response.data && err.response.data.message) || fallbackMessage)
      } finally {
        setBusy(userId, false)
      }
    },
    [setBusy],
  )

  const handleAccept = (request) =>
    runAction(
      request.id,
      () => friendService.acceptRequest(request.id),
      () => {
        setReceived((current) => current.filter((r) => r.id !== request.id))
        setFriends((current) => [{ ...request, online: false, friendsSince: new Date().toISOString() }, ...current])
        updateSearchRelationship(request.id, 'FRIENDS')
      },
      'Không thể chấp nhận lời mời.',
    )

  const handleReject = (request) =>
    runAction(
      request.id,
      () => friendService.rejectRequest(request.id),
      () => {
        setReceived((current) => current.filter((r) => r.id !== request.id))
        updateSearchRelationship(request.id, 'NONE')
      },
      'Không thể từ chối lời mời.',
    )

  const handleCancel = (request) =>
    runAction(
      request.id,
      () => friendService.cancelRequest(request.id),
      () => {
        setSent((current) => current.filter((r) => r.id !== request.id))
        updateSearchRelationship(request.id, 'NONE')
      },
      'Không thể hủy lời mời.',
    )

  const handleRemove = (friend) => {
    const name = friend.displayName || friend.username
    if (!window.confirm(`Xóa ${name} khỏi danh sách bạn bè?`)) return
    runAction(
      friend.id,
      () => friendService.removeFriend(friend.id),
      () => {
        setFriends((current) => current.filter((f) => f.id !== friend.id))
        updateSearchRelationship(friend.id, 'NONE')
      },
      'Không thể xóa bạn.',
    )
  }

  // Sends a brand-new request from a search result — the one action that
  // only exists from the search box (the other tabs never start from
  // "no relationship yet"). Mirrors FriendAction.jsx's own handleAdd.
  const handleSendRequest = (user) =>
    runAction(
      user.id,
      () => friendService.sendRequest(user.id),
      () => {
        updateSearchRelationship(user.id, 'REQUEST_SENT')
        setSent((current) => [{ ...user, requestedAt: new Date().toISOString() }, ...current])
      },
      'Không thể gửi lời mời kết bạn.',
    )

  const filteredFriends = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return friends
    return friends.filter((f) => (f.displayName || f.username || '').toLowerCase().includes(q))
  }, [friends, search])

  // "Thử lại": back to the loading state, then re-run the fetch effect.
  const load = () => {
    setStatus('loading')
    setError(null)
    setReloadToken((t) => t + 1)
  }

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface flex items-center gap-2">
          <Icon name="group" className="text-primary" />
          Bạn bè
        </h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Quản lý bạn bè và lời mời kết bạn của bạn.</p>
      </div>

      <div className="flex items-center gap-2 border-b border-outline-variant/20 overflow-x-auto">
        {TABS.map((tab) => {
          const count = tab.key === 'friends' ? friends.length : tab.key === 'received' ? received.length : sent.length
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 font-label-md text-label-md whitespace-nowrap border-b-2 transition-colors ${
                active ? 'border-primary text-primary font-bold' : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {tab.label}
              {count > 0 && <span className="ml-1.5 text-label-sm opacity-70">({count})</span>}
            </button>
          )
        })}
      </div>

      {actionError && (
        <div className="px-4 py-2.5 rounded-lg bg-error-container/40 border border-error/30">
          <p className="font-body-sm text-body-sm text-error">{actionError}</p>
        </div>
      )}

      {challenges.feedback && (
        <div
          className={`px-4 py-2.5 rounded-lg border ${
            challenges.feedback.tone === 'error' ? 'bg-error-container/40 border-error/30' : 'bg-secondary/10 border-secondary/30'
          }`}
        >
          <p className={`font-body-sm text-body-sm ${challenges.feedback.tone === 'error' ? 'text-error' : 'text-secondary'}`}>
            {challenges.feedback.text}
          </p>
        </div>
      )}

      {status === 'loading' && (
        <div className="py-16 text-center">
          <span className="w-3 h-3 rounded-full bg-secondary animate-pulse inline-block" />
        </div>
      )}

      {status === 'error' && (
        <div className="py-16 text-center space-y-4">
          <p className="font-body-md text-body-md text-error">{error}</p>
          <Button
            variant="link"
            size="md"
            onClick={load}
          >
            Thử lại
          </Button>
        </div>
      )}

      {status === 'ready' && activeTab === 'friends' && (
        <div className="space-y-3">
          <div className="relative">
            <Icon name="search" size="md" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm bạn bè"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-outline-variant/30 bg-surface-container/40 font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary"
            />
          </div>

          <div className="glass-panel border border-gold-shimmer/30 rounded-xl overflow-hidden">
            {filteredFriends.length === 0 ? (
              <div className="py-10 text-center px-4 space-y-2">
                <Icon name="group_off" size="xl" className="text-on-surface-variant/40 block" />
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {friends.length === 0 ? 'Chưa có bạn bè nào' : 'Không tìm thấy bạn bè phù hợp'}
                </p>
              </div>
            ) : (
              filteredFriends.map((friend) => (
                <FriendRow
                  key={friend.id}
                  friend={friend}
                  onRemove={handleRemove}
                  removing={busyIds.has(friend.id)}
                  challenge={challenges.propsFor(friend.id)}
                  liveGame={findLiveGameOf(liveGames, friend.id)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {status === 'ready' && activeTab === 'received' && (
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="relative">
              <Icon name="search" size="md" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" />
              <input
                type="text"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Tìm kiếm theo tên người dùng..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-outline-variant/30 bg-surface-container/40 font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary"
              />
            </div>

            {userQuery.trim() && (
              <div className="glass-panel border border-gold-shimmer/30 rounded-xl overflow-hidden">
                {userSearchStatus === 'loading' && (
                  <p className="py-6 text-center font-body-sm text-body-sm text-on-surface-variant flex items-center justify-center gap-2">
                    <Icon name="search" size="sm" />
                    Đang tìm kiếm...
                  </p>
                )}
                {userSearchStatus === 'error' && <p className="py-6 text-center px-4 font-body-sm text-body-sm text-error">{userSearchError}</p>}
                {userSearchStatus === 'ready' && userSearchResults.length === 0 && (
                  <p className="py-6 text-center px-4 font-body-sm text-body-sm text-on-surface-variant">Không tìm thấy người chơi phù hợp.</p>
                )}
                {userSearchStatus === 'ready' &&
                  userSearchResults.map((result) => (
                    <UserSearchResult
                      key={result.id}
                      user={result}
                      onSendRequest={handleSendRequest}
                      onCancel={handleCancel}
                      onAccept={handleAccept}
                      onReject={handleReject}
                      busy={busyIds.has(result.id)}
                    />
                  ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="font-label-md text-label-md font-bold text-on-surface-variant mb-2">Lời mời đang chờ</h2>
            <div className="glass-panel border border-gold-shimmer/30 rounded-xl overflow-hidden">
              {received.length === 0 ? (
                <div className="py-10 text-center px-4 space-y-2">
                  <Icon name="mail" size="xl" className="text-on-surface-variant/40 block" />
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Không có lời mời kết bạn</p>
                </div>
              ) : (
                received.map((request) => (
                  <RequestRow
                    key={request.id}
                    request={request}
                    mode="received"
                    onAccept={handleAccept}
                    onReject={handleReject}
                    busy={busyIds.has(request.id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {status === 'ready' && activeTab === 'sent' && (
        <div className="glass-panel border border-gold-shimmer/30 rounded-xl overflow-hidden">
          {sent.length === 0 ? (
            <div className="py-10 text-center px-4 space-y-2">
              <Icon name="outgoing_mail" size="xl" className="text-on-surface-variant/40 block" />
              <p className="font-body-sm text-body-sm text-on-surface-variant">Bạn chưa gửi lời mời kết bạn nào</p>
            </div>
          ) : (
            sent.map((request) => (
              <RequestRow key={request.id} request={request} mode="sent" onCancel={handleCancel} busy={busyIds.has(request.id)} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default Friends
