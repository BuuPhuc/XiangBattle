import Icon from '../../components/ui/Icon'

// "Câu lạc bộ" — listed in the Xã hội submenu so the information
// architecture is in place, but intentionally not implemented yet (no
// backend, no database, no API — see server-side FINAL REPORT notes).
// Pure placeholder, same shape as PublicProfile.jsx's not-found state.
export function ClubComingSoon() {
  return (
    <div className="max-w-xl mx-auto py-24 px-4 text-center space-y-4">
      <Icon name="emoji_events" className="text-5xl text-on-surface-variant/40 block" />
      <h1 className="font-headline-sm text-headline-sm text-on-surface">Câu lạc bộ sẽ sớm ra mắt</h1>
      <p className="font-body-md text-body-md text-on-surface-variant">
        Tính năng câu lạc bộ đang được phát triển. Hãy quay lại sau nhé!
      </p>
    </div>
  )
}

export default ClubComingSoon
