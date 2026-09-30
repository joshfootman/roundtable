import { Deferred, Effect, Fiber } from 'effect'
import { afterEach, expect, test, vi } from 'vitest'
import { importDemo } from './import'
import type { ImportResult } from './import'
import type { DemoMetadata } from './metadata'

const metadata: DemoMetadata = {
  mapName: 'de_dust2',
  serverName: 'BLAST Premier 2024',
  clientName: 'SourceTV Demo',
  gameDirectory: '/home/csserver001/cs2/game/csgo',
  demoVersion: 'valve_demo_2',
  patchVersion: 14011,
  buildNumber: 10072,
  serverStartTick: 42184,
  durationSeconds: 3078.25,
  playbackTicks: 197008,
  playbackFrames: 197003,
}

const firstRound = {
  number: 1,
  startTick: 537,
  liveStartTick: 538,
  endTick: 538,
  tickInterval: 0.015625,
  players: [{ name: 'broky', steamId: '76561198201620490', team: 2 as const }],
  ticks: new Uint32Array([537, 538]),
  positions: new Float32Array([-760.663, -836.174, 117.072, -761, -836, 117]),
  alive: new Uint8Array([1, 1]),
}

class ControlledWorker {
  static current: ControlledWorker
  static started: Deferred.Deferred<void>
  onmessage: ((event: MessageEvent<ImportResult>) => void) | null = null
  onerror: (() => void) | null = null
  onmessageerror: (() => void) | null = null
  terminated = false
  constructor() {
    ControlledWorker.current = this
  }
  postMessage() {
    Effect.runSync(Deferred.succeed(ControlledWorker.started, undefined))
  }
  terminate() {
    this.terminated = true
  }
  reply(result: ImportResult) {
    this.onmessage?.(new MessageEvent('message', { data: result }))
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function start() {
  vi.stubGlobal('Worker', ControlledWorker)
  return Effect.gen(function* () {
    ControlledWorker.started = yield* Deferred.make<void>()
    const fiber = yield* Effect.fork(importDemo(new File(['demo'], 'match.dem')))
    yield* Deferred.await(ControlledWorker.started)
    return { fiber, worker: ControlledWorker.current }
  })
}

test('returns the completed replay and terminates its worker', async () => {
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const { fiber, worker } = yield* start()
      worker.reply({
        type: 'ready',
        demo: { metadata, firstRound },
      })
      const result = yield* Fiber.join(fiber)
      expect(worker.terminated).toBe(true)
      return result
    }),
  )
  expect(result).toEqual({
    metadata,
    firstRound,
  })
})

test('returns an actionable worker failure and releases resources', async () => {
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const { fiber, worker } = yield* start()
      worker.reply({ type: 'error', message: 'The demo is truncated. Download it again.' })
      const result = yield* Effect.either(Fiber.join(fiber))
      expect(worker.terminated).toBe(true)
      return result
    }),
  )
  expect(result).toMatchObject({
    _tag: 'Left',
    left: { _tag: 'DemoImportError', message: 'The demo is truncated. Download it again.' },
  })
})

test('interruption releases an unfinished import', async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const { fiber, worker } = yield* start()
      yield* Fiber.interrupt(fiber)
      expect(worker.terminated).toBe(true)
    }),
  )
})
