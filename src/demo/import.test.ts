import { Deferred, Effect, Fiber, Stream } from 'effect'
import { afterEach, expect, test, vi } from 'vitest'
import { importDemo, type ImportEvent, type ImportResult } from './import'
import type { DemoMetadata } from './metadata'
import { updateImport, type ImportState } from './session'

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
  overtime: 0,
  resultTick: 538,
  startTick: 537,
  liveStartTick: 538,
  endTick: 538,
  tickInterval: 0.015625,
  players: [{ name: 'broky', steamId: '76561198201620490' }],
  ticks: new Uint32Array([537, 538]),
  positions: new Float32Array([-760.663, -836.174, 117.072, -761, -836, 117]),
  alive: new Uint8Array([1, 1]),
  deaths: [],
  health: new Int32Array([100, 100]),
  yaw: new Float32Array([90, 90]),
  teams: new Uint8Array([2, 2]),
}

const secondRound = {
  ...firstRound,
  number: 2,
  resultTick: 540,
  startTick: 539,
  liveStartTick: 540,
  endTick: 540,
  ticks: new Uint32Array([539, 540]),
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
    const events: ImportEvent[] = []
    const receivedRound = yield* Deferred.make<void>()
    const fiber = yield* Effect.fork(
      Stream.runForEach(importDemo(new File(['demo'], 'match.dem')), (event) =>
        Effect.gen(function* () {
          events.push(event)
          if (event.type === 'round') yield* Deferred.succeed(receivedRound, undefined)
        }),
      ),
    )
    yield* Deferred.await(ControlledWorker.started)
    return { fiber, worker: ControlledWorker.current, events, receivedRound }
  })
}

test('delivers a playable round before completion and releases the finished worker', async () => {
  const events = await Effect.runPromise(
    Effect.gen(function* () {
      const { fiber, worker, events, receivedRound } = yield* start()
      worker.reply({ type: 'metadata', metadata, roundStartTicks: [] })
      worker.reply({ type: 'round-start', number: 1, startTick: 449 })
      worker.reply({ type: 'round-start', number: 1, startTick: 537 })
      worker.reply({ type: 'round', round: firstRound })
      yield* Deferred.await(receivedRound)
      expect(events).toEqual([
        { type: 'metadata', metadata, roundStartTicks: [] },
        { type: 'round-start', number: 1, startTick: 449 },
        { type: 'round-start', number: 1, startTick: 537 },
        { type: 'round', round: firstRound },
      ])
      const initial: ImportState = { status: 'reading', filename: 'match.dem' }
      expect(events.slice(0, 3).reduce<ImportState>(updateImport, initial)).toMatchObject({
        discoveredRound: { number: 1, startTick: 537 },
        rounds: [],
      })
      expect(events.reduce<ImportState>(updateImport, initial)).toMatchObject({
        discoveredRound: undefined,
        rounds: [firstRound],
      })
      expect(worker.terminated).toBe(false)
      worker.reply({ type: 'round', round: secondRound })
      worker.reply({ type: 'complete' })
      yield* Fiber.join(fiber)
      expect(worker.terminated).toBe(true)
      return events
    }),
  )
  expect(events).toEqual([
    { type: 'metadata', metadata, roundStartTicks: [] },
    { type: 'round-start', number: 1, startTick: 449 },
    { type: 'round-start', number: 1, startTick: 537 },
    { type: 'round', round: firstRound },
    { type: 'round', round: secondRound },
    { type: 'complete' },
  ])
})

test('retains a completed round after failure and releases the worker', async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const { fiber, worker, events, receivedRound } = yield* start()
      worker.reply({ type: 'metadata', metadata, roundStartTicks: [] })
      worker.reply({ type: 'round', round: firstRound })
      yield* Deferred.await(receivedRound)
      worker.reply({ type: 'error', message: 'The demo is truncated. Download it again.' })
      const result = yield* Effect.either(Fiber.join(fiber))
      expect(worker.terminated).toBe(true)
      expect(result).toMatchObject({
        _tag: 'Left',
        left: { _tag: 'DemoImportError', message: 'The demo is truncated. Download it again.' },
      })
      const initial: ImportState = { status: 'reading', filename: 'match.dem' }
      const state = events.reduce<ImportState>(updateImport, initial)
      expect(
        updateImport(state, {
          type: 'failed',
          message: 'The demo is truncated. Download it again.',
        }),
      ).toEqual({
        status: 'ready',
        filename: 'match.dem',
        metadata,
        roundStartTicks: [],
        discoveredRound: undefined,
        rounds: [firstRound],
        selectedStartTick: 537,
        parsing: { status: 'failed', message: 'The demo is truncated. Download it again.' },
      })
    }),
  )
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
