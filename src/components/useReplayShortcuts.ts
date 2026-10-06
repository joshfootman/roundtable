import { useEffect } from 'react'
import type { DemoCameraState, DemoPlaybackState } from './DemoMap'
import type { MapDefinition } from '../replay/maps'
import type { ReplayRound } from '../replay/types'
import { acceptsReplayShortcuts, replayShortcut } from '../replay/shortcuts'

export function useReplayShortcuts({
  playback,
  camera,
  map,
  round,
  rounds,
  onSelectRound,
  onShowHelp,
}: {
  playback: DemoPlaybackState
  camera: DemoCameraState
  map: MapDefinition
  round: ReplayRound
  rounds: readonly ReplayRound[]
  onSelectRound: (number: number) => void
  onShowHelp: () => void
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!acceptsReplayShortcuts(event)) return
      const shortcut = replayShortcut(event)
      if (!shortcut) return
      if (shortcut.action === 'help') {
        event.preventDefault()
        onShowHelp()
        return
      }
      if (playback.status !== 'ready') return
      const controller = playback.controller
      switch (shortcut.action) {
        case 'toggle':
          if (controller.getSnapshot().playing) controller.pause()
          else controller.play()
          break
        case 'seek':
          controller.seek(controller.getSnapshot().tick + shortcut.seconds / round.tickInterval)
          break
        case 'section':
          controller.seek(
            round.liveStartTick + (round.endTick - round.liveStartTick) * shortcut.fraction,
          )
          break
        case 'round': {
          const adjacent = rounds.find(
            (candidate) => candidate.number === round.number + shortcut.direction,
          )
          if (adjacent) onSelectRound(adjacent.number)
          break
        }
        case 'floor':
          if (map.floors === 'split')
            controller.setFloor(playback.floor === 'upper' ? 'lower' : 'upper')
          break
        case 'focus':
          if (camera.status === 'ready') camera.focus()
          break
        case 'pan':
          if (camera.status === 'ready') camera.panBy(shortcut.delta)
          break
        case 'zoom':
          if (camera.status === 'ready') {
            if (shortcut.direction === 1) camera.zoomIn()
            else camera.zoomOut()
          }
          break
      }
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [playback, camera, map, round, rounds, onSelectRound, onShowHelp])
}
