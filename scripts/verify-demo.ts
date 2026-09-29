import assert from 'node:assert/strict'
import { open } from 'node:fs/promises'
import { Effect } from 'effect'
import { DemoReadError, readDemoMetadata } from '../src/demo/metadata.ts'

const path = process.argv[2] ?? 'fixtures/faze-vs-vitality-m2-dust2.dem'
let bytesRead = 0
let reads = 0
const job = Effect.scoped(
  Effect.gen(function* () {
    const file = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () => open(path, 'r'),
        catch: (error) => new DemoReadError({ message: String(error) }),
      }),
      (file) => Effect.promise(() => file.close()),
    )
    const stat = yield* Effect.tryPromise({
      try: () => file.stat(),
      catch: (error) => new DemoReadError({ message: String(error) }),
    })
    const metadata = yield* readDemoMetadata({
      size: stat.size,
      readRange: (offset, length) =>
        Effect.tryPromise({
          try: async () => {
            const buffer = new Uint8Array(length)
            const result = await file.read(buffer, 0, length, offset)
            bytesRead += result.bytesRead
            reads++
            return buffer.subarray(0, result.bytesRead)
          },
          catch: (error) => new DemoReadError({ message: String(error) }),
        }),
    })
    assert.deepEqual(metadata, {
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
    })
    assert.ok(bytesRead < 1024, `Metadata read budget exceeded: ${bytesRead} bytes`)
    console.log(JSON.stringify({ path, fileBytes: stat.size, bytesRead, reads, metadata }, null, 2))
  }),
)
await Effect.runPromise(job)
