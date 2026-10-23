import { ComposerPicker, ComposerPickerRow } from './composerPicker'
import { SLASH_VISIBLE_ROWS, slashWindowStart } from './composerSlashCommands'

import type { SlashOption } from './composerSlashCommands'
import type { Popover } from '@base-ui/react/popover'

function OptionRow({ option }: { option: SlashOption }) {
  const nuphos = option.kind === 'nuphos'
  const name = nuphos ? option.action.title : `/${option.command.name}`
  const description = nuphos ? option.action.description : option.command.description
  const hint = nuphos ? undefined : option.command.hint

  return (
    <>
      <span className="flex w-[34%] min-w-0 max-w-[240px] shrink-0 items-baseline gap-1.5">
        <span className="truncate font-mono text-[12.5px] text-main">{name}</span>
        {nuphos && (
          // Nuphos actions run when picked, so they never pass for something the agent runs.
          <span className="shrink-0 rounded bg-zGray-800/60 px-1 text-[10px] text-tertiary">
            Nuphos
          </span>
        )}
        {hint && <span className="truncate text-[11px] text-tertiary">{hint}</span>}
      </span>
      <span
        className="line-clamp-2 min-w-0 flex-1 text-[12px] leading-[17px] text-tertiary"
        title={description}
      >
        {description}
      </span>
    </>
  )
}

/**
 * The `/` menu: a strip along the top of the composer, as wide as it, showing
 * a few rows at a time with what each command does. The arrows scroll through
 * the rest.
 */
export function SlashCommandPicker({
  options,
  active,
  anchor,
  onSelect,
  onActive,
  onClose,
}: {
  options: SlashOption[]
  active: number
  anchor: Popover.Positioner.Props['anchor']
  onSelect: (option: SlashOption) => void
  onActive: (index: number) => void
  onClose: () => void
}) {
  const start = slashWindowStart(active, options.length)
  const shown = options.slice(start, start + SLASH_VISIBLE_ROWS)

  return (
    <ComposerPicker
      open={options.length > 0}
      anchor={anchor}
      label="Commands"
      className="w-[var(--anchor-width)]"
      onClose={onClose}
    >
      {shown.map((option, i) => (
        <ComposerPickerRow
          key={option.kind === 'agent' ? `agent:${option.command.name}` : option.action.id}
          selected={start + i === active}
          onSelect={() => onSelect(option)}
          onActive={() => onActive(start + i)}
        >
          <OptionRow option={option} />
        </ComposerPickerRow>
      ))}
      {options.length > SLASH_VISIBLE_ROWS && (
        <div className="px-2 pb-0.5 pt-1 text-[10.5px] text-tertiary">
          {start + 1}–{start + shown.length} of {options.length} · ↑↓ for more
        </div>
      )}
    </ComposerPicker>
  )
}
