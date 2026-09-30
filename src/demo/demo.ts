import { Effect } from 'effect'
import { readDemoMetadata, type DemoMetadata } from './metadata.ts'
import { readFirstRound } from './round.ts'
import type { DemoSource } from './source.ts'
import type { ReplayRound } from '../replay/types.ts'

export interface ImportedDemo {
  metadata: DemoMetadata
  firstRound: ReplayRound
}

export function readDemo(source: DemoSource) {
  return Effect.gen(function* () {
    const metadata = yield* readDemoMetadata(source)
    const firstRound = yield* readFirstRound(source)
    return { metadata, firstRound } satisfies ImportedDemo
  })
}
