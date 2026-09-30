import type { DemoMetadata } from './metadata'
import type { ImportEvent } from './import'
import type { ReplayEvent } from './round'
import type { ReplayRound } from '../replay/types'

type Parsing = { status: 'active' } | { status: 'complete' } | { status: 'failed'; message: string }

export type ImportState =
  | { status: 'empty' }
  | { status: 'reading'; filename: string }
  | {
      status: 'ready'
      filename: string
      metadata: DemoMetadata
      roundStartTicks: number[]
      discoveredRound: Extract<ReplayEvent, { type: 'round-start' }> | undefined
      rounds: ReplayRound[]
      parsing: Parsing
    }
  | { status: 'error'; filename: string; message: string }

export type ImportAction =
  | ImportEvent
  | { type: 'start'; filename: string }
  | { type: 'failed'; message: string }

export function updateImport(state: ImportState, action: ImportAction): ImportState {
  switch (action.type) {
    case 'start':
      return { status: 'reading', filename: action.filename }
    case 'metadata':
      if (state.status !== 'reading') return state
      return {
        status: 'ready',
        filename: state.filename,
        metadata: action.metadata,
        roundStartTicks: action.roundStartTicks,
        rounds: [],
        discoveredRound: undefined,
        parsing: { status: 'active' },
      }
    case 'round-start':
      return state.status === 'ready' ? { ...state, discoveredRound: action } : state
    case 'round':
      return state.status === 'ready'
        ? { ...state, rounds: [...state.rounds, action.round], discoveredRound: undefined }
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
