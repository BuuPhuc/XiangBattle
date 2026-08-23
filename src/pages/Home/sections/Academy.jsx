import Icon from '../../../components/ui/Icon'

const TOPICS = [
  { icon: 'school', label: 'Hướng dẫn luật chơi' },
  { icon: 'transform', label: 'Cách di chuyển quân' },
  { icon: 'lightbulb', label: 'Chiến thuật' },
  { icon: 'book', label: 'Khai cuộc' },
  { icon: 'extension', label: 'Bài tập thế cờ' },
]

export function Academy() {
  return (
    <section className="py-32 relative">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop text-center">
        <span className="text-label-md font-label-md text-tertiary uppercase tracking-widest mb-4 block">
          Học viện Cờ Tướng
        </span>
        <h2 className="text-headline-lg font-headline-lg md:text-display-lg md:font-display-lg text-on-primary-fixed mb-16">
          Nâng tầm kỳ nghệ
        </h2>

        <div className="flex flex-wrap justify-center gap-4">
          {TOPICS.map(({ icon, label }) => (
            <a
              key={label}
              href="#"
              className="px-6 py-3 rounded-full bg-surface-container border border-outline-variant/30 text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors flex items-center gap-2"
            >
              <Icon name={icon} className="text-[20px]" />
              {label}
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Academy
