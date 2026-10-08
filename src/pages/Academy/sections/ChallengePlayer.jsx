import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../../../components/ui/Icon'
import Button from '../../../components/ui/Button'
import { academyPaths } from '../../../features/academy/paths.js'
import { MAX_HINT_LEVEL, useAcademyChallenge } from '../../../features/academy/hooks/useAcademyChallenge'
import AcademyBoard from './AcademyBoard'
import LessonComplete from './LessonComplete'
import { BackButton, PieceBadge, ProgressNotice } from './AcademyParts'

const FEEDBACK_STYLE = {
  success: { box: 'bg-jade-light border-secondary/40', text: 'text-secondary', icon: 'check_circle' },
  progress: { box: 'bg-secondary/10 border-secondary/30', text: 'text-secondary', icon: 'thumb_up' },
  error: { box: 'bg-error-container/40 border-error/30', text: 'text-error', icon: 'cancel' },
}

const NAV_BUTTON_CLASS =
  'p-2 rounded-lg text-on-surface-variant hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent transition-colors'

// One challenge, played: the shared board on the left (top on small
// screens), the instruction / feedback / hint / navigation panel beside it.
export function ChallengePlayer({ course, lesson, challenge, index, lessonProgress, progress, onRetry }) {
  const navigate = useNavigate()
  const total = lesson.challenges.length
  const isLast = index === total - 1
  const { completedIds, completeChallenge } = progress

  // Set once the solved challenge has been handed to the progress store:
  // { saved, guest } — drives the "not saved" notes below.
  const [saveResult, setSaveResult] = useState(null)
  const [showCompletion, setShowCompletion] = useState(false)

  const handleSolved = useCallback(
    (moves) => {
      completeChallenge(course.id, challenge.id, moves).then(setSaveResult)
    },
    [completeChallenge, course.id, challenge.id],
  )

  const game = useAcademyChallenge(challenge, { onSolved: handleSolved })

  // Moving on needs this challenge done — now, or on an earlier visit.
  const challengeDone = completedIds.has(challenge.id)
  const goTo = (targetIndex) => navigate(academyPaths.challenge(course.id, lesson.id, targetIndex + 1))

  const lessonIndex = course.lessons.findIndex((entry) => entry.id === lesson.id)
  const nextLesson = course.lessons[lessonIndex + 1] ?? null

  const feedbackStyle = game.feedback ? FEEDBACK_STYLE[game.feedback.type] : null

  return (
    <div className="w-full max-w-container-max mx-auto flex flex-col xl:flex-row gap-gutter justify-center">
      <div className="flex-grow flex flex-col items-center w-full xl:max-w-[780px]">
        <AcademyBoard
          pieces={game.pieces}
          selectedId={game.selectedId}
          moveMarkers={game.moveMarkers}
          targetSquare={game.targetSquare}
          hint={game.hint}
          wrongSquare={game.wrongSquare}
          onSquareClick={game.selectSquare}
        />
      </div>

      <div className="w-full xl:w-96 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <BackButton to={academyPaths.lesson(course.id, lesson.id)} label="Về danh sách thử thách" />
          <PieceBadge type={lesson.piece} size={36} />
          <span className="font-headline-sm text-headline-sm text-on-surface">{lesson.title}</span>
        </div>

        <ProgressNotice progress={progress} />

        {showCompletion ? (
          <LessonComplete
            course={course}
            lesson={lesson}
            lessonProgress={lessonProgress}
            nextLesson={nextLesson}
            onReplay={() => {
              // Back to the first challenge; when that is this very one (a
              // single-challenge lesson), the remount is what restarts it.
              goTo(0)
              onRetry()
            }}
          />
        ) : (
          <>
            <div className="glass-panel border border-outline-variant/40 rounded-2xl p-5 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h1 className="font-label-md text-label-md font-bold text-on-surface">{challenge.title}</h1>
                {game.stepCount > 1 && (
                  <span className="font-label-sm text-label-sm text-on-surface-variant tabular-nums whitespace-nowrap">
                    Nước {Math.min(game.stepIndex + 1, game.stepCount)} / {game.stepCount}
                  </span>
                )}
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant">{challenge.instruction}</p>
            </div>

            {/* aria-live so a screen reader hears "Chính xác!" / the retry
                message as it appears. */}
            <div aria-live="polite" className="space-y-3">
              {game.feedback && (
                <div
                  key={`${game.feedback.type}:${game.wrongSquare?.attempt ?? game.stepIndex}`}
                  className={`academy-fade-in px-4 py-3 rounded-xl border flex items-start gap-2 ${feedbackStyle.box}`}
                >
                  <Icon name={feedbackStyle.icon} filled className={`text-[20px] ${feedbackStyle.text}`} />
                  <p className={`font-body-md text-body-md font-semibold ${feedbackStyle.text}`}>{game.feedback.message}</p>
                </div>
              )}

              {game.solved && (
                <div className="academy-fade-in space-y-2">
                  {isLast ? (
                    <Button size="lg" className="w-full" onClick={() => setShowCompletion(true)}>
                      Hoàn thành
                      <Icon name="emoji_events" />
                    </Button>
                  ) : (
                    <Button size="lg" className="w-full" onClick={() => goTo(index + 1)}>
                      Thử thách tiếp theo
                      <Icon name="arrow_forward" />
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={onRetry}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
                  >
                    <Icon name="replay" className="text-[18px]" />
                    Làm lại
                  </button>
                </div>
              )}

              {saveResult && !saveResult.saved && !saveResult.guest && (
                <p className="font-body-sm text-body-sm text-error">
                  Chưa lưu được tiến độ lên máy chủ. Hãy kiểm tra kết nối — bạn vẫn có thể học tiếp.
                </p>
              )}
            </div>

            <div className="glass-panel border border-gold-shimmer/30 rounded-2xl p-5 space-y-4 xl:mt-auto">
              <div className="flex items-center justify-between gap-3">
                <span className="font-label-md text-label-md font-bold text-on-surface">
                  Thử thách {index + 1} / {total}
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant tabular-nums">
                  {lessonProgress.done} / {total} hoàn thành
                </span>
              </div>

              <div className="flex items-center gap-1.5" aria-hidden="true">
                {lesson.challenges.map((entry, entryIndex) => (
                  <span
                    key={entry.id}
                    className={`h-2 flex-1 rounded-full transition-colors duration-300 ${
                      completedIds.has(entry.id)
                        ? 'bg-secondary'
                        : entryIndex === index
                          ? 'bg-outline'
                          : 'bg-surface-container-high'
                    } ${entryIndex === index ? 'ring-2 ring-primary/40 ring-offset-1 ring-offset-surface' : ''}`}
                  />
                ))}
              </div>

              <Button
                variant="outline-sm"
                size="lg"
                className="w-full disabled:opacity-40 disabled:pointer-events-none"
                onClick={game.requestHint}
                disabled={!game.canHint}
              >
                <Icon name="lightbulb" />
                Gợi ý
                {game.hintLevel > 0 && !game.solved && (
                  <span className="opacity-70 tabular-nums">
                    ({game.hintLevel}/{MAX_HINT_LEVEL})
                  </span>
                )}
              </Button>

              {game.hint && (
                <div className="academy-fade-in font-body-sm text-body-sm text-on-surface-variant space-y-1">
                  {game.hint.tip && <p>{game.hint.tip}</p>}
                  <p className="font-semibold text-on-surface">{game.hint.text}</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <Link
                  to={academyPaths.lesson(course.id, lesson.id)}
                  className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors"
                >
                  Danh sách thử thách
                </Link>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className={NAV_BUTTON_CLASS}
                    onClick={() => goTo(index - 1)}
                    disabled={index === 0}
                    aria-label="Thử thách trước"
                  >
                    <Icon name="chevron_left" />
                  </button>
                  <button
                    type="button"
                    className={NAV_BUTTON_CLASS}
                    onClick={() => goTo(index + 1)}
                    disabled={isLast || !challengeDone}
                    aria-label="Thử thách tiếp theo"
                    title={!isLast && !challengeDone ? 'Hoàn thành thử thách này để mở thử thách tiếp theo' : undefined}
                  >
                    <Icon name="chevron_right" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ChallengePlayer
