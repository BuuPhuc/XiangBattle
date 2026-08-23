import Icon from '../ui/Icon'

export function AppTopBar() {
  return (
    <nav
      aria-label="Top Navigation"
      className="fixed top-0 w-full z-50 bg-surface/80 dark:bg-inverse-surface/80 backdrop-blur-xl md:hidden flex justify-between items-center px-gutter py-4 shadow-sm"
    >
      <span className="font-headline-md text-headline-md font-bold text-primary dark:text-primary-fixed-dim tracking-tight">
        Xiangqi Master
      </span>
      <div className="flex items-center gap-4">
        <button aria-label="Thông báo" className="text-on-surface-variant/70 hover:text-primary transition-colors duration-300 active:scale-95">
          <Icon name="notifications" />
        </button>
        <button aria-label="Tài khoản" className="text-on-surface-variant/70 hover:text-primary transition-colors duration-300 active:scale-95 flex items-center">
          <Icon name="person" className="mr-2" />
          <span className="font-label-md text-label-md hidden sm:inline">Người chơi</span>
        </button>
      </div>
    </nav>
  )
}

export default AppTopBar
