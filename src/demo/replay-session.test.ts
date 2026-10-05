import { afterEach, expect, test, vi } from 'vitest'
import type { ReplayRound } from '../replay/types'
import type { ImportResult } from './import'
import type { DemoMetadata } from './metadata'
import { ReplaySession } from './replay-session'
import { defaultExampleId, examples } from './examples'

const metadata: DemoMetadata = {
  mapName: 'de_dust2',
  serverName: 'Test server',
  clientName: 'SourceTV Demo',
  gameDirectory: 'csgo',
  demoVersion: 'valve_demo_2',
  patchVersion: 14011,
  buildNumber: 10072,
  durationSeconds: 1,
  playbackTicks: 64,
  playbackFrames: 64,
}

const round: ReplayRound = {
  number: 1,
  overtime: 0,
  startTick: 1,
  liveStartTick: 2,
  resultTick: 64,
  endTick: 64,
  tickInterval: 0.015625,
  players: [],
  ticks: new Uint32Array([1, 64]),
  positions: new Float32Array(),
  alive: new Uint8Array(),
  health: new Int32Array(),
  yaw: new Float32Array(),
  teams: new Uint8Array(),
  inspection: [],
  bomb: [],
  fires: [],
  shots: [],
  smokes: [],
  projectiles: [],
  detonations: [],
  bombEvents: [],
  deaths: [],
}

class ControlledWorker {
  static instances: ControlledWorker[] = []
  onmessage: ((event: MessageEvent<ImportResult>) => void) | null = null
  onerror: (() => void) | null = null
  onmessageerror: (() => void) | null = null
  terminated = false

  constructor() {
    ControlledWorker.instances.push(this)
  }

  postMessage() {}

  terminate() {
    this.terminated = true
  }

  reply(result: ImportResult) {
    this.onmessage?.(new MessageEvent('message', { data: result }))
  }
}

afterEach(() => {
  ControlledWorker.instances = []
  vi.unstubAllGlobals()
})

test('clears parsed results and notifies existing subscribers during the next import', async () => {
  vi.stubGlobal('Worker', ControlledWorker)
  const replay = new ReplaySession()
  const snapshots: ReturnType<ReplaySession['getSnapshot']>[] = []
  const unsubscribe = replay.subscribe(() => snapshots.push(replay.getSnapshot()))

  try {
    replay.openFile(new File(['demo'], 'match.dem'))
    await vi.waitFor(() => expect(ControlledWorker.instances).toHaveLength(1))
    const worker = ControlledWorker.instances[0]!
    worker.reply({ type: 'metadata', metadata, roundStartTicks: [1] })
    worker.reply({ type: 'round', round })
    worker.reply({ type: 'complete' })
    await vi.waitFor(() =>
      expect(replay.getSnapshot()).toMatchObject({
        source: { kind: 'local' },
        state: { status: 'ready', metadata, rounds: [round], parsing: { status: 'complete' } },
      }),
    )
    replay.selectRound(2)

    replay.clear()

    expect(replay.getSnapshot()).toEqual({ state: { status: 'empty' }, source: undefined })
    expect(snapshots.at(-1)).toEqual({ state: { status: 'empty' }, source: undefined })
    expect(replay.openFile(new File(['next demo'], 'next.dem'))).toBeUndefined()
    expect(snapshots.at(-1)).toEqual({
      state: { status: 'reading', filename: 'next.dem' },
      source: { kind: 'local' },
    })
    await vi.waitFor(() => expect(ControlledWorker.instances).toHaveLength(2))
    ControlledWorker.instances[1]!.reply({ type: 'metadata', metadata, roundStartTicks: [] })
    await vi.waitFor(() =>
      expect(snapshots.at(-1)).toMatchObject({
        state: { status: 'ready', filename: 'next.dem', metadata },
      }),
    )
  } finally {
    unsubscribe()
    replay.dispose()
  }
})

test('clearing an active import terminates its worker and ignores queued results', async () => {
  vi.stubGlobal('Worker', ControlledWorker)
  const replay = new ReplaySession()

  try {
    replay.openFile(new File(['demo'], 'match.dem'))
    await vi.waitFor(() => expect(ControlledWorker.instances).toHaveLength(1))
    const worker = ControlledWorker.instances[0]!
    const reply = worker.onmessage!
    worker.reply({ type: 'metadata', metadata, roundStartTicks: [] })
    await vi.waitFor(() => expect(replay.getSnapshot().state.status).toBe('ready'))

    replay.clear()
    reply(new MessageEvent('message', { data: { type: 'round', round } }))
    reply(new MessageEvent('message', { data: { type: 'complete' } }))

    await vi.waitFor(() => expect(worker.terminated).toBe(true))
    expect(replay.getSnapshot()).toEqual({ state: { status: 'empty' }, source: undefined })
  } finally {
    replay.dispose()
  }
})

test('restoring the same example retains its import and switching identity aborts it', async () => {
  const requests: { url: string; signal: AbortSignal }[] = []
  vi.stubGlobal('fetch', (url: string, options: { signal: AbortSignal }) => {
    requests.push({ url, signal: options.signal })
    return new Promise<Response>((_resolve, reject) => {
      options.signal.addEventListener('abort', () =>
        reject(new DOMException('Aborted', 'AbortError')),
      )
    })
  })
  const replay = new ReplaySession()
  const second = 'faze-vs-natus-vincere-m1-ancient'

  try {
    replay.restore('example', 1, defaultExampleId)
    await vi.waitFor(() => expect(requests).toHaveLength(1))
    expect(requests[0]!.url).toBe('/example/manifest.json')
    const originalState = replay.getSnapshot().state

    replay.restore('example', 2, defaultExampleId)

    expect(replay.getSnapshot().state).toBe(originalState)
    expect(requests).toHaveLength(1)
    expect(requests[0]!.signal.aborted).toBe(false)

    replay.restore('example', 1, second)

    await vi.waitFor(() => expect(requests).toHaveLength(2))
    expect(requests[0]!.signal.aborted).toBe(true)
    expect(requests[1]!.signal.aborted).toBe(false)
    expect(requests[1]!.url).toBe('/examples/faze-vs-natus-vincere-m1-ancient/manifest.json')
    expect(replay.getSnapshot()).toEqual({
      source: { kind: 'example', id: second },
      state: { status: 'reading', filename: examples[second].filename },
    })
  } finally {
    replay.dispose()
  }
  await vi.waitFor(() => expect(requests[1]!.signal.aborted).toBe(true))
})
