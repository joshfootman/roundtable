import assert from 'node:assert/strict'
import { open, readFile } from 'node:fs/promises'
import { Effect, Stream } from 'effect'
import { DemoReadError } from '../src/demo/errors.ts'
import { readReplay } from '../src/demo/round.ts'
import type { BombEvent } from '../src/replay/types.ts'

const path = process.argv[2] ?? 'fixtures/faze-vs-vitality-m2-dust2.dem'
const expected = JSON.parse(
  await readFile(new URL('../fixtures/replay/round-boundaries.json', import.meta.url), 'utf8'),
) as {
  number: number
  startTick: number
  liveStartTick: number
  resultTick: number
  endTick: number
  overtime: number
}[]

const expectedBombEvents = JSON.parse(
  await readFile(new URL('../fixtures/replay/bomb-events.json', import.meta.url), 'utf8'),
)

await Effect.runPromise(
  Effect.scoped(
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
      const source = {
        size: stat.size,
        readRange: (offset: number, length: number) =>
          Effect.tryPromise({
            try: async () => {
              const bytes = new Uint8Array(length)
              const { bytesRead } = await file.read(bytes, 0, length, offset)
              return bytes.subarray(0, bytesRead)
            },
            catch: (error) => new DemoReadError({ message: String(error) }),
          }),
      }
      let bufferBytes = 0
      let inspectionRecords = 0
      const bombEvents: (BombEvent & { round: number })[] = []
      const completed: typeof expected = []
      const discovered: { number: number; startTick: number }[] = []
      yield* Stream.runForEach(readReplay(source), (event) =>
        Effect.sync(() => {
          if (event.type === 'round-start') {
            discovered.push({ number: event.number, startTick: event.startTick })
          } else if (event.type === 'reset') {
            completed.length = 0
            bufferBytes = 0
            inspectionRecords = 0
            bombEvents.length = 0
          } else {
            const {
              number,
              startTick,
              liveStartTick,
              resultTick,
              endTick,
              overtime,
              ticks,
              positions,
              alive,
              health,
              yaw,
              teams,
            } = event.round
            bufferBytes +=
              ticks.byteLength +
              positions.byteLength +
              alive.byteLength +
              health.byteLength +
              yaw.byteLength +
              teams.byteLength
            bombEvents.push(...event.round.bombEvents.map((event) => ({ ...event, round: number })))
            inspectionRecords += event.round.inspection.reduce(
              (count, track) => count + track.length,
              0,
            )
            completed.push({ number, startTick, liveStartTick, resultTick, endTick, overtime })
          }
        }),
      )
      assert.deepEqual(completed, expected)
      assert.deepEqual(bombEvents, expectedBombEvents)
      assert.deepEqual(discovered, [
        { number: 1, startTick: 449 },
        ...expected.map(({ number, startTick }) => ({ number, startTick })),
      ])
      console.log(
        `Verified ${completed.length} completed rounds against the independent boundary oracle. Published buffers use ${bufferBytes.toLocaleString('en-GB')} bytes. All ${bombEvents.length} bomb interactions match. Inspection uses ${inspectionRecords.toLocaleString('en-GB')} sparse records.`,
      )
    }),
  ),
)
