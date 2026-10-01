import assert from 'node:assert/strict'
import { open, readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { Effect, Schema, Stream } from 'effect'
import { DemoReadError, readDemoMetadata } from '../src/demo/metadata.ts'
import { readRounds } from '../src/demo/round.ts'
import { recordAtTick } from '../src/replay/frames.ts'
import type { ReplayRound } from '../src/replay/types.ts'

const Sample = Schema.Struct({
  tick: Schema.Number,
  players: Schema.Array(
    Schema.Struct({
      steamId: Schema.String,
      name: Schema.String,
      team: Schema.Number,
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number,
      yaw: Schema.Number,
    }),
  ),
})
const Reference = Schema.Struct({
  mapName: Schema.String,
  rounds: Schema.NonEmptyArray(
    Schema.Struct({
      number: Schema.Number,
      overtime: Schema.Number,
      startTick: Schema.Number,
      liveStartTick: Schema.Number,
      resultTick: Schema.Number,
      endTick: Schema.Number,
      start: Schema.optional(Sample),
      live: Schema.optional(Sample),
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

function verifySample(round: ReplayRound, expected: Schema.Schema.Type<typeof Sample>) {
  const frame = round.ticks.indexOf(expected.tick)
  assert.notEqual(frame, -1, `Missing recorded tick ${expected.tick}`)
  assert.deepEqual(
    round.players,
    expected.players.map(({ steamId, name }) => ({ steamId, name })),
  )
  for (let player = 0; player < expected.players.length; player++) {
    const value = expected.players[player]!
    const state = frame * round.players.length + player
    assert.equal(round.teams[state], value.team)
    for (const [axis, position] of [value.x, value.y, value.z].entries())
      assert.ok(
        Math.abs(round.positions[state * 3 + axis]! - position) < 0.02,
        `${value.name} axis ${axis} at tick ${expected.tick}`,
      )
    assert.ok(Math.abs(round.yaw[state]! - value.yaw) < 0.002, `${value.name} facing`)
  }
}

const paths = process.argv.slice(2)
if (paths.length === 0)
  throw new Error('Pass one or more local .dem paths with committed map references.')

for (const path of paths) {
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const io = <T>(run: () => Promise<T>) =>
          Effect.tryPromise({
            try: run,
            catch: (error) => new DemoReadError({ message: String(error) }),
          })
        const contents = yield* io(() =>
          readFile(`fixtures/maps-reference/${basename(path, '.dem')}.json`, 'utf8'),
        )
        const json: unknown = yield* Effect.try(() => JSON.parse(contents))
        const reference = yield* Schema.decodeUnknown(Reference)(json)
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
        const metadata = yield* readDemoMetadata(source)
        assert.equal(metadata.mapName, reference.mapName)
        let completed = 0
        yield* readRounds(source).pipe(
          Stream.runForEach((round) =>
            Effect.sync(() => {
              const expected = reference.rounds[completed++]
              assert.ok(expected, `Unexpected round ${round.number}`)
              const { start, live, ...boundaries } = expected
              assert.deepEqual(
                {
                  number: round.number,
                  overtime: round.overtime,
                  startTick: round.startTick,
                  liveStartTick: round.liveStartTick,
                  resultTick: round.resultTick,
                  endTick: round.endTick,
                },
                boundaries,
              )
              if (completed === 1) {
                assert.ok(
                  start && live,
                  'The reference must contain first-round start and live samples.',
                )
                verifySample(round, start)
                verifySample(round, live)
              }
              assert.deepEqual(
                round.deaths.map(({ tick, victim, killer }) => ({
                  tick,
                  victim,
                  killer: killer.type === 'world' ? '' : killer.steamId,
                  world: killer.type === 'world',
                })),
                reference.deaths
                  .filter((death) => death.round === round.number)
                  .map(({ tick, victim, killer, world }) => ({ tick, victim, killer, world })),
              )
              for (const plant of reference.plants.filter(
                (plant) => plant.round === round.number,
              )) {
                const bomb = recordAtTick(round.bomb, plant.tick).state
                assert.ok(bomb.type === 'planted', 'Missing recorded planted bomb.')
                for (const axis of ['x', 'y', 'z'] as const)
                  assert.ok(
                    Math.abs(bomb[axis] - plant[axis]) < 0.02,
                    `Round ${round.number} planted bomb ${axis} at tick ${plant.tick}`,
                  )
              }
            }),
          ),
        )
        assert.equal(completed, reference.rounds.length)
        console.log(JSON.stringify({ path, map: metadata.mapName, verifiedRounds: completed }))
      }),
    ),
  )
}
