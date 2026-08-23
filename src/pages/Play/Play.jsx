import PlayHero from './sections/PlayHero'
import PrimaryActions from './sections/PrimaryActions'
import RecentMatches from './sections/RecentMatches'

export function Play() {
  return (
    <>
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gold-shimmer/10 rounded-full blur-3xl -z-10 pointer-events-none transform translate-x-1/3 -translate-y-1/3" />
      <div className="max-w-4xl mx-auto space-y-12 pb-24">
        <PlayHero />
        <PrimaryActions />
        <RecentMatches />
      </div>
    </>
  )
}

export default Play
