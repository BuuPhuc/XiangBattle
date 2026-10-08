import { useEffect, useState } from 'react'

// Returns `value`, but only after it has stopped changing for `delayMs` —
// the standard "wait for the user to stop typing" debounce. Generic on
// purpose (not search-specific) so any future input-driven fetch can reuse
// it instead of hand-rolling its own setTimeout/clearTimeout pair.
export function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

export default useDebouncedValue
