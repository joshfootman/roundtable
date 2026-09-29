import { readFileSync } from 'node:fs'
import { Effect } from 'effect'
import { compress } from 'snappyjs'
import { describe, expect, test } from 'vitest'
import { DemoReadError, readDemoMetadata } from './metadata'

const fixture = new Uint8Array(readFileSync('fixtures/metadata/dust2-metadata.bin'))
const header = new Uint8Array(readFileSync('fixtures/metadata/header-record.bin'))
const info = new Uint8Array(readFileSync('fixtures/metadata/file-info-record.bin'))

function parse(bytes: Uint8Array) {
  return Effect.runPromise(
    readDemoMetadata({
      size: bytes.length,
      readRange: (offset, length) => Effect.succeed(bytes.slice(offset, offset + length)),
    }),
  )
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

test('decodes captured Dust II records with independently verified values', async () => {
  await expect(parse(fixture)).resolves.toEqual({
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
})

test('keeps absent fields distinct from recorded zero values', async () => {
  const minimalPayload = [10, 8, 80, 66, 68, 69, 77, 83, 50, 0]
  const minimalHeader = new Uint8Array([1, 0, minimalPayload.length, ...minimalPayload])
  const missing = await parse(demo(minimalHeader))
  expect(missing).toEqual({
    mapName: null,
    serverName: null,
    clientName: null,
    gameDirectory: null,
    demoVersion: null,
    patchVersion: null,
    buildNumber: null,
    serverStartTick: null,
    durationSeconds: null,
    playbackTicks: null,
    playbackFrames: null,
  })
  await expect(parse(demo(header, new Uint8Array([2, 0, 0])))).resolves.toMatchObject({
    mapName: 'de_dust2',
    durationSeconds: null,
    playbackTicks: null,
    playbackFrames: null,
  })
  const zero = await parse(demo(header, new Uint8Array([2, 0, 9, 13, 0, 0, 0, 0, 16, 0, 24, 0])))
  expect(zero).toMatchObject({
    mapName: 'de_dust2',
    durationSeconds: 0,
    playbackTicks: 0,
    playbackFrames: 0,
  })
})

test('decodes Snappy metadata blocks', async () => {
  const payload = compress(header.slice(8))
  const compressedHeader = new Uint8Array([65, 0, ...varint(payload.length), ...payload])
  await expect(parse(demo(compressedHeader, info))).resolves.toMatchObject({
    mapName: 'de_dust2',
    durationSeconds: 3078.25,
  })
})

describe('rejects malformed metadata', () => {
  test.each([
    ['truncated container', new Uint8Array(8), /truncated/],
    ['archive signature', new Uint8Array(32), /Extract ZIP or RAR/],
    ['overflowing varint', demo(new Uint8Array([255, 255, 255, 255, 16])), /invalid record number/],
    ['unfinished varint', demo(new Uint8Array([128])), /ends inside a record/],
    ['incorrect command', demo(new Uint8Array([2, 0, 0])), /record is invalid/],
    ['truncated payload', demo(new Uint8Array([1, 0, 100])), /truncated/],
    ['oversized payload', demo(new Uint8Array([1, 0, ...varint(1048577)])), /size limit/],
    [
      'oversized Snappy expansion',
      demo(new Uint8Array([65, 0, 4, ...varint(2097152)])),
      /compressed metadata/,
    ],
    ['damaged protobuf', demo(new Uint8Array([1, 0, 1, 255])), /header is damaged/],
    [
      'negative playback time',
      demo(header, new Uint8Array([2, 0, 5, 13, 0, 0, 128, 191])),
      /invalid values/,
    ],
  ])('%s', async (_name, bytes, message) => {
    await expect(parse(bytes)).rejects.toThrow(message)
  })
  test.each([1, 17, 0xffffffff])('rejects invalid file-info offset %i', async (offset) => {
    const bytes = fixture.slice()
    new DataView(bytes.buffer).setUint32(8, offset, true)
    await expect(parse(bytes)).rejects.toThrow(/offset/)
  })
})

test('does not interpret the SpawnGroups offset as the high bits of FileInfo', async () => {
  const bytes = fixture.slice()
  new DataView(bytes.buffer).setUint32(12, 598096057, true)
  await expect(parse(bytes)).resolves.toMatchObject({ mapName: 'de_dust2', playbackTicks: 197008 })
})

test('preserves typed read failures at the source boundary', async () => {
  const result = await Effect.runPromise(
    Effect.either(
      readDemoMetadata({
        size: 100,
        readRange: () => Effect.fail(new DemoReadError({ message: 'Permission lost' })),
      }),
    ),
  )
  expect(result).toMatchObject({
    _tag: 'Left',
    left: { _tag: 'DemoReadError', message: 'Permission lost' },
  })
})

test('reports a short source read as a typed read failure', async () => {
  const result = await Effect.runPromise(
    Effect.either(
      readDemoMetadata({
        size: fixture.length,
        readRange: () => Effect.succeed(new Uint8Array(0)),
      }),
    ),
  )
  expect(result).toMatchObject({
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
  expect(metadata).toMatchObject({
    mapName: 'de_dust2',
    durationSeconds: 3078.25,
    playbackTicks: 197008,
  })
  expect(bytesRead).toBeLessThan(1024)
})
