import Icon from '../../../components/ui/Icon'

export function SettingSelect({ id, value, options, onChange, disabled = false }) {
  return (
    <div className="relative w-full sm:w-56">
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full appearance-none pl-4 pr-10 py-2 rounded-lg border border-outline-variant bg-surface-container text-on-surface font-label-md text-label-md focus:outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon name="expand_more" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
    </div>
  )
}

export default SettingSelect
