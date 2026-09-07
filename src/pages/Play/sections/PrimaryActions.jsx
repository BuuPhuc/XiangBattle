import { Link } from 'react-router-dom'
import Icon from '../../../components/ui/Icon'

const MODES = [
  {
    icon: 'group',
    label: 'Chơi với người khác',
    iconBg: 'bg-secondary-container text-on-secondary-container',
    to: '/room',
  },
  { icon: 'smart_toy', label: 'Chơi với máy', iconBg: 'bg-tertiary-container text-on-tertiary-container' },
]

export function PrimaryActions() {
  return (
    <div className="flex flex-col items-center gap-8">
      <Link
        to="/room?mode=quick"
        className="bg-white/40 backdrop-blur-xl w-full max-w-md py-12 rounded-xl flex flex-col items-center justify-center gap-4 group relative overflow-hidden border-2 border-transparent hover:border-gold-shimmer/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_4px_12px_rgba(139,94,60,0.15)]"
      >
        <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors" />
        <div className="w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow z-10 relative">
          <Icon name="person" className="text-4xl" />
          <div className="absolute inset-0 rounded-full bg-gold-shimmer/30 blur-md -z-10 group-hover:opacity-100 opacity-0 transition-opacity" />
        </div>
        <span className="font-headline-md text-headline-md text-primary tracking-wide z-10">CHƠI NGAY</span>
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        {MODES.map(({ icon, label, iconBg, to }) => {
          const Component = to ? Link : 'button'
          return (
            <Component
              key={label}
              {...(to ? { to } : {})}
              className="bg-white/40 backdrop-blur-xl border border-outline-variant/30 p-8 rounded-xl flex items-center justify-between group transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_4px_12px_rgba(139,94,60,0.15)]"
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconBg}`}>
                  <Icon name={icon} />
                </div>
                <span className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors">
                  {label}
                </span>
              </div>
              <Icon name="arrow_forward" className="text-outline group-hover:text-primary transition-colors group-hover:translate-x-1" />
            </Component>
          )
        })}
      </div>
    </div>
  )
}

export default PrimaryActions
