import { Effect } from 'effect'
import { fromBinary, isFieldSet, type Message, type DescField } from '@bufbuild/protobuf'
import { boundedSource, readRecordFraming, readRecordPayload, type DemoSource } from './source.ts'
import { DemoParseError, DemoReadError, DemoUnsupportedError } from './errors.ts'
export { DemoParseError, DemoReadError, DemoUnsupportedError } from './errors.ts'
import { CDemoFileHeaderSchema, CDemoFileInfoSchema, EDemoCommands } from './generated/demo_pb.ts'

export interface DemoMetadata {
  mapName: string
  serverName: string
  clientName: string
  gameDirectory: string
  demoVersion: string
  patchVersion: number
  buildNumber: number
  durationSeconds: number
  playbackTicks: number
  playbackFrames: number
}

export interface RecordingInfo {
  metadata: DemoMetadata
  roundStartTicks: number[]
}

const CONTAINER_BYTES = 16
const signature = [80, 66, 68, 69, 77, 83, 50, 0]
const archiveSignatures = [
  { name: 'ZIP', bytes: [0x50, 0x4b, 0x03, 0x04] },
  { name: 'ZIP', bytes: [0x50, 0x4b, 0x05, 0x06] },
  { name: 'ZIP', bytes: [0x50, 0x4b, 0x07, 0x08] },
  { name: 'RAR', bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00] },
  { name: 'RAR', bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00] },
  { name: '7z', bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] },
  { name: 'gzip', bytes: [0x1f, 0x8b] },
  { name: 'bzip2', bytes: [0x42, 0x5a, 0x68] },
]

function startsWith(bytes: Uint8Array, prefix: readonly number[]) {
  return prefix.every((byte, index) => bytes[index] === byte)
}

type MetadataDecodeError = DemoParseError | DemoUnsupportedError

function decode<T>(run: () => T, message?: string): Effect.Effect<T, MetadataDecodeError> {
  return Effect.try({
    try: run,
    catch: (error) =>
      error instanceof DemoParseError || error instanceof DemoUnsupportedError
        ? error
        : new DemoParseError({
            message:
              message ?? (error instanceof Error ? error.message : 'The demo metadata is invalid.'),
          }),
  })
}

function requiredField(message: Message, field: DescField) {
  if (!isFieldSet(message, field)) {
    throw new DemoParseError({
      message: `The demo is missing required metadata (${field.name}). Choose a complete demo.`,
    })
  }
}

function requiredString(message: Message, field: DescField, value: string): string {
  requiredField(message, field)
  if (value.trim().length === 0) {
    throw new DemoParseError({
      message: `The demo contains empty required metadata (${field.name}). Choose a complete demo.`,
    })
  }
  return value
}

function requiredNumber(message: Message, field: DescField, value: number): number {
  requiredField(message, field)
  if (!Number.isFinite(value) || value < 0) {
    throw new DemoParseError({
      message: `The demo metadata contains invalid values (${field.name}).`,
    })
  }
  return value
}

function decodeContainer(container: Uint8Array) {
  return decode(() => {
    const archive = archiveSignatures.find(({ bytes }) => startsWith(container, bytes))
    if (archive) {
      throw new DemoUnsupportedError({
        reason: 'archive',
        message: `This is a ${archive.name} archive. Extract it first, then select the CS2 .dem file inside.`,
      })
    }
    if (startsWith(container, [72, 76, 50, 68, 69, 77, 79, 0])) {
      throw new DemoUnsupportedError({
        reason: 'source1',
        message:
          'This is a Source 1 demo. CS:GO demos are not supported. Choose a Counter-Strike 2 .dem file.',
      })
    }
    if (
      container.length < signature.length &&
      startsWith(container, signature.slice(0, container.length))
    ) {
      throw new DemoParseError({
        message: 'The demo is truncated. Download it again.',
      })
    }
    if (!startsWith(container, signature)) {
      throw new DemoUnsupportedError({
        reason: 'unknown-format',
        message:
          'This file is not a recognized demo or archive. Select a raw Counter-Strike 2 .dem file.',
      })
    }
    if (container.length < CONTAINER_BYTES) {
      throw new DemoParseError({
        message: 'The demo is truncated. Download it again.',
      })
    }
    return new DataView(container.buffer, container.byteOffset, CONTAINER_BYTES).getUint32(8, true)
  })
}

type HeaderMetadata = Omit<DemoMetadata, 'durationSeconds' | 'playbackTicks' | 'playbackFrames'>
type PlaybackMetadata = Pick<DemoMetadata, 'durationSeconds' | 'playbackTicks' | 'playbackFrames'>

function decodeHeader(bytes: Uint8Array): Effect.Effect<HeaderMetadata, MetadataDecodeError> {
  return decode(() => {
    const header = fromBinary(CDemoFileHeaderSchema, bytes)
    if (header.demoFileStamp !== 'PBDEMS2\0') {
      throw new DemoParseError({ message: 'The demo header is not a Source 2 demo.' })
    }
    const game = header.game.trim().toLowerCase()
    const directory = header.gameDirectory
      .replace(/[\\/]+$/, '')
      .split(/[\\/]/)
      .at(-1)
      ?.toLowerCase()
    const identifier = game || directory
    if (identifier && identifier !== 'csgo' && identifier !== 'cs2') {
      throw new DemoUnsupportedError({
        reason: 'other-game',
        message: 'This Source 2 demo is for another game. Choose a Counter-Strike 2 .dem file.',
      })
    }
    const fields = CDemoFileHeaderSchema.field
    return {
      mapName: requiredString(header, fields.mapName, header.mapName),
      serverName: requiredString(header, fields.serverName, header.serverName),
      clientName: requiredString(header, fields.clientName, header.clientName),
      gameDirectory: requiredString(header, fields.gameDirectory, header.gameDirectory),
      demoVersion: requiredString(header, fields.demoVersionName, header.demoVersionName),
      patchVersion: requiredNumber(header, fields.patchVersion, header.patchVersion),
      buildNumber: requiredNumber(header, fields.buildNum, header.buildNum),
    }
  }, 'The demo header is damaged. Download the demo again.')
}

function decodeFileInfo(
  bytes: Uint8Array,
): Effect.Effect<{ playback: PlaybackMetadata; roundStartTicks: number[] }, MetadataDecodeError> {
  return decode(() => {
    const info = fromBinary(CDemoFileInfoSchema, bytes)
    const fields = CDemoFileInfoSchema.field
    const playback = {
      durationSeconds: requiredNumber(info, fields.playbackTime, info.playbackTime),
      playbackTicks: requiredNumber(info, fields.playbackTicks, info.playbackTicks),
      playbackFrames: requiredNumber(info, fields.playbackFrames, info.playbackFrames),
    }
    const roundStartTicks = info.gameInfo?.cs?.roundStartTicks ?? []
    if (
      roundStartTicks.some(
        (tick, index) =>
          !Number.isInteger(tick) ||
          tick < 0 ||
          tick > playback.playbackTicks ||
          (index > 0 && tick <= roundStartTicks[index - 1]),
      )
    ) {
      throw new DemoParseError({ message: 'The demo round-start index is invalid.' })
    }
    return { playback, roundStartTicks }
  }, 'The demo playback metadata is damaged. Download the demo again.')
}

export function readRecordingInfo(
  source: DemoSource,
): Effect.Effect<RecordingInfo, DemoReadError | DemoParseError | DemoUnsupportedError> {
  const read = boundedSource(source)
  function readMetadataRecord(offset: number, expectedCommand: number) {
    return Effect.gen(function* () {
      const record = yield* readRecordFraming(source, offset, 1024 * 1024)
      if (record.command !== expectedCommand)
        return yield* Effect.fail(
          new DemoParseError({ message: 'The demo metadata record is invalid.' }),
        )
      const bytes = yield* readRecordPayload(source, record, 1024 * 1024, 'metadata')
      return { bytes, end: record.end }
    })
  }

  return Effect.gen(function* () {
    if (source.size === 0) {
      return yield* Effect.fail(
        new DemoUnsupportedError({
          reason: 'empty',
          message:
            'This file is empty. Download the demo again, then select the extracted .dem file.',
        }),
      )
    }
    const container = yield* read(0, Math.min(CONTAINER_BYTES, source.size))
    const fileInfoOffset = yield* decodeContainer(container)
    const headerRecord = yield* readMetadataRecord(CONTAINER_BYTES, EDemoCommands.DEM_FileHeader)
    const header = yield* decodeHeader(headerRecord.bytes)
    if (fileInfoOffset === 0) {
      return yield* Effect.fail(
        new DemoParseError({
          message: 'The demo is missing playback metadata. Choose a complete demo.',
        }),
      )
    }
    if (fileInfoOffset < headerRecord.end) {
      return yield* Effect.fail(
        new DemoParseError({ message: 'The demo metadata offset overlaps its header.' }),
      )
    }
    const infoRecord = yield* readMetadataRecord(fileInfoOffset, EDemoCommands.DEM_FileInfo)
    const info = yield* decodeFileInfo(infoRecord.bytes)
    return { metadata: { ...header, ...info.playback }, roundStartTicks: info.roundStartTicks }
  })
}

export function readDemoMetadata(
  source: DemoSource,
): Effect.Effect<DemoMetadata, DemoReadError | DemoParseError | DemoUnsupportedError> {
  return readRecordingInfo(source).pipe(Effect.map(({ metadata }) => metadata))
}
