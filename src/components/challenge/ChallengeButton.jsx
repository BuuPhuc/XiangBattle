import Icon from '../ui/Icon'
import Button from '../ui/Button'

// The Thách đấu control for one other player, in whichever of its states
// applies (see useChallenges' stateFor). Purely presentational — it draws
// what it is told and reports clicks; `busy` disables every button while a
// request for this player is in flight, so a double click sends nothing
// twice.
export function ChallengeButton({ state, busy, onChallenge, onCancel, onAccept, onReject }) {
  if (state === 'accepted') {
    return (
      <Button variant="outline" size="sm" disabled className="cursor-default opacity-80">
        <Icon name="check" className="text-[16px]" />
        Đã chấp nhận
      </Button>
    )
  }

  if (state === 'received') {
    return (
      <>
        <Button size="sm" disabled={busy} onClick={onAccept} className="disabled:opacity-50" title="Chấp nhận lời mời thách đấu">
          <Icon name="swords" className="text-[16px]" />
          {busy ? 'Đang vào trận...' : 'Nhận thách đấu'}
        </Button>
        <Button variant="outline-sm" size="sm" disabled={busy} onClick={onReject} className="disabled:opacity-50">
          Từ chối
        </Button>
      </>
    )
  }

  if (state === 'sent') {
    return (
      <>
        <Button variant="outline" size="sm" disabled className="cursor-default opacity-80">
          <Icon name="schedule" className="text-[16px]" />
          Đang chờ...
        </Button>
        <Button
          variant="outline-sm"
          size="sm"
          disabled={busy}
          onClick={onCancel}
          className="disabled:opacity-50"
          title="Hủy lời mời thách đấu"
        >
          {busy ? '...' : 'Hủy'}
        </Button>
      </>
    )
  }

  if (state === 'blocked') {
    return (
      <Button variant="outline-sm" size="sm" disabled className="cursor-not-allowed opacity-50">
        <Icon name="block" className="text-[16px]" />
        Không thể thách đấu
      </Button>
    )
  }

  return (
    <Button size="sm" disabled={busy} onClick={onChallenge} className="disabled:opacity-50">
      <Icon name="swords" className="text-[16px]" />
      {busy ? 'Đang gửi...' : 'Thách đấu'}
    </Button>
  )
}

export default ChallengeButton
