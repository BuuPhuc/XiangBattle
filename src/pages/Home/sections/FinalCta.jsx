import Button from '../../../components/ui/Button'

export function FinalCta() {
  return (
    <section className="py-24 relative overflow-hidden bg-primary-container text-on-primary-container">
      <div className="absolute inset-0 bg-wood-dark/20 mix-blend-overlay" />
      <div className="max-w-3xl mx-auto px-margin-mobile text-center relative z-10 space-y-8">
        <h2 className="text-display-lg font-display-lg text-on-primary">Sẵn sàng chinh phục đỉnh cao?</h2>
        <p className="text-body-lg font-body-lg text-primary-fixed-dim">
          Tham gia hàng triệu kỳ thủ trên toàn thế giới và khẳng định trí tuệ của bạn ngay hôm nay.
        </p>
        <Button variant="gold" size="xl">
          Chơi ngay miễn phí
        </Button>
      </div>
    </section>
  )
}

export default FinalCta
