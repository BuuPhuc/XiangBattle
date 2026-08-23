import Icon from '../../../components/ui/Icon'
import XiangqiBoard from '../../../components/ui/XiangqiBoard'

const FACTS = [
  { icon: 'grid_on', title: 'Bàn cờ 9x10', desc: 'Với ranh giới "Sở Hà Hán Giới" rõ ràng.' },
  { icon: 'groups', title: '2 Người chơi', desc: 'Cuộc đấu trí căng thẳng, công bằng.' },
  { icon: 'extension', title: '32 Quân cờ', desc: 'Mỗi bên 16 quân, đa dạng cách di chuyển.' },
  { icon: 'sports_martial_arts', title: 'Mục tiêu', desc: 'Chiếu bí Tướng đối phương để giành chiến thắng.' },
]

export function WhatIsXiangqi() {
  return (
    <section className="py-32 relative overflow-hidden">
      <div className="absolute top-1/2 left-0 w-64 h-64 bg-gold-shimmer/10 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2" />

      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="order-2 lg:order-1 relative group">
            <div className="absolute inset-0 bg-primary-container/5 rounded-3xl transform rotate-3 group-hover:rotate-6 transition-transform duration-500" />
            <div className="glass-panel p-4 rounded-3xl border border-white/50 wood-shadow relative z-10">
              <XiangqiBoard className="w-full rounded-2xl" />
            </div>
          </div>

          <div className="order-1 lg:order-2 space-y-8">
            <div>
              <h2 className="text-headline-lg font-headline-lg md:text-display-lg md:font-display-lg text-on-primary-fixed mb-4">
                Tinh hoa Cờ Tướng
              </h2>
              <p className="text-body-lg font-body-lg text-on-surface-variant">
                Cờ tướng (Xiangqi) là một trò chơi trí tuệ cổ xưa, mô phỏng cuộc chiến giữa hai quốc
                gia. Mục tiêu tối thượng là chiếu bí Tướng của đối phương, đòi hỏi tầm nhìn chiến lược
                và sự tính toán kỹ lưỡng.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {FACTS.map(({ icon, title, desc }) => (
                <div
                  key={title}
                  className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2"
                >
                  <Icon name={icon} className="text-3xl text-secondary" />
                  <h4 className="font-label-md text-label-md text-on-surface">{title}</h4>
                  <p className="text-label-sm font-label-sm text-on-surface-variant">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default WhatIsXiangqi
