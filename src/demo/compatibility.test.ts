import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { Effect } from 'effect'
import { create, toBinary } from '@bufbuild/protobuf'
import { createEntityDecoder } from './entities/index'
import { CMsgPlayerInfoSchema } from './generated/roster_pb'
import { CDemoStringTablesSchema } from './generated/demo_pb'
import { expect, test } from 'vitest'
import { readDemo } from './demo'

test('replays a 2026 recording through movement and a world death', async () => {
  const bytes = gunzipSync(readFileSync('fixtures/replay/anubis-2026-first-round.dem.gz'))
  const demo = await Effect.runPromise(
    readDemo({
      size: bytes.length,
      readRange: (offset, length) => Effect.succeed(bytes.subarray(offset, offset + length)),
    }),
  )
  expect(demo.metadata.mapName).toBe('de_anubis')
  const round = demo.firstRound
  expect({ startTick: round.startTick, endTick: round.endTick }).toEqual({
    startTick: 367,
    endTick: 14584,
  })
  const player = round.players.findIndex((entry) => entry.steamId === '76561198113666193')
  expect(round.players[player]).toEqual({ steamId: '76561198113666193', name: 'ZywOo' })
  const frame = round.ticks.indexOf(12000)
  expect(frame).not.toBe(-1)
  const state = frame * round.players.length + player
  expect(Array.from(round.positions.subarray(state * 3, state * 3 + 3))).toEqual([
    -365.5789794921875, 1090.6124267578125, 60.03125,
  ])
  expect(round.health[state]).toBe(100)
  expect(round.teams[state]).toBe(3)
  expect(round.yaw[state]).toBeCloseTo(170.91464, 3)
  expect(round.deaths.filter((death) => death.killer.type === 'world')).toEqual([
    { tick: 14525, victim: '76561198359519930', killer: { type: 'world' }, headshot: false },
  ])
})

test('distinguishes a recorded player with user ID zero from world damage', () => {
  const entities = createEntityDecoder()
  expect(entities.killerByUserId(0)).toEqual({ type: 'world' })
  entities.tables(
    create(CDemoStringTablesSchema, {
      tables: [
        {
          tableName: 'userinfo',
          items: [
            {
              str: '0',
              data: toBinary(
                CMsgPlayerInfoSchema,
                create(CMsgPlayerInfoSchema, { userid: 0, xuid: 76561197978835160n }),
              ),
            },
          ],
        },
      ],
    }),
  )
  expect(entities.killerByUserId(0)).toEqual({ type: 'player', steamId: '76561197978835160' })
  expect(entities.killerByUserId(65535)).toEqual({ type: 'world' })
  expect(() => entities.killerByUserId(17)).toThrow('A replay event refers to an unknown player.')
})
