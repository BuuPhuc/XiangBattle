import { useAuth } from '../../components/hooks/useAuth'

export function Dashboard() {
  const { user } = useAuth()

  return (
    <section className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-32">
      <h1 className="text-headline-lg font-headline-lg text-on-primary-fixed">
        Chào mừng trở lại{user?.username ? `, ${user.username}` : ''}
      </h1>
      <p className="text-body-lg font-body-lg text-on-surface-variant mt-4 max-w-2xl">
        Bảng điều khiển ván đấu đang được xây dựng.
      </p>
    </section>
  )
}

export default Dashboard
