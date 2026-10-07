export const replayShortcuts = [
  { keys: 'K / Space', action: 'Play / pause' },
  { keys: 'J / L', action: 'Back / forward 10 seconds' },
  { keys: '← / →', action: 'Previous / next round' },
  { keys: 'D', action: 'Toggle drawing' },
  { keys: 'Shift + D', action: 'Clear drawings on this floor' },
  { keys: 'F', action: 'Change floor' },
  { keys: 'R', action: 'Recentre map' },
  { keys: '+ / −', action: 'Zoom in / out' },
  { keys: '0–9', action: 'Jump to 0–90% of the round' },
  { keys: 'Shift + arrows', action: 'Pan map' },
  { keys: '?', action: 'Show shortcuts' },
] as const

export type ReplayShortcut =
  | { action: 'toggle' | 'floor' | 'focus' | 'help' | 'drawing-toggle' | 'drawing-clear' }
  | { action: 'pan'; delta: { x: number; y: number } }
  | { action: 'seek'; seconds: number }
  | { action: 'section'; fraction: number }
  | { action: 'round' | 'zoom'; direction: -1 | 1 }

export function replayShortcut(event: {
  key: string
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  repeat: boolean
}): ReplayShortcut | undefined {
  if (event.altKey || event.ctrlKey || event.metaKey) return
  const key = event.key.toLowerCase()
  if (!event.repeat && key === 'd')
    return { action: event.shiftKey ? 'drawing-clear' : 'drawing-toggle' }
  if (!event.shiftKey) {
    if (!event.repeat && (key === 'k' || key === ' ')) return { action: 'toggle' }
    if (key === 'j' || key === 'l') return { action: 'seek', seconds: key === 'j' ? -10 : 10 }
    if (!event.repeat && (key === 'arrowleft' || key === 'arrowright'))
      return { action: 'round', direction: key === 'arrowleft' ? -1 : 1 }
    if (!event.repeat && key === 'f') return { action: 'floor' }
    if (!event.repeat && key === 'r') return { action: 'focus' }
    if (/^[0-9]$/.test(key)) return { action: 'section', fraction: Number(key) / 10 }
  }
  if (event.shiftKey) {
    const delta = {
      arrowleft: { x: 48, y: 0 },
      arrowright: { x: -48, y: 0 },
      arrowup: { x: 0, y: 48 },
      arrowdown: { x: 0, y: -48 },
    }[key]
    if (delta) return { action: 'pan', delta }
  }
  if (key === '+' || key === '=') return { action: 'zoom', direction: 1 }
  if (key === '-' || key === '_') return { action: 'zoom', direction: -1 }
  if (!event.repeat && key === '?') return { action: 'help' }
}

export function acceptsReplayShortcuts(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || document.querySelector('[role="dialog"], [role="menu"]'))
    return false
  const target = event.target
  if (!(target instanceof Element)) return true
  if (
    target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="slider"]',
    )
  )
    return false
  return event.key !== ' ' || !target.closest('button, a, summary, [role="button"]')
}
