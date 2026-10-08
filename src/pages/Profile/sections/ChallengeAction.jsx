import ChallengeButton from '../../../components/challenge/ChallengeButton'
import useChallenges from '../../../features/challenge/useChallenges'

// The Thách đấu action on Public Profile, sitting under FriendAction. Shown
// to everyone, friend or not: whether this player can actually be challenged
// is their own "Ai có thể thách đấu tôi" setting, which only the server
// knows — a refusal comes back as the message below and the button settles
// into "Không thể thách đấu".
export function ChallengeAction({ userId }) {
  const targetId = Number(userId)
  const { propsFor, feedback } = useChallenges()
  const message = feedback && feedback.userId === targetId ? feedback : null

  return (
    <div className="mt-3 flex flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <ChallengeButton {...propsFor(targetId)} />
      </div>
      {message && (
        <p className={`font-label-sm text-label-sm ${message.tone === 'error' ? 'text-error' : 'text-secondary'}`}>{message.text}</p>
      )}
    </div>
  )
}

export default ChallengeAction
