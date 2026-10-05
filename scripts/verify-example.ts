import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { Schema } from 'effect'
import { basename } from 'node:path'
import { defaultExampleId, examples, parseExampleId } from '../src/demo/examples.ts'
import type { ExampleId } from '../src/demo/examples.ts'
import { ExampleManifest } from '../src/demo/example.ts'
import { decodeRound } from '../src/demo/replay-codec.ts'
import { recordAtTick } from '../src/replay/frames.ts'

const Reference = Schema.Struct({
  mapName: Schema.NonEmptyString,
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
const selection = process.argv[2] ?? defaultExampleId
const id = parseExampleId(basename(selection).replace(/\.dem$/, ''))
if (selection !== '--all' && id === undefined)
  throw new Error('Choose an accepted example ID or filename.')
const ids: ExampleId[] = selection === '--all' ? (Object.keys(examples) as ExampleId[]) : [id!]
let verifiedRounds = 0
for (const id of ids) {
  const example = examples[id]
  const directory = `public${example.assetBase}`
  const reference = Schema.decodeUnknownSync(Reference)(
    JSON.parse(await readFile(`fixtures/maps-reference/${id}.json`, 'utf8')),
  )
  const manifest = Schema.decodeUnknownSync(ExampleManifest)(
    JSON.parse(await readFile(`${directory}/manifest.json`, 'utf8')),
  )
  assert.equal(manifest.source.filename, example.filename)
  assert.equal(manifest.source.sha256, example.sourceSha256)
  assert.equal(manifest.source.match, example.sourceUrl)
  assert.equal(manifest.metadata.mapName, example.map)
  assert.equal(reference.mapName, example.map)
  assert.equal(manifest.rounds.length, example.roundCount)
  assert.deepEqual(
    manifest.rounds.map(({ number, startTick }) => ({ number, startTick })),
    reference.rounds.map(({ number, startTick }) => ({ number, startTick })),
  )
  for (const descriptor of manifest.rounds) {
    const compressed = await readFile(`${directory}/${descriptor.path}`)
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
  verifiedRounds += manifest.rounds.length
  console.log(
    `Verified ${id}, ${manifest.rounds.length} rounds against independent boundaries, deaths and planted bomb positions.`,
  )
}
console.log(`Verified ${ids.length} recordings and ${verifiedRounds} shipped rounds.`)
