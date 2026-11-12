import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Icon from '../../components/ui/Icon'
import Button from '../../components/ui/Button'
import { ABOUT_SECTIONS } from './aboutSections'

const RULES = [
  {
    icon: 'block',
    title: 'Hết nước đi là thua',
    desc: 'Bên đến lượt mà không còn nước đi hợp lệ thì thua, dù không bị chiếu — khác với cờ vua, nơi trường hợp này là hòa.',
  },
  {
    icon: 'repeat',
    title: 'Lặp nước',
    desc: 'Khi cùng một thế cờ lặp lại lần thứ ba: bên chiếu mãi hoặc đuổi bắt mãi một quân sẽ bị xử thua; nếu không bên nào phạm luật thì ván hòa.',
  },
  {
    icon: 'leaderboard',
    title: 'Elo chỉ tính cho ván online giữa hai tài khoản',
    desc: 'Ván đấu online mà cả hai người đều đã đăng nhập được lưu lại và tính điểm Elo. Ván có khách, ván với máy và ván chơi trên một màn hình không được tính điểm.',
  },
  {
    icon: 'gavel',
    title: 'Máy chủ làm trọng tài',
    desc: 'Mọi nước đi trong ván online đều được máy chủ kiểm tra lại theo cùng bộ luật, và chỉ máy chủ quyết định ván kết thúc thế nào — kể cả hết giờ.',
  },
]

const STORED_DATA = [
  'Thông tin tài khoản: tên người dùng, email, mật khẩu (chỉ lưu dạng đã băm, không ai đọc được), ảnh đại diện và lời giới thiệu.',
  'Điểm Elo và số ván thắng / thua / hòa.',
  'Lịch sử các ván online giữa hai tài khoản, gồm toàn bộ nước đi — để bạn có thể xem lại.',
  'Danh sách bạn bè, lời mời, lời thách đấu và thông báo.',
  'Tiến độ ở Học viện và các cài đặt của bạn.',
]

const CREDITS = [
  {
    what: 'Âm thanh đi quân, ăn quân, chiếu tướng, kết thúc ván',
    source: 'Impact Sounds — Kenney',
    href: 'https://kenney.nl/assets/impact-sounds',
    license: 'CC0',
  },
  {
    what: 'Phông chữ Inter, Noto Serif, Noto Serif SC',
    source: 'Google Fonts',
    href: 'https://fonts.google.com',
    license: 'SIL Open Font License',
  },
  {
    what: 'Biểu tượng',
    source: 'Material Symbols — Google',
    href: 'https://fonts.google.com/icons',
    license: 'Apache 2.0',
  },
]

function SectionTitle({ icon, children }) {
  return (
    <h2 className="text-headline-md font-headline-md text-on-primary-fixed flex items-center gap-3">
      <Icon name={icon} className="text-secondary" />
      {children}
    </h2>
  )
}

// "Giới thiệu" — what the site is and how it works (its own rules, what it
// stores), not a second home page: the game itself and the feature list are
// already on Home. Reached from the Footer, which also links straight to
// the rules and data sections by their anchors (#luat-choi, #du-lieu).
export function About() {
  const { hash } = useLocation()

  // React Router doesn't scroll to an #anchor on its own: do it whenever the
  // hash changes (arriving from the Footer, or clicking it again here), and
  // otherwise start at the top of the page.
  useEffect(() => {
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else window.scrollTo(0, 0)
  }, [hash])

  return (
    <div className="max-w-4xl mx-auto px-margin-mobile md:px-margin-desktop py-24 space-y-20">
      <header className="space-y-6">
        <h1 className="text-headline-lg font-headline-lg md:text-display-lg md:font-display-lg text-on-primary-fixed">
          Về XiangBattle
        </h1>
        <p className="text-body-lg font-body-lg text-on-surface-variant">
          XiangBattle là nơi chơi cờ tướng trực tuyến miễn phí: đấu với người khác qua mạng, luyện với máy ở ba
          mức độ, học luật và cách đi từng quân ở Học viện, rồi xem lại các ván đã chơi để rút kinh nghiệm.
        </p>
        <p className="text-body-lg font-body-lg text-on-surface-variant">
          Bạn có thể chơi ngay mà không cần tài khoản. Đăng ký tài khoản khi bạn muốn có điểm Elo, lưu lịch sử ván
          đấu, kết bạn và thách đấu bạn bè.
        </p>
      </header>

      <section id={ABOUT_SECTIONS.rules} className="space-y-8 scroll-mt-28">
        <SectionTitle icon="menu_book">Luật riêng của XiangBattle</SectionTitle>
        <p className="text-body-md font-body-md text-on-surface-variant">
          XiangBattle theo luật cờ tướng thông thường. Dưới đây là những điểm người chơi hay thắc mắc. Muốn học luật
          từ đầu, hãy vào{' '}
          <Link to="/academy" className="text-primary font-bold hover:underline">
            Học viện
          </Link>
          .
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {RULES.map(({ icon, title, desc }) => (
            <div
              key={title}
              className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2"
            >
              <Icon name={icon} className="text-3xl text-secondary" />
              <h3 className="font-label-md text-label-md text-on-surface">{title}</h3>
              <p className="text-label-sm font-label-sm text-on-surface-variant">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id={ABOUT_SECTIONS.data} className="space-y-6 scroll-mt-28">
        <SectionTitle icon="shield_person">Dữ liệu của bạn</SectionTitle>
        <p className="text-body-md font-body-md text-on-surface-variant">
          Khi bạn có tài khoản, XiangBattle lưu những thông tin cần cho việc chơi:
        </p>
        <ul className="space-y-3">
          {STORED_DATA.map((item) => (
            <li key={item} className="flex gap-3 text-body-md font-body-md text-on-surface-variant">
              <Icon name="check_circle" className="text-secondary text-xl flex-shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-body-md font-body-md text-on-surface-variant">
          Bạn tự chọn ai được xem các ván đã kết thúc của mình và ai được gửi lời thách đấu cho bạn, trong{' '}
          <Link to="/settings" className="text-primary font-bold hover:underline">
            Cài đặt
          </Link>
          .
        </p>
        <p className="text-body-md font-body-md text-on-surface-variant">
          Nếu chơi không đăng nhập, không có gì về bạn được lưu vào cơ sở dữ liệu của XiangBattle; tùy chọn âm
          thanh của bạn chỉ được lưu trên trình duyệt đang dùng.
        </p>
      </section>

      <section className="space-y-6">
        <SectionTitle icon="favorite">Ghi nguồn</SectionTitle>
        <ul className="space-y-3">
          {CREDITS.map(({ what, source, href, license }) => (
            <li key={what} className="text-body-md font-body-md text-on-surface-variant">
              <span className="text-on-surface">{what}</span>:{' '}
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary font-bold hover:underline">
                {source}
              </a>{' '}
              ({license})
            </li>
          ))}
        </ul>
      </section>

      <div className="text-center">
        <Button as={Link} to="/play" variant="gold" size="xl">
          Chơi ngay
        </Button>
      </div>
    </div>
  )
}

export default About
