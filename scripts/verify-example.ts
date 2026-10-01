import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { Effect, Schema } from 'effect'
import { ExampleManifest } from '../src/demo/example.ts'
import { decodeRound } from '../src/demo/replay-codec.ts'
import { recordAtTick } from '../src/replay/frames.ts'

const Reference = Schema.Struct({
  rounds: Schema.Array(
    Schema.Struct({
      number: Schema.Number,
      overtime: Schema.Number,
      startTick: Schema.Number,
      liveStartTick: Schema.Number,
      resultTick: Schema.Number,
      endTick: Schema.Number,
    }),
  ),
  deaths: Schema.Array(
    Schema.Struct({
      round: Schema.Number,
      tick: Schema.Number,
      victim: Schema.String,
      killer: Schema.String,
      world: Schema.Boolean,
    }),
  ),
  plants: Schema.Array(
    Schema.Struct({
      round: Schema.Number,
      tick: Schema.Number,
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number,
    }),
  ),
})
const reference = Schema.decodeUnknownSync(Reference)(
  JSON.parse(await readFile('fixtures/maps-reference/faze-vs-vitality-m2-dust2.json', 'utf8')),
)
await Effect.runPromise(
  Effect.gen(function* () {
    const manifest = yield* Schema.decodeUnknown(ExampleManifest)(
      JSON.parse(yield* Effect.promise(() => readFile('public/example/manifest.json', 'utf8'))),
    )
    assert.deepEqual(
      manifest.rounds.map(({ number, startTick }) => ({ number, startTick })),
      reference.rounds.map(({ number, startTick }) => ({ number, startTick })),
    )
    for (const descriptor of manifest.rounds) {
      const compressed = yield* Effect.promise(() => readFile(`public/example/${descriptor.path}`))
      assert.equal(compressed.byteLength, descriptor.compressedBytes)
      const decoded = new Uint8Array(gunzipSync(compressed))
      assert.equal(decoded.byteLength, descriptor.decodedBytes)
      assert.equal(createHash('sha256').update(decoded).digest('hex'), descriptor.sha256)
      const round = decodeRound(decoded.buffer)
      assert.equal(round.number, descriptor.number)
      assert.equal(round.startTick, descriptor.startTick)
      const expected = reference.rounds.find((value) => value.number === round.number)
      assert.ok(expected, `Missing reference round ${round.number}`)
      for (const key of [
        'number',
        'overtime',
        'startTick',
        'liveStartTick',
        'resultTick',
        'endTick',
      ] as const)
        assert.equal(round[key], expected[key])
      assert.deepEqual(
        round.deaths.map(({ tick, victim, killer }) => ({
          tick,
          victim,
          killer: killer.type === 'world' ? '' : killer.steamId,
          world: killer.type === 'world',
        })),
        reference.deaths
          .filter((value) => value.round === round.number)
          .map(({ tick, victim, killer, world }) => ({ tick, victim, killer, world })),
      )
      for (const plant of reference.plants.filter((value) => value.round === round.number)) {
        const bomb = recordAtTick(round.bomb, plant.tick).state
        assert.ok(bomb.type === 'planted')
        for (const axis of ['x', 'y', 'z'] as const)
          assert.ok(Math.abs(bomb[axis] - plant[axis]) < 0.02)
      }
    }
    console.log(
      `Verified ${manifest.rounds.length} shipped rounds against independent boundaries, deaths and planted bomb positions.`,
    )
  }),
)
