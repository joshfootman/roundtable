import { Effect } from 'effect'
import { readDemoMetadata, type DemoMetadata } from './metadata.ts'
import { readFirstRound } from './round.ts'
import type { DemoSource } from './source.ts'
import type { ReplayRound } from '../replay/types.ts'

export interface DemoPlayer {
  steamId: string
  name: string
}

export interface ImportedDemo {
  metadata: DemoMetadata
  players: DemoPlayer[]
  firstRound: ReplayRound
}

export function readDemo(source: DemoSource) {
  return Effect.gen(function* () {
    const metadata = yield* readDemoMetadata(source)
    const firstRound = yield* readFirstRound(source)
    const players = firstRound.players.map(({ steamId, name }) => ({ steamId, name }))
    return { metadata, players, firstRound } satisfies ImportedDemo
  })
}
