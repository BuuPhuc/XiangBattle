import Icon from '../../../components/ui/Icon'

export function GameOverBanner({ winner }) {
  const winnerLabel = winner === 'red' ? 'Đỏ' : 'Đen'

  return (
    <div className="mb-6 px-8 py-4 rounded-2xl bg-primary text-on-primary wood-shadow flex items-center gap-4">
      <Icon name="military_tech" className="text-4xl text-gold-shimmer" filled />
      <div>
        <p className="font-headline-md text-headline-md">Chiếu bí!</p>
        <p className="font-label-md text-label-md text-primary-fixed-dim">Bên {winnerLabel} thắng cuộc</p>
      </div>
    </div>
  )
}

export default GameOverBanner
