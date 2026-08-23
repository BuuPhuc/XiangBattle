import Icon from '../../../components/ui/Icon'

const REASONS = [
  { icon: 'volunteer_activism', label: 'Chơi miễn phí' },
  { icon: 'public', label: 'Chơi online' },
  { icon: 'people', label: 'Chơi với người khác' },
  { icon: 'psychology', label: 'Rèn luyện tư duy' },
  { icon: 'devices', label: 'Mọi lúc mọi nơi', wide: true },
]

export function WhyChooseUs() {
  return (
    <section className="py-24 bg-surface-container-lowest border-y border-outline-variant/20 relative">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {REASONS.map(({ icon, label, wide }) => (
            <div
              key={label}
              className={`flex flex-col items-center text-center gap-4 group ${
                wide ? 'col-span-2 md:col-span-1' : ''
              }`}
            >
              <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center group-hover:bg-tertiary-fixed/30 group-hover:-translate-y-1 transition-all duration-300 wood-shadow">
                <Icon name={icon} className="text-3xl text-primary" />
              </div>
              <h3 className="font-label-md text-label-md text-on-surface">{label}</h3>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default WhyChooseUs
