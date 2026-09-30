import { readFileSync } from 'node:fs'
import { create, toBinary } from '@bufbuild/protobuf'
import { Effect } from 'effect'
import { expect, test } from 'vitest'
import { CDemoPacketSchema } from './generated/demo_pb'
import { readDemo } from './demo'

const fixture = new Uint8Array(readFileSync('fixtures/roster/import.dem'))
const records = {
  header: fixture.slice(16, 182),
  identities: fixture.slice(182, 17042),
  descriptors: fixture.slice(17042, 25547),
  spawns: fixture.slice(25547, 43043),
  freezeEnd: fixture.slice(43043, 45178),
  info: fixture.slice(45178),
}
const players = [
  { name: 'apEX', steamId: '76561197989744167' },
  { name: 'broky', steamId: '76561198201620490' },
  { name: 'flameZ', steamId: '76561197978835160' },
  { name: 'frozen', steamId: '76561198068422762' },
  { name: 'karrigan', steamId: '76561197989430253' },
  { name: 'mezii', steamId: '76561197973140692' },
  { name: 'rain', steamId: '76561197997351207' },
  { name: 'ropz', steamId: '76561197991272318' },
  { name: 'Spinx', steamId: '76561198063336407' },
  { name: 'ZywOo', steamId: '76561198113666193' },
]

function parse(bytes: Uint8Array) {
  return Effect.runPromise(
    readDemo({
      size: bytes.length,
      readRange: (offset, length) => Effect.succeed(bytes.slice(offset, offset + length)),
    }),
  )
}

function container(parts: Uint8Array[]) {
  const bytes = new Uint8Array(16 + parts.reduce((size, part) => size + part.length, 0))
  bytes.set(fixture.slice(0, 16))
  new DataView(bytes.buffer).setUint32(8, bytes.length - records.info.length, true)
  let offset = 16
  for (const part of parts) {
    bytes.set(part, offset)
    offset += part.length
  }
  return bytes
}

test('imports the independently verified roster with bounded reads and exact Steam IDs', async () => {
  let bytesRead = 0
  let largestRead = 0
  const demo = await Effect.runPromise(
    readDemo({
      size: fixture.length,
      readRange: (offset, length) => {
        bytesRead += length
        largestRead = Math.max(largestRead, length)
        return Effect.succeed(fixture.slice(offset, offset + length))
      },
    }),
  )
  expect(demo.metadata).toEqual({
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
  expect([...demo.players].sort((a, b) => a.name.localeCompare(b.name, 'en'))).toEqual(players)
  expect(bytesRead).toBeLessThan(50_000)
  expect(largestRead).toBeLessThan(20_000)
})

test('keeps one identity across repeated spawn events', async () => {
  const demo = await parse(
    container([
      records.header,
      records.identities,
      records.descriptors,
      records.spawns,
      records.spawns,
      records.freezeEnd,
      records.info,
    ]),
  )
  expect([...demo.players].sort((a, b) => a.name.localeCompare(b.name, 'en'))).toEqual(players)
})

test('rejects missing participation data and truncated network messages', async () => {
  await expect(
    parse(container([records.header, records.identities, records.descriptors, records.info])),
  ).rejects.toThrow(/roster/i)
  const packet = toBinary(
    CDemoPacketSchema,
    create(CDemoPacketSchema, {
      data: new Uint8Array([255]),
    }),
  )
  const damaged = new Uint8Array([7, 1, packet.length, ...packet])
  await expect(
    parse(
      container([
        records.header,
        records.identities,
        records.descriptors,
        damaged,
        records.freezeEnd,
        records.info,
      ]),
    ),
  ).rejects.toThrow(/packet|network|truncated/i)
})
