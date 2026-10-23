import type { ReactNode } from 'react'

/**
 * The window's one sidebar. The active pane hands it the sidebar to show, so
 * clicking another pane updates the sidebar in place instead of unmounting one
 * pane's sidebar and mounting the other's (which reset its scroll, team header
 * and loading state on every pane switch). Only this slot re-renders on a hand-off.
 */
export type SidebarSlot = {
  show: (node: ReactNode) => void
  subscribe: (listener: () => void) => () => void
  current: () => ReactNode
}

export function createSidebarSlot(): SidebarSlot {
  let node: ReactNode = null
  const listeners = new Set<() => void>()

  return {
    show: (next) => {
      if (next === node) return
      node = next
      for (const listener of listeners) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)

      return () => listeners.delete(listener)
    },
    current: () => node,
  }
}
