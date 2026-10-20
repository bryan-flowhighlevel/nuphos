import { clsx } from 'clsx'
import {
  ArrowLeftRight,
  PanelBottom,
  PanelLeft,
  PanelRight,
  PanelTop,
  SquareArrowDown,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { PANE_DRAG_TYPE, SESSION_DRAG_TYPE, dropZone } from './splitLayout'

import type { DropZone, PaneRect } from './splitLayout'
import type { WorkspaceStore } from './store/workspaceStore'
import type { DragEvent } from 'react'

type Seed = { sessionId: string; teamId?: string }

/**
 * Covers the panes while a sidebar chat or a pane's grip is dragged, and shows
 * where it would land: an edge splits that side, the middle swaps two panes
 * or replaces the chat.
 * Other drags (files into the composer) never mount it.
 */
export function SplitDropOverlay({
  rects,
  stores,
  split,
  place,
}: {
  rects: PaneRect[]
  stores: Map<string, WorkspaceStore>
  split: (side: Exclude<DropZone, 'center'>, from: string, seed: Seed) => string | null
  place: (target: string, id: string, zone: DropZone) => void
}) {
  // `pane` is the dragged grip's pane; null for a sidebar chat.
  const [drag, setDrag] = useState<{ pane: string | null } | null>(null)
  const [hover, setHover] = useState<{ rect: PaneRect; zone: DropZone } | null>(null)

  useEffect(() => {
    const start = (event: globalThis.DragEvent) => {
      const types = event.dataTransfer?.types ?? []
      const pane = types.includes(PANE_DRAG_TYPE)
        ? ((event.target as Element).closest<HTMLElement>('[data-workspace-split-pane]')?.dataset
            .workspaceSplitPane ?? null)
        : null

      if (!pane && !types.includes(SESSION_DRAG_TYPE)) return
      // Chromium cancels a drag whose source is covered during dragstart.
      setTimeout(() => setDrag({ pane }))
    }
    const end = () => {
      setDrag(null)
      setHover(null)
    }

    window.addEventListener('dragstart', start)
    window.addEventListener('dragend', end)
    window.addEventListener('drop', end)

    return () => {
      window.removeEventListener('dragstart', start)
      window.removeEventListener('dragend', end)
      window.removeEventListener('drop', end)
    }
  }, [])

  if (!drag) return null

  const target = (event: DragEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - box.left) / box.width) * 100
    const y = ((event.clientY - box.top) / box.height) * 100
    const rect = rects.find(
      (r) => x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height,
    )

    if (!rect) return null
    const zone = dropZone((x - rect.left) / rect.width, (y - rect.top) / rect.height)

    // A pane never drops on itself; its centre swaps with another pane.
    if (drag.pane && rect.id === drag.pane) return null

    return { rect, zone }
  }
  const drop = (pane: string, zone: DropZone, event: DragEvent) => {
    const raw = event.dataTransfer.getData(SESSION_DRAG_TYPE)
    const seed = raw ? (JSON.parse(raw) as Seed) : null
    // A chat already open in a pane moves with that pane rather than opening twice.
    const moving =
      drag.pane ??
      [...stores].find(([, store]) => {
        const state = store.getState()

        return seed !== null && !state.mainPageOpen && state.sessionId === seed.sessionId
      })?.[0]

    if (moving) place(pane, moving, zone)
    else if (seed && zone === 'center') {
      stores.get(pane)?.actions.selectSession(seed.sessionId, { teamId: seed.teamId })
      place(pane, pane, zone)
    } else if (seed && zone !== 'center') split(zone, pane, seed)
  }

  return (
    <div
      className="absolute inset-0 z-50"
      onDragOver={(event) => {
        const next = target(event)

        if (next) event.preventDefault()
        event.dataTransfer.dropEffect = next ? 'move' : 'none'
        setHover((previous) =>
          previous?.rect.id === next?.rect.id && previous?.zone === next?.zone ? previous : next,
        )
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHover(null)
      }}
      onDrop={(event) => {
        const next = target(event)

        event.preventDefault()
        if (next) drop(next.rect.id, next.zone, event)
      }}
    >
      {drag.pane && <SourceVeil rect={rects.find((r) => r.id === drag.pane)} />}
      {hover && <ZoneHint rect={hover.rect} zone={hover.zone} movingPane={drag.pane !== null} />}
    </div>
  )
}

const EDGE_HINTS = {
  left: { Icon: PanelLeft, text: 'Split left' },
  right: { Icon: PanelRight, text: 'Split right' },
  top: { Icon: PanelTop, text: 'Split up' },
  bottom: { Icon: PanelBottom, text: 'Split down' },
}

function centreHint(movingPane: boolean) {
  return movingPane
    ? { Icon: ArrowLeftRight, text: 'Swap' }
    : { Icon: SquareArrowDown, text: 'Open here' }
}

/** Blurs the pane under the pointer and labels what letting go will do there. */
function ZoneHint({
  rect,
  zone,
  movingPane,
}: {
  rect: PaneRect
  zone: DropZone
  movingPane: boolean
}) {
  const { Icon, text } = zone === 'center' ? centreHint(movingPane) : EDGE_HINTS[zone]

  return (
    <>
      <div
        className="pointer-events-none absolute bg-zGray-950/25 backdrop-blur-[3px] transition-opacity duration-150"
        style={zoneStyle(rect, 'center')}
      />
      <div
        className={clsx(
          'pointer-events-none absolute flex items-center justify-center rounded-lg border border-zViolet-400/70 bg-zViolet-500/10 transition-all duration-150 ease-out',
          zone === 'center' ? 'm-2' : 'm-1.5',
        )}
        style={zoneStyle(rect, zone)}
      >
        <span className="flex items-center gap-1.5 rounded-full border border-zGray-700 bg-elevated/95 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-main shadow-lg">
          <Icon className="h-3.5 w-3.5 text-zViolet-300" strokeWidth={1.8} />
          {text}
        </span>
      </div>
    </>
  )
}

/** The dragged pane steps back so the eye follows the drop target instead. */
function SourceVeil({ rect }: { rect?: PaneRect }) {
  if (!rect) return null

  return (
    <div
      className="pointer-events-none absolute bg-zGray-950/40 transition-opacity duration-150"
      style={zoneStyle(rect, 'center')}
    />
  )
}

function zoneStyle({ left, top, width, height }: PaneRect, zone: DropZone) {
  const box = {
    left: { left, top, width: width / 2, height },
    right: { left: left + width / 2, top, width: width / 2, height },
    top: { left, top, width, height: height / 2 },
    bottom: { left, top: top + height / 2, width, height: height / 2 },
    center: { left, top, width, height },
  }[zone]

  return {
    left: `${String(box.left)}%`,
    top: `${String(box.top)}%`,
    width: `${String(box.width)}%`,
    height: `${String(box.height)}%`,
  }
}
