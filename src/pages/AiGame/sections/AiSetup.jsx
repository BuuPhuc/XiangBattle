import { useState } from 'react'
import Icon from '../../../components/ui/Icon'
import Button from '../../../components/ui/Button'
import { cn } from '../../../components/utils/cn'
import { AI_LEVELS, AI_LEVEL_ORDER } from '../../../features/ai/engine/levels.js'

const COLOR_OPTIONS = [
  { id: 'red', label: 'Cầm Đỏ', hint: 'Đi trước', swatch: 'bg-piece-red' },
  { id: 'black', label: 'Cầm Đen', hint: 'Đi sau', swatch: 'bg-piece-black' },
  { id: 'random', label: 'Ngẫu nhiên', hint: 'Để máy chọn', swatch: 'bg-gradient-to-br from-piece-red to-piece-black' },
]

function OptionCard({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'bg-white/40 backdrop-blur-xl rounded-xl p-5 text-left border-2 transition-all duration-200 hover:scale-[1.02]',
        selected ? 'border-primary shadow-[0_4px_12px_rgba(139,94,60,0.15)]' : 'border-outline-variant/30'
      )}
    >
      {children}
    </button>
  )
}

// Choose difficulty and colour, then start. Calls onStart({ levelId, color })
// with color 'red' | 'black' | 'random' (the page resolves 'random').
export function AiSetup({ initialLevelId = 'medium', initialColor = 'red', onStart }) {
  const [levelId, setLevelId] = useState(initialLevelId)
  const [color, setColor] = useState(initialColor)

  return (
    <div className="max-w-3xl mx-auto space-y-10 pb-24 px-4">
      <div className="text-center space-y-3 pt-8 md:pt-12">
        <div className="w-16 h-16 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center mx-auto">
          <Icon name="smart_toy" className="text-4xl" />
        </div>
        <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
          Đối đầu với máy
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Ván đấu với máy không tính Elo và không lưu vào lịch sử trận đấu.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Độ khó</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {AI_LEVEL_ORDER.map((id) => {
            const level = AI_LEVELS[id]
            return (
              <OptionCard key={id} selected={levelId === id} onClick={() => setLevelId(id)}>
                <div className="font-label-lg text-label-lg font-bold text-on-surface">{level.label}</div>
                <div className="font-body-sm text-body-sm text-on-surface-variant mt-1">{level.description}</div>
              </OptionCard>
            )
          })}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Quân của bạn</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {COLOR_OPTIONS.map((option) => (
            <OptionCard key={option.id} selected={color === option.id} onClick={() => setColor(option.id)}>
              <div className="flex items-center gap-3">
                <span className={cn('w-8 h-8 rounded-full shrink-0', option.swatch)} />
                <div>
                  <div className="font-label-lg text-label-lg font-bold text-on-surface">{option.label}</div>
                  <div className="font-body-sm text-body-sm text-on-surface-variant">{option.hint}</div>
                </div>
              </div>
            </OptionCard>
          ))}
        </div>
      </section>

      <div className="flex justify-center">
        <Button size="lg" onClick={() => onStart({ levelId, color })}>
          <Icon name="play_arrow" />
          Bắt đầu ván đấu
        </Button>
      </div>
    </div>
  )
}

export default AiSetup
