import { Deferred, Effect, Fiber } from 'effect'
import { afterEach, expect, test, vi } from 'vitest'
import { importDemo } from './import'
import type { ImportResult } from './import'
import type { DemoMetadata } from './metadata'

const metadata: DemoMetadata = {
  mapName: 'de_dust2',
  serverName: 'BLAST Premier 2024',
  clientName: null,
  gameDirectory: null,
  demoVersion: null,
  patchVersion: null,
  buildNumber: null,
  serverStartTick: null,
  durationSeconds: 3078.25,
  playbackTicks: null,
  playbackFrames: null,
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
  vi.restoreAllMocks()
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

function expectReleased(worker: ControlledWorker) {
  expect(worker.terminated).toBe(true)
  expect(worker.onmessage).toBeNull()
  expect(worker.onerror).toBeNull()
  expect(worker.onmessageerror).toBeNull()
}

test('returns worker metadata and releases its listeners and worker', async () => {
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const { fiber, worker } = yield* start()
      worker.reply({ type: 'ready', metadata })
      const result = yield* Fiber.join(fiber)
      expectReleased(worker)
      return result
    }),
  )
  expect(result).toMatchObject({ mapName: 'de_dust2', durationSeconds: 3078.25 })
})

test('returns an actionable worker failure and releases resources', async () => {
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const { fiber, worker } = yield* start()
      worker.reply({ type: 'error', message: 'The demo is truncated. Download it again.' })
      const result = yield* Effect.either(Fiber.join(fiber))
      expectReleased(worker)
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
      expectReleased(worker)
    }),
  )
})

test('reports worker construction failure', async () => {
  vi.stubGlobal(
    'Worker',
    class {
      constructor() {
        throw new Error('Worker unavailable')
      }
    },
  )
  const result = await Effect.runPromise(Effect.either(importDemo(new File(['demo'], 'match.dem'))))
  expect(result).toMatchObject({
    _tag: 'Left',
    left: {
      _tag: 'DemoImportError',
      message: 'The demo reader could not start. Reload the page and try again.',
    },
  })
})

test('reports a file transfer failure and releases the worker', async () => {
  vi.stubGlobal('Worker', ControlledWorker)
  vi.spyOn(ControlledWorker.prototype, 'postMessage').mockImplementation(() => {
    throw new Error('DataCloneError')
  })
  const result = await Effect.runPromise(Effect.either(importDemo(new File(['demo'], 'match.dem'))))
  expect(result).toMatchObject({
    _tag: 'Left',
    left: {
      _tag: 'DemoImportError',
      message: 'The demo could not be sent to the local reader. Try importing it again.',
    },
  })
  expectReleased(ControlledWorker.current)
})

test.each(['onerror', 'onmessageerror'] as const)(
  '%s reports a reader failure and releases resources',
  async (event) => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const { fiber, worker } = yield* start()
        worker[event]?.()
        const result = yield* Effect.either(Fiber.join(fiber))
        expectReleased(worker)
        return result
      }),
    )
    expect(result).toMatchObject({
      _tag: 'Left',
      left: {
        _tag: 'DemoImportError',
        message: 'The demo reader stopped unexpectedly. Try importing the file again.',
      },
    })
  },
)
