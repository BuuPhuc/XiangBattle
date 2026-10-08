import { useMemo, useState } from 'react'
import Icon from '../../components/ui/Icon'
import { COURSES } from '../../features/academy/catalog.js'
import { COURSE_LEVELS } from '../../features/academy/constants.js'
import useAcademyProgress from '../../features/academy/hooks/useAcademyProgress'
import { LoadingState, PageHeader, ProgressNotice } from './sections/AcademyParts'
import CourseCard from './sections/CourseCard'

const ALL_LEVELS = 'all'
const CATEGORIES = [{ id: ALL_LEVELS, label: 'Tất cả' }, ...COURSE_LEVELS]

// "Học viện" — the course list. The catalog is static data bundled with the
// app (features/academy/data), so it is filtered right here; only the
// learner's progress is loaded (useAcademyProgress).
export function Academy() {
  const progress = useAcademyProgress()
  const [category, setCategory] = useState(ALL_LEVELS)
  const [search, setSearch] = useState('')

  const courses = useMemo(() => {
    const query = search.trim().toLowerCase()
    return COURSES.filter((course) => {
      if (category !== ALL_LEVELS && course.level !== category) return false
      if (!query) return true
      return course.title.toLowerCase().includes(query) || course.description.toLowerCase().includes(query)
    })
  }, [category, search])

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-6">
      <PageHeader
        backTo="/play"
        backLabel="Quay lại"
        icon="school"
        title="Khóa học"
        subtitle="Học cờ tướng từng bước qua các thử thách tương tác trên bàn cờ."
      />

      <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Cấp độ khóa học">
        {CATEGORIES.map((item) => {
          const active = category === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setCategory(item.id)}
              className={`px-4 py-2 rounded-full font-label-md text-label-md whitespace-nowrap border transition-colors ${
                active
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface-container/60 text-on-surface-variant border-outline-variant/30 hover:bg-surface-container-high'
              }`}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <div className="relative">
        <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant/60" />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm kiếm khóa học"
          aria-label="Tìm kiếm khóa học"
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-outline-variant/30 bg-surface-container/40 font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary"
        />
      </div>

      <ProgressNotice progress={progress} />

      {progress.status === 'loading' ? (
        <LoadingState />
      ) : courses.length === 0 ? (
        <div className="py-16 text-center px-4 space-y-2">
          <Icon name="menu_book" className="text-4xl text-on-surface-variant/40 block" />
          <p className="font-body-md text-body-md text-on-surface-variant">
            {search.trim() ? 'Không tìm thấy khóa học phù hợp.' : 'Chưa có khóa học nào ở cấp độ này.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} completedIds={progress.completedIds} />
          ))}
        </div>
      )}
    </div>
  )
}

export default Academy
