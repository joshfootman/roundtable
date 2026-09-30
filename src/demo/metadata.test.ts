import { readFileSync } from 'node:fs'
import { Effect } from 'effect'
import { clearField, create, fromBinary, toBinary } from '@bufbuild/protobuf'
import { CDemoFileHeaderSchema, CDemoFileInfoSchema } from './generated/demo_pb'
import { describe, expect, test } from 'vitest'
import { compress } from 'snappyjs'
import { readDemoMetadata, readRecordingInfo } from './metadata'

const fixture = new Uint8Array(readFileSync('fixtures/metadata/dust2-metadata.bin'))
const header = new Uint8Array(readFileSync('fixtures/metadata/header-record.bin'))
const info = new Uint8Array(readFileSync('fixtures/metadata/file-info-record.bin'))

function metadataEffect(bytes: Uint8Array) {
  return readDemoMetadata({
    size: bytes.length,
    readRange: (offset, length) => Effect.succeed(bytes.slice(offset, offset + length)),
  })
}
function parse(bytes: Uint8Array) {
  return Effect.runPromise(metadataEffect(bytes))
}
function classify(bytes: Uint8Array) {
  return Effect.runPromise(Effect.either(metadataEffect(bytes)))
}
function varint(value: number) {
  const bytes = []
  do {
    const byte = value % 128
    value = Math.floor(value / 128)
    bytes.push(byte | (value ? 128 : 0))
  } while (value)
  return bytes
}
function demo(headerRecord: Uint8Array, infoRecord?: Uint8Array) {
  const bytes = new Uint8Array(16 + headerRecord.length + (infoRecord?.length ?? 0))
  bytes.set([80, 66, 68, 69, 77, 83, 50, 0])
  new DataView(bytes.buffer).setUint32(8, infoRecord ? 16 + headerRecord.length : 0, true)
  bytes.set(headerRecord, 16)
  if (infoRecord) bytes.set(infoRecord, 16 + headerRecord.length)
  return bytes
}

test('rejects incomplete metadata and preserves explicitly recorded zero', async () => {
  await expect(parse(demo(header))).rejects.toThrow(/missing playback metadata/)
  const decoded = fromBinary(CDemoFileHeaderSchema, header.slice(8))
  clearField(decoded, CDemoFileHeaderSchema.field.mapName)
  const payload = toBinary(CDemoFileHeaderSchema, decoded)
  const missingMap = demo(new Uint8Array([1, 0, ...varint(payload.length), ...payload]), info)
  await expect(parse(missingMap)).rejects.toThrow(/missing required metadata \(map_name\)/)
  await expect(parse(demo(header, new Uint8Array([2, 0, 0])))).rejects.toThrow(
    /missing required metadata \(playback_time\)/,
  )
  decoded.mapName = ' '
  const blank = toBinary(CDemoFileHeaderSchema, decoded)
  await expect(
    parse(demo(new Uint8Array([1, 0, ...varint(blank.length), ...blank]), info)),
  ).rejects.toThrow(/empty required metadata/)
  await expect(
    parse(demo(header, new Uint8Array([2, 0, 9, 13, 0, 0, 0, 0, 16, 0, 24, 0]))),
  ).resolves.toMatchObject({
    mapName: 'de_dust2',
    durationSeconds: 0,
    playbackTicks: 0,
    playbackFrames: 0,
  })
})

describe('rejects malformed metadata', () => {
  const oversizedExpansion = compress(new Uint8Array(1048577))
  test.each([
    ['truncated container', fixture.slice(0, 8), /truncated/],
    [
      'negative playback time',
      demo(header, new Uint8Array([2, 0, 9, 13, 0, 0, 128, 191, 16, 0, 24, 0])),
      /invalid values/,
    ],
    ['overflowing varint', demo(new Uint8Array([255, 255, 255, 255, 16])), /invalid record number/],
    ['truncated payload', demo(new Uint8Array([1, 0, 100])), /truncated/],
    ['oversized payload', demo(new Uint8Array([1, 0, ...varint(1048577)])), /size limit/],
    [
      'oversized Snappy expansion',
      demo(new Uint8Array([65, 0, ...varint(oversizedExpansion.length), ...oversizedExpansion])),
      /compressed metadata/,
    ],
    ['damaged protobuf', demo(new Uint8Array([1, 0, 1, 255])), /header is damaged/],
  ])('%s', async (_name, bytes, message) => {
    await expect(parse(bytes)).rejects.toThrow(message)
  })
  test('rejects a file-info offset inside the header record', async () => {
    const bytes = fixture.slice()
    new DataView(bytes.buffer).setUint32(8, 17, true)
    await expect(parse(bytes)).rejects.toThrow(/offset/)
  })
})

test('reports short source reads as typed read failures', async () => {
  const shortRead = await Effect.runPromise(
    Effect.either(
      readDemoMetadata({
        size: fixture.length,
        readRange: () => Effect.succeed(new Uint8Array(0)),
      }),
    ),
  )
  expect(shortRead).toMatchObject({
    _tag: 'Left',
    left: {
      _tag: 'DemoReadError',
      message: 'The demo could not be read completely. Select it again.',
    },
  })
})

test('reads only metadata ranges from a large demo', async () => {
  const container = fixture.slice(0, 16)
  new DataView(container.buffer).setUint32(8, 598102484, true)
  new DataView(container.buffer).setUint32(12, 598096057, true)
  let bytesRead = 0
  const metadata = await Effect.runPromise(
    readDemoMetadata({
      size: 598102502,
      readRange: (offset, length) =>
        Effect.sync(() => {
          bytesRead += length
          const region = offset < 16 ? container : offset < 182 ? header : info
          const start = offset < 16 ? offset : offset < 182 ? offset - 16 : offset - 598102484
          return region.slice(start, start + length)
        }),
    }),
  )
  expect(metadata).toMatchObject({ mapName: 'de_dust2', durationSeconds: 3078.25 })
  expect(bytesRead).toBeLessThan(1024)
})

test.each([
  ['empty', [], 'empty'],
  ['unknown', [0], 'unknown-format'],
  ['Source 1', [72, 76, 50, 68, 69, 77, 79, 0], 'source1'],
])('classifies %s content', async (_name, content, reason) => {
  await expect(classify(new Uint8Array(content))).resolves.toMatchObject({
    _tag: 'Left',
    left: { _tag: 'DemoUnsupportedError', reason },
  })
})

function gameDemo(game: string, gameDirectory: string) {
  const decoded = fromBinary(CDemoFileHeaderSchema, header.slice(8))
  decoded.game = game
  decoded.gameDirectory = gameDirectory
  decoded.mapName = 'workshop_unknown_map'
  decoded.patchVersion = 1
  const payload = toBinary(CDemoFileHeaderSchema, decoded)
  return demo(new Uint8Array([1, 0, ...varint(payload.length), ...payload]), info)
}

test.each([
  ['dota', 'csgo'],
  ['', 'C:\\Games\\Citadel\\'],
])('rejects game %s in directory %s', async (game, directory) => {
  await expect(classify(gameDemo(game, directory))).resolves.toMatchObject({
    _tag: 'Left',
    left: { _tag: 'DemoUnsupportedError', reason: 'other-game' },
  })
})

test('accepts an explicit CS2 identifier regardless of directory, map or patch', async () => {
  await expect(parse(gameDemo('cs2', 'dota'))).resolves.toMatchObject({
    mapName: 'workshop_unknown_map',
    patchVersion: 1,
  })
})

test('reads an optional round-start index and rejects contradictory hints', async () => {
  const recording = async (roundStartTicks: number[]) => {
    const payload = toBinary(
      CDemoFileInfoSchema,
      create(CDemoFileInfoSchema, {
        playbackTime: 100,
        playbackTicks: 20000,
        playbackFrames: 20000,
        gameInfo: { cs: { roundStartTicks } },
      }),
    )
    const bytes = demo(header, new Uint8Array([2, 0, ...varint(payload.length), ...payload]))
    return Effect.runPromise(
      readRecordingInfo({
        size: bytes.length,
        readRange: (offset, length) => Effect.succeed(bytes.slice(offset, offset + length)),
      }),
    )
  }
  await expect(recording([537, 8282, 17370])).resolves.toMatchObject({
    metadata: { mapName: 'de_dust2', playbackTicks: 20000 },
    roundStartTicks: [537, 8282, 17370],
  })
  await expect(recording([])).resolves.toMatchObject({ roundStartTicks: [] })
  for (const ticks of [[-1], [20001], [537, 537], [8282, 537]]) {
    await expect(recording(ticks)).rejects.toThrow('round-start index is invalid')
  }
})
