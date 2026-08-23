import Icon from '../../../components/ui/Icon'

function Badge({ icon, children }) {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/50 text-label-sm font-label-sm text-on-surface border border-outline-variant/20">
      {icon ? <Icon name={icon} className="text-[16px]" /> : <span className="w-2 h-2 rounded-full bg-secondary" />}
      {children}
    </span>
  )
}

export function FeaturesBento() {
  return (
    <section className="py-24 bg-surface-container-lowest">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-headline-lg font-headline-lg md:text-display-lg md:font-display-lg text-on-primary-fixed">
            Tính năng nổi bật
          </h2>
          <p className="text-body-lg font-body-lg text-on-surface-variant max-w-2xl mx-auto">
            Nền tảng hoàn thiện, đáp ứng mọi nhu cầu từ giải trí đến luyện tập chuyên sâu.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[280px]">
          <div className="md:col-span-2 glass-panel rounded-3xl p-8 border border-outline-variant/30 relative overflow-hidden group wood-shadow hover:shadow-lg transition-shadow">
            <div className="absolute inset-0 bg-gradient-to-br from-surface to-jade-light/20 -z-10" />
            <div className="absolute right-0 bottom-0 w-64 h-64 bg-secondary-container/20 rounded-full blur-3xl group-hover:scale-110 transition-transform" />
            <div className="flex flex-col h-full justify-between">
              <div className="space-y-2">
                <Icon name="language" className="text-4xl text-secondary" />
                <h3 className="text-headline-md font-headline-md text-on-surface">Chơi Online Toàn Cầu</h3>
                <p className="text-body-md font-body-md text-on-surface-variant max-w-sm">
                  Hệ thống ghép cặp thông minh, tìm đối thủ ngang tài ngang sức chỉ trong vài giây.
                </p>
              </div>
              <div className="flex gap-2">
                <Badge>Real-time</Badge>
                <Badge icon="leaderboard">Elo Rating</Badge>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-3xl p-8 border border-outline-variant/30 relative overflow-hidden group wood-shadow hover:shadow-lg transition-shadow">
            <div className="absolute inset-0 bg-gradient-to-br from-surface to-surface-container-highest/50 -z-10" />
            <div className="flex flex-col h-full justify-between">
              <div className="space-y-2">
                <Icon name="smart_toy" className="text-4xl text-primary" />
                <h3 className="text-headline-md font-headline-md text-on-surface">Đấu trí với AI</h3>
                <p className="text-body-md font-body-md text-on-surface-variant">
                  Nhiều cấp độ khó, từ nhập môn đến Kiện tướng.
                </p>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-3xl p-8 border border-outline-variant/30 relative overflow-hidden group wood-shadow hover:shadow-lg transition-shadow">
            <div className="absolute inset-0 bg-gradient-to-br from-surface to-tertiary-fixed/20 -z-10" />
            <div className="flex flex-col h-full justify-between">
              <div className="space-y-2">
                <Icon name="diversity_3" className="text-4xl text-tertiary" />
                <h3 className="text-headline-md font-headline-md text-on-surface">Giao lưu Bạn bè</h3>
                <p className="text-body-md font-body-md text-on-surface-variant">
                  Tạo phòng riêng, mời bạn bè cùng so tài.
                </p>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 glass-panel rounded-3xl p-8 border border-outline-variant/30 relative overflow-hidden group wood-shadow hover:shadow-lg transition-shadow">
            <div className="absolute inset-0 bg-gradient-to-bl from-surface to-primary-container/10 -z-10" />
            <div className="absolute left-0 bottom-0 w-64 h-64 bg-primary-container/10 rounded-full blur-3xl group-hover:scale-110 transition-transform" />
            <div className="flex flex-col h-full justify-between">
              <div className="space-y-2">
                <Icon name="history" className="text-4xl text-primary" />
                <h3 className="text-headline-md font-headline-md text-on-surface">Lưu trữ &amp; Phân tích</h3>
                <p className="text-body-md font-body-md text-on-surface-variant max-w-sm">
                  Tự động lưu lịch sử ván đấu. Xem lại (Replay) từng nước đi để rút kinh nghiệm.
                </p>
              </div>
              <div className="flex gap-2">
                <Badge icon="play_circle">Replay</Badge>
                <Badge icon="analytics">Engine Analysis</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default FeaturesBento
