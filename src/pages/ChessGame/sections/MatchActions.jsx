import Icon from '../../../components/ui/Icon'

export function MatchActions() {
  return (
    <div className="flex gap-4">
      <button className="flex-1 py-3 px-4 rounded-lg border-2 border-primary text-primary font-label-md text-label-md hover:bg-primary/5 transition-colors flex items-center justify-center gap-2">
        <Icon name="flag" className="text-[20px]" />
        Xin thua
      </button>
      <button className="flex-1 py-3 px-4 rounded-lg bg-wood-dark text-white font-label-md text-label-md shadow-md hover:scale-[1.02] hover:shadow-lg transition-all flex items-center justify-center gap-2">
        <Icon name="handshake" className="text-[20px]" />
        Cầu hòa
      </button>
    </div>
  )
}

export default MatchActions
