import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

import { ComposerPicker, ComposerPickerRow } from './composerPicker'
import { SLASH_VISIBLE_ROWS } from './composerSlashCommands'

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
      {/* Two lines tall even for a short description, so five rows always fit. */}
      <span className="flex h-[34px] min-w-0 flex-1 items-center">
        <span className="line-clamp-2 text-[12px] leading-[17px] text-tertiary" title={description}>
          {description}
        </span>
      </span>
    </>
  )
}

/** Five rows tall: down to the fifth row's bottom. */
function fitRows(list: HTMLElement | null) {
  if (!list) return
  const fifth = list.children[SLASH_VISIBLE_ROWS - 1]
  const more = list.children.length > SLASH_VISIBLE_ROWS && fifth instanceof HTMLElement

  list.style.maxHeight = more ? `${String(fifth.offsetTop + fifth.offsetHeight)}px` : ''
}

/**
 * The `/` menu: a strip along the top of the composer, as wide as it, five
 * rows tall with what each command does. The rest scroll, by wheel or by the
 * arrows, which keep the highlighted row in view.
 */
export function SlashCommandPicker({
  options,
  active,
  follow,
  anchor,
  onSelect,
  onActive,
  onClose,
}: {
  options: SlashOption[]
  active: number
  /** The arrows moved the highlight, so the list scrolls to it. */
  follow: boolean
  anchor: Popover.Positioner.Props['anchor']
  onSelect: (option: SlashOption) => void
  onActive: (index: number) => void
  onClose: () => void
}) {
  const list = useRef<HTMLDivElement | null>(null)
  // The popup mounts its rows after this renders, so they are fitted on mount too.
  const attach = useCallback((el: HTMLDivElement | null) => {
    list.current = el
    fitRows(el)
  }, [])

  useLayoutEffect(() => fitRows(list.current), [options])

  useEffect(() => {
    if (follow) list.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active, follow])

  return (
    <ComposerPicker
      open={options.length > 0}
      anchor={anchor}
      label="Commands"
      className="w-[var(--anchor-width)]"
      onClose={onClose}
    >
      <div ref={attach} className="relative overflow-y-auto">
        {options.map((option, i) => (
          <ComposerPickerRow
            key={option.kind === 'agent' ? `agent:${option.command.name}` : option.action.id}
            selected={i === active}
            onSelect={() => onSelect(option)}
            onActive={() => onActive(i)}
          >
            <OptionRow option={option} />
          </ComposerPickerRow>
        ))}
      </div>
      {options.length > SLASH_VISIBLE_ROWS && (
        <div className="px-2 pb-0.5 pt-1 text-[10.5px] text-tertiary">
          {options.length} commands · scroll or ↑↓ for more
        </div>
      )}
    </ComposerPicker>
  )
}
