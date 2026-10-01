import Dexie, { type Table } from 'dexie'
import { Schema } from 'effect'
import { ExampleManifest } from '../src/demo/example'
import { decodeRound } from '../src/demo/replay-codec'

interface CachedRound {
  number: number
  bytes: ArrayBuffer
}
interface ReadMeasurement {
  firstRoundMs: number
  allRoundsMs: number
  rounds: number
  transferredBytes: number
  encodedBodyBytes: number
}

export async function benchmarkCache() {
  const manifest = Schema.decodeUnknownSync(ExampleManifest)(
    await (await fetch('/example/manifest.json')).json(),
  )
  const database = new Dexie(`roundtable-benchmark-${crypto.randomUUID()}`)
  database.version(1).stores({ rounds: 'number' })
  const rounds: Table<CachedRound, number> = database.table('rounds')
  const estimateBefore = await navigator.storage.estimate()
  const encoded: CachedRound[] = []
  for (const descriptor of manifest.rounds) {
    const bytes = await (await fetch(`/example/${descriptor.path}`)).arrayBuffer()
    if (bytes.byteLength !== descriptor.compressedBytes) throw new Error('Incomplete asset.')
    encoded.push({ number: descriptor.number, bytes })
  }
  const read = async (load: (number: number, path: string) => Promise<ArrayBuffer>) => {
    performance.clearResourceTimings()
    const started = performance.now()
    let firstRoundMs = 0
    let count = 0
    for (const descriptor of manifest.rounds) {
      const encodedBytes = await load(descriptor.number, descriptor.path)
      const bytes = await new Response(
        new Blob([encodedBytes]).stream().pipeThrough(new DecompressionStream('gzip')),
      ).arrayBuffer()
      const round = decodeRound(bytes)
      if (round.number !== descriptor.number || round.startTick !== descriptor.startTick)
        throw new Error('Cached round does not match its descriptor.')
      if (round.number === 1 && (round.liveStartTick !== 5732 || round.endTick !== 8282))
        throw new Error('Opening round reference mismatch.')
      count++
      if (count === 1) firstRoundMs = performance.now() - started
    }
    const allRoundsMs = performance.now() - started
    await new Promise((resolve) => setTimeout(resolve, 0))
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    const replayResources = resources.filter(
      (resource) => resource.startTime >= started && resource.name.includes('/example/round-'),
    )
    return {
      firstRoundMs,
      allRoundsMs,
      rounds: count,
      transferredBytes: replayResources.reduce((total, entry) => total + entry.transferSize, 0),
      encodedBodyBytes: replayResources.reduce((total, entry) => total + entry.encodedBodySize, 0),
    }
  }
  try {
    const writeStarted = performance.now()
    await rounds.bulkPut(encoded)
    const writeMs = performance.now() - writeStarted
    const estimateAfter = await navigator.storage.estimate()
    const pairs: { http: ReadMeasurement; indexedDB: ReadMeasurement }[] = []
    for (let run = 0; run < 3; run++) {
      const http = () => read(async (_, path) => (await fetch(`/example/${path}`)).arrayBuffer())
      const indexedDB = () =>
        read(async (number) => {
          const cached = await rounds.get(number)
          if (!cached) throw new Error('Cached round is missing.')
          return cached.bytes
        })
      if (run % 2 === 0) pairs.push({ http: await http(), indexedDB: await indexedDB() })
      else {
        const cached = await indexedDB()
        pairs.push({ http: await http(), indexedDB: cached })
      }
    }
    let storageFailure = ''
    try {
      await database.transaction('rw', rounds, async (transaction) => {
        await rounds.put(encoded[0]!)
        transaction.abort()
      })
    } catch (error) {
      storageFailure = error instanceof Error ? error.name : String(error)
    }
    if (!storageFailure) throw new Error(`Storage failure was not observed (${storageFailure}).`)
    return {
      writeMs,
      encodedBytes: encoded.reduce((total, round) => total + round.bytes.byteLength, 0),
      estimateBefore,
      estimateAfter,
      pairs,
      storageFailure,
    }
  } finally {
    await database.delete()
  }
}
