import assert from 'node:assert/strict'
import { open, readFile } from 'node:fs/promises'
import { Effect, Stream } from 'effect'
import { DemoReadError } from '../src/demo/errors.ts'
import { readRounds } from '../src/demo/round.ts'
import { recordAtTick } from '../src/replay/frames.ts'
import type { DroppedItem } from '../src/replay/types.ts'

const path = process.argv[2] ?? 'fixtures/local/faze-vs-vitality-m2-dust2.dem'
const expected = JSON.parse(
  await readFile(new URL('../fixtures/replay/dropped-items.json', import.meta.url), 'utf8'),
) as { tick: number; items: DroppedItem[] }[]
const io = <T>(run: () => Promise<T>) =>
  Effect.tryPromise({ try: run, catch: (error) => new DemoReadError({ message: String(error) }) })

await Effect.runPromise(
  Effect.scoped(
    Effect.gen(function* () {
      const file = yield* Effect.acquireRelease(
        io(() => open(path, 'r')),
        (handle) => Effect.promise(() => handle.close()),
      )
      const { size } = yield* io(() => file.stat())
      const source = {
        size,
        readRange: (offset: number, length: number) =>
          io(async () => {
            const bytes = new Uint8Array(length)
            const { bytesRead } = await file.read(bytes, 0, length, offset)
            return bytes.subarray(0, bytesRead)
          }),
      }
      let checked = 0
      yield* readRounds(source).pipe(
        Stream.take(4),
        Stream.runForEach((round) =>
          Effect.sync(() => {
            for (const sample of expected) {
              if (sample.tick < round.startTick || sample.tick >= round.endTick) continue
              const actual = recordAtTick(round.droppedItems, sample.tick).items
              assert.equal(actual.length, sample.items.length, `Item count at tick ${sample.tick}`)
              for (const [index, item] of actual.entries()) {
                const reference = sample.items[index]!
                assert.deepEqual(
                  [item.entity, item.serial, item.definition],
                  [reference.entity, reference.serial, reference.definition],
                  `Item identity at tick ${sample.tick}`,
                )
                for (const axis of ['x', 'y', 'z'] as const)
                  assert.ok(
                    Math.abs(item[axis] - reference[axis]) < 0.05,
                    `Item ${item.entity} ${axis} at tick ${sample.tick}`,
                  )
              }
              checked++
            }
          }),
        ),
      )
      assert.equal(checked, expected.length, 'Every independent sample was checked')
      console.log(`Verified ${checked} dropped-item samples against demoinfocs-golang v4.5.1`)
    }),
  ),
)
