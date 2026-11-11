import { Link } from 'react-router-dom'
import Button from '../../../components/ui/Button'
import Icon from '../../../components/ui/Icon'
import XiangqiBoard from '../../../components/ui/XiangqiBoard'
import OnlineFriends from './OnlineFriends'

export function Hero() {
  return (
    <header className="relative pt-20 pb-32 overflow-hidden">
      <div className="absolute inset-0 bg-surface-container-low -z-10" />
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-tertiary-fixed/20 to-transparent -z-10" />

      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-8 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high border border-outline-variant/50">
            <Icon name="star" filled className="text-gold-shimmer" />
            <span className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">
              TIÊU CHUẨN HOÀNG GIA
            </span>
          </div>

          <h1 className="font-display-lg text-display-lg text-on-primary-fixed leading-tight">
            Chơi Cờ Tướng Online <span className="text-primary-container">Miễn Phí</span>
          </h1>

          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-lg">
            Trải nghiệm đỉnh cao trí tuệ cùng cộng đồng kỳ thủ khắp thế giới. Giao diện sang trọng,
            tĩnh tâm. Chơi ngay không cần cài đặt.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Button as={Link} to="/play" variant="primary" size="lg" className="group">
              <Icon name="play_arrow" className="group-hover:translate-x-1 transition-transform" />
              Chơi ngay
            </Button>
            <Button variant="outline" size="lg">
              <Icon name="menu_book" />
              Học luật chơi
            </Button>
          </div>

          <OnlineFriends />
        </div>

        <div className="relative z-10 w-full h-[400px] md:h-[600px] flex justify-center items-center">
          <div className="absolute inset-0 bg-gold-shimmer/10 rounded-full blur-3xl transform scale-75" />
          <XiangqiBoard className="w-full h-full max-w-[480px] drop-shadow-2xl z-10 hover:scale-[1.01] transition-transform duration-700" />
        </div>
      </div>
    </header>
  )
}

export default Hero
