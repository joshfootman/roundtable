import { recordAtTick } from '../src/replay/frames.ts'
import { replayBuffers } from '../src/replay/buffers.ts'
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

const expectedDetonations = JSON.parse(
  await readFile(new URL('../fixtures/replay/detonations.json', import.meta.url), 'utf8'),
)
const expectedProjectiles = JSON.parse(
  await readFile(new URL('../fixtures/replay/projectile-lifetimes.json', import.meta.url), 'utf8'),
)

const expectedFlashes = JSON.parse(
  await readFile(new URL('../fixtures/replay/flashes.json', import.meta.url), 'utf8'),
) as { tick: number; players: unknown[] }[]
const expectedShots = JSON.parse(
  await readFile(new URL('../fixtures/replay/shots.json', import.meta.url), 'utf8'),
)
const expectedFires = JSON.parse(
  await readFile(new URL('../fixtures/replay/fires.json', import.meta.url), 'utf8'),
)
const expectedSmokes = JSON.parse(
  await readFile(new URL('../fixtures/replay/smokes.json', import.meta.url), 'utf8'),
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
      const shots: unknown[] = []
      const fires: unknown[] = []
      const smokes: unknown[] = []
      const detonations: unknown[] = []
      const projectiles: unknown[] = []
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
            shots.length = 0
            fires.length = 0
            smokes.length = 0
            detonations.length = 0
            projectiles.length = 0
          } else {
            const { number, startTick, liveStartTick, resultTick, endTick, overtime } = event.round
            bufferBytes += replayBuffers(event.round).reduce(
              (bytes, buffer) => bytes + buffer.byteLength,
              0,
            )
            for (const frame of expectedFlashes.filter(
              (frame) => startTick <= frame.tick && frame.tick < endTick,
            )) {
              assert.deepEqual(
                event.round.players.map((player, index) => ({
                  steamId: player.steamId,
                  flash: recordAtTick(event.round.inspection[index]!, frame.tick).flash,
                })),
                frame.players,
              )
            }
            shots.push(...event.round.shots.map((shot) => ({ ...shot, round: number })))
            if (number <= 4)
              fires.push(
                ...event.round.fires.filter((frame) => frame.tick !== event.round.startTick),
              )
            smokes.push(...event.round.smokes.map((smoke) => ({ ...smoke, round: number })))
            detonations.push(
              ...event.round.detonations.map((event) => ({ ...event, round: number })),
            )
            projectiles.push(
              ...event.round.projectiles.map(({ entity, kind, thrower, startTick, endTick }) => ({
                entity,
                kind,
                thrower,
                startTick,
                endTick,
                round: number,
              })),
            )
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
      assert.deepEqual(shots, expectedShots)
      assert.deepEqual(fires, expectedFires)
      assert.deepEqual(smokes, expectedSmokes)
      assert.deepEqual(detonations, expectedDetonations)
      assert.deepEqual(projectiles, expectedProjectiles)
      assert.deepEqual(discovered, [
        { number: 1, startTick: 449 },
        ...expected.map(({ number, startTick }) => ({ number, startTick })),
      ])
      console.log(
        `Verified ${completed.length} completed rounds against the independent boundary oracle. Published buffers use ${bufferBytes.toLocaleString('en-GB')} bytes. All ${bombEvents.length} bomb interactions, ${projectiles.length} projectile lifetimes and ${detonations.length} detonations match. Inspection uses ${inspectionRecords.toLocaleString('en-GB')} sparse records.`,
      )
    }),
  ),
)
