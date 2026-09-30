import type { DemoMetadata } from './metadata'
import type { ImportEvent } from './import'
import type { ReplayRound } from '../replay/types'

type Parsing = { status: 'active' } | { status: 'complete' } | { status: 'failed'; message: string }

export type ImportState =
  | { status: 'empty' }
  | { status: 'reading'; filename: string }
  | {
      status: 'ready'
      filename: string
      metadata: DemoMetadata
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
        rounds: [],
        parsing: { status: 'active' },
      }
    case 'round':
      return state.status === 'ready'
        ? { ...state, rounds: [...state.rounds, action.round] }
        : state
    case 'complete':
      return state.status === 'ready' ? { ...state, parsing: { status: 'complete' } } : state
    case 'failed':
      if (state.status === 'ready')
        return { ...state, parsing: { status: 'failed', message: action.message } }
      return state.status === 'reading'
        ? { status: 'error', filename: state.filename, message: action.message }
        : state
  }
}
