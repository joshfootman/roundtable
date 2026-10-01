import type { DemoMetadata } from './metadata'
import type { ImportEvent } from './import'
import type { ReplayEvent } from './round'
import type { ReplayRound } from '../replay/types'

type Parsing =
  | { status: 'active' }
  | { status: 'complete' }
  | { status: 'cancelled' }
  | { status: 'failed'; message: string }

export type ImportState =
  | { status: 'empty' }
  | { status: 'reading'; filename: string }
  | { status: 'cancelled'; filename: string }
  | {
      status: 'ready'
      filename: string
      metadata: DemoMetadata
      roundStartTicks: number[]
      discoveredRound: Extract<ReplayEvent, { type: 'round-start' }> | undefined
      rounds: ReplayRound[]
      selectedStartTick: number | undefined
      parsing: Parsing
    }
  | { status: 'error'; filename: string; message: string }

export type ImportAction =
  | ImportEvent
  | { type: 'start'; filename: string }
  | { type: 'cancel' }
  | { type: 'failed'; message: string }
  | { type: 'select-round'; startTick: number }

export function updateImport(state: ImportState, action: ImportAction): ImportState {
  switch (action.type) {
    case 'start':
      return { status: 'reading', filename: action.filename }
    case 'cancel':
      if (state.status === 'reading') return { status: 'cancelled', filename: state.filename }
      return state.status === 'ready' && state.parsing.status === 'active'
        ? { ...state, parsing: { status: 'cancelled' }, discoveredRound: undefined }
        : state
    case 'metadata':
      if (state.status !== 'reading') return state
      return {
        status: 'ready',
        filename: state.filename,
        metadata: action.metadata,
        roundStartTicks: action.roundStartTicks,
        rounds: [],
        selectedStartTick: undefined,
        discoveredRound: undefined,
        parsing: { status: 'active' },
      }
    case 'reset':
      return state.status === 'ready'
        ? {
            ...state,
            rounds: [],
            selectedStartTick: undefined,
            discoveredRound: undefined,
            roundStartTicks: [],
          }
        : state
    case 'select-round':
      return state.status === 'ready' &&
        state.rounds.some((round) => round.startTick === action.startTick)
        ? { ...state, selectedStartTick: action.startTick }
        : state
    case 'round-start':
      return state.status === 'ready' ? { ...state, discoveredRound: action } : state
    case 'round':
      return state.status === 'ready'
        ? {
            ...state,
            rounds: [...state.rounds, action.round],
            discoveredRound: undefined,
            selectedStartTick: state.selectedStartTick ?? action.round.startTick,
          }
        : state
    case 'complete':
      return state.status === 'ready'
        ? { ...state, parsing: { status: 'complete' }, discoveredRound: undefined }
        : state
    case 'failed':
      if (state.status === 'ready')
        return {
          ...state,
          parsing: { status: 'failed', message: action.message },
          discoveredRound: undefined,
        }
      return state.status === 'reading'
        ? { status: 'error', filename: state.filename, message: action.message }
        : state
  }
}
