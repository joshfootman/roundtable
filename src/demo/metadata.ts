import { Data, Effect } from 'effect'
import { fromBinary, isFieldSet } from '@bufbuild/protobuf'
import { uncompress } from 'snappyjs'
import { CDemoFileHeaderSchema, CDemoFileInfoSchema } from './generated/demo_pb.ts'

export interface DemoMetadata {
  mapName: string | null
  serverName: string | null
  clientName: string | null
  gameDirectory: string | null
  demoVersion: string | null
  patchVersion: number | null
  buildNumber: number | null
  serverStartTick: number | null
  durationSeconds: number | null
  playbackTicks: number | null
  playbackFrames: number | null
}

export interface DemoSource {
  size: number
  readRange: (offset: number, length: number) => Effect.Effect<Uint8Array, DemoReadError>
}

const MAX_METADATA_BYTES = 1024 * 1024
const signature = new Uint8Array([80, 66, 68, 69, 77, 83, 50, 0])

function uint32(bytes: Uint8Array, cursor: { offset: number }): number {
  let value = 0
  for (let i = 0; i < 5; i++) {
    const byte = bytes[cursor.offset++]
    if (byte === undefined) throw new Error('The demo ends inside a record. Download it again.')
    if (i === 4 && byte > 15) throw new Error('The demo contains an invalid record number.')
    value += (byte & 127) * 2 ** (i * 7)
    if (byte < 128) return value
  }
  throw new Error('The demo contains an invalid record number.')
}

export class DemoReadError extends Data.TaggedError('DemoReadError')<{ message: string }> {}
export class DemoParseError extends Data.TaggedError('DemoParseError')<{ message: string }> {}

export function readDemoMetadata(
  source: DemoSource,
): Effect.Effect<DemoMetadata, DemoReadError | DemoParseError> {
  const parseFraming = <T>(run: () => T) =>
    Effect.try({
      try: run,
      catch: (error) =>
        new DemoParseError({
          message: error instanceof Error ? error.message : 'The demo metadata is invalid.',
        }),
    })
  function read(offset: number, length: number) {
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !Number.isSafeInteger(length) ||
      length < 0 ||
      offset + length > source.size
    ) {
      return Effect.fail(
        new DemoParseError({
          message: 'The demo is truncated or its metadata offset is invalid. Download it again.',
        }),
      )
    }
    return source.readRange(offset, length).pipe(
      Effect.flatMap((bytes) =>
        bytes.length === length
          ? Effect.succeed(bytes)
          : Effect.fail(
              new DemoReadError({
                message: 'The demo could not be read completely. Select it again.',
              }),
            ),
      ),
    )
  }

  function record(offset: number, expectedCommand: number) {
    return Effect.gen(function* () {
      const prefix = yield* read(offset, Math.min(15, source.size - offset))
      const { command, length, prefixLength } = yield* parseFraming(() => {
        const cursor = { offset: 0 }
        const command = uint32(prefix, cursor)
        uint32(prefix, cursor)
        const length = uint32(prefix, cursor)
        if ((command & ~64) !== expectedCommand)
          throw new Error('The demo metadata record is invalid.')
        if (length > MAX_METADATA_BYTES)
          throw new Error('The demo metadata exceeds the supported size limit.')
        return { command, length, prefixLength: cursor.offset }
      })
      const payload = yield* read(offset + prefixLength, length)
      const bytes =
        command & 64
          ? yield* Effect.try({
              try: () => uncompress(payload, MAX_METADATA_BYTES),
              catch: () =>
                new DemoParseError({
                  message: 'The demo has invalid or oversized compressed metadata.',
                }),
            })
          : payload
      return { bytes, end: offset + prefixLength + length }
    })
  }

  return Effect.gen(function* () {
    const container = yield* read(0, 16)
    if (!signature.every((byte, index) => container[index] === byte)) {
      return yield* Effect.fail(
        new DemoParseError({
          message: 'Select a raw CS2 .dem file. Extract ZIP or RAR archives first.',
        }),
      )
    }
    const fileInfoOffset = new DataView(container.buffer, container.byteOffset, 16).getUint32(
      8,
      true,
    )
    const headerRecord = yield* record(16, 1)
    const header = yield* Effect.try({
      try: () => fromBinary(CDemoFileHeaderSchema, headerRecord.bytes),
      catch: () =>
        new DemoParseError({
          message: 'The demo header is damaged. Download the demo again.',
        }),
    })
    if (header.demoFileStamp !== 'PBDEMS2\0') {
      return yield* Effect.fail(
        new DemoParseError({ message: 'The demo header is not a Source 2 demo.' }),
      )
    }
    if (header.game === 'dota' || /(?:^|[\\/])dota\/?$/.test(header.gameDirectory)) {
      return yield* Effect.fail(
        new DemoParseError({ message: 'This is a Dota demo. Choose a Counter-Strike 2 demo.' }),
      )
    }
    let info
    if (fileInfoOffset !== 0) {
      if (fileInfoOffset < headerRecord.end) {
        return yield* Effect.fail(
          new DemoParseError({ message: 'The demo metadata offset overlaps its header.' }),
        )
      }
      const infoRecord = yield* record(fileInfoOffset, 2)
      info = yield* Effect.try({
        try: () => fromBinary(CDemoFileInfoSchema, infoRecord.bytes),
        catch: () =>
          new DemoParseError({
            message: 'The demo playback metadata is damaged. Download the demo again.',
          }),
      })
      for (const value of [info.playbackTime, info.playbackTicks, info.playbackFrames]) {
        if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
          return yield* Effect.fail(
            new DemoParseError({ message: 'The demo playback metadata contains invalid values.' }),
          )
        }
      }
    }
    return {
      mapName: header.mapName || null,
      serverName: header.serverName || null,
      clientName: header.clientName || null,
      gameDirectory: header.gameDirectory || null,
      demoVersion: header.demoVersionName || null,
      patchVersion: isFieldSet(header, CDemoFileHeaderSchema.field.patchVersion)
        ? header.patchVersion
        : null,
      buildNumber: isFieldSet(header, CDemoFileHeaderSchema.field.buildNum)
        ? header.buildNum
        : null,
      serverStartTick: isFieldSet(header, CDemoFileHeaderSchema.field.serverStartTick)
        ? header.serverStartTick
        : null,
      durationSeconds:
        info && isFieldSet(info, CDemoFileInfoSchema.field.playbackTime) ? info.playbackTime : null,
      playbackTicks:
        info && isFieldSet(info, CDemoFileInfoSchema.field.playbackTicks)
          ? info.playbackTicks
          : null,
      playbackFrames:
        info && isFieldSet(info, CDemoFileInfoSchema.field.playbackFrames)
          ? info.playbackFrames
          : null,
    }
  })
}
