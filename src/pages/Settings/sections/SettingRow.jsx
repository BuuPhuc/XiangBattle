import Icon from '../../../components/ui/Icon'

// One line of the Settings panel: icon + label (+ optional helper text) on
// the left, its control on the right. Stacks the control under the label on
// narrow screens so a select never has to squeeze beside a long label.
export function SettingRow({ icon, label, description, htmlFor, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4 border-b border-outline-variant/20 last:border-b-0">
      <div className="flex items-center gap-3 flex-grow min-w-0">
        <Icon name={icon} className="text-primary flex-shrink-0" />
        <div className="min-w-0">
          <label htmlFor={htmlFor} className="font-body-md text-body-md text-on-surface block">
            {label}
          </label>
          {description && <p className="font-label-sm text-label-sm text-on-surface-variant/70 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="flex-shrink-0 pl-9 sm:pl-0">{children}</div>
    </div>
  )
}

export default SettingRow
