import Icon from '../../../components/ui/Icon'

export function RecentMatches() {
  return (
    <div className="space-y-6 pt-8">
      <div className="flex items-center gap-4 border-b border-outline-variant pb-2">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Ván đấu gần đây</h2>
        <div className="h-[1px] flex-grow bg-gradient-to-r from-outline-variant to-transparent" />
      </div>
      <div className="bg-white/40 backdrop-blur-xl border border-outline-variant/30 rounded-xl p-12 flex flex-col items-center justify-center text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-surface-variant flex items-center justify-center text-outline">
          <Icon name="history_toggle_off" className="text-3xl" />
        </div>
        <p className="font-body-lg text-body-lg text-on-surface-variant">Chưa có ván đấu nào</p>
        <button className="mt-2 text-primary font-label-md text-label-md hover:underline">Khám phá trận đấu</button>
      </div>
    </div>
  )
}

export default RecentMatches
