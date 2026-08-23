const SUPPORT_LINKS = ['Hướng dẫn luật chơi', 'Câu hỏi thường gặp', 'Support']
const LEGAL_LINKS = ['Privacy Policy', 'Terms of Service', 'Press Kit']

function FooterLinkList({ title, links }) {
  return (
    <div className="space-y-4">
      <h4 className="text-tertiary-fixed dark:text-tertiary font-label-md text-label-md uppercase tracking-wider">
        {title}
      </h4>
      <ul className="space-y-2">
        {links.map((label) => (
          <li key={label}>
            <a
              href="#"
              className="text-surface-variant/70 hover:text-white transition-colors font-label-sm text-label-sm hover:translate-x-1 opacity-80 hover:opacity-100 duration-300 inline-block"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Footer() {
  return (
    <footer className="bg-onyx-ink dark:bg-surface-container-lowest w-full py-12 border-t border-wood-dark/20">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-gutter px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        <div className="col-span-1 md:col-span-2 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-primary-container flex items-center justify-center text-on-primary-container font-bold">
              象
            </div>
            <span className="text-headline-sm font-headline-sm text-gold-shimmer">Xiangqi Master</span>
          </div>
          <p className="text-surface-variant/70 font-body-md text-body-md max-w-sm">
            Nền tảng cờ tướng trực tuyến hàng đầu, mang đến trải nghiệm thi đấu chuyên nghiệp và tĩnh tâm.
          </p>
        </div>

        <FooterLinkList title="Hỗ trợ" links={SUPPORT_LINKS} />
        <FooterLinkList title="Pháp lý" links={LEGAL_LINKS} />

        <div className="col-span-1 md:col-span-4 mt-8 pt-8 border-t border-wood-dark/20 text-center">
          <p className="text-surface-variant/50 font-label-sm text-label-sm">
            © 2026 Xiangqi Master. The Imperial Sovereign Standard.
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
