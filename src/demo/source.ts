import { Effect } from 'effect'
import { uncompress } from 'snappyjs'
import { EDemoCommands } from './generated/demo_pb.ts'
import { DemoParseError, DemoReadError, memoryFailureMessage } from './errors.ts'

export interface DemoSource {
  size: number
  readRange: (offset: number, length: number) => Effect.Effect<Uint8Array, DemoReadError>
}

export function boundedSource(source: DemoSource) {
  return (offset: number, length: number) => {
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !Number.isSafeInteger(length) ||
      length < 0 ||
      offset + length > source.size
    )
      return Effect.fail(
        new DemoParseError({
          message: 'The demo is truncated or its record offset is invalid. Download it again.',
        }),
      )
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
}

export function readVarUint32(next: () => number): number {
  let value = 0
  for (let i = 0; i < 5; i++) {
    const byte = next()
    if (i === 4 && byte > 15) throw new Error('The demo contains an invalid record number.')
    value += (byte & 127) * 2 ** (i * 7)
    if (byte < 128) return value
  }
  throw new Error('The demo contains an invalid record number.')
}

export function parse<T>(run: () => T): Effect.Effect<T, DemoParseError> {
  return Effect.try({
    try: run,
    catch: (error) =>
      error instanceof DemoParseError
        ? error
        : new DemoParseError({
            message:
              memoryFailureMessage(error) ??
              (error instanceof Error
                ? error.message
                : 'The demo data is damaged. Download it again.'),
          }),
  })
}

export function readRecordFraming(source: DemoSource, offset: number, limit?: number) {
  return Effect.gen(function* () {
    const prefix = yield* boundedSource(source)(offset, Math.min(15, source.size - offset))
    return yield* parse(() => {
      let cursor = 0
      const next = () => {
        const byte = prefix[cursor++]
        if (byte === undefined)
          throw new Error('The demo is truncated inside a record. Download it again.')
        return byte
      }
      const flags = readVarUint32(next)
      const tick = readVarUint32(next)
      const length = readVarUint32(next)
      const end = offset + cursor + length
      if (limit !== undefined && length > limit)
        throw new Error('The demo record exceeds the supported size limit.')
      if (end > source.size)
        throw new Error('The demo is truncated inside a record. Download it again.')
      return {
        command: flags & ~EDemoCommands.DEM_IsCompressed,
        compressed: Boolean(flags & EDemoCommands.DEM_IsCompressed),
        tick,
        length,
        start: offset + cursor,
        end,
      }
    })
  })
}

export function readRecordPayload(
  source: DemoSource,
  framing: { start: number; length: number; compressed: boolean },
  limit: number,
  context = 'record',
) {
  return Effect.gen(function* () {
    if (framing.length > limit)
      return yield* Effect.fail(
        new DemoParseError({ message: 'The demo record exceeds the supported size limit.' }),
      )
    const bytes = yield* boundedSource(source)(framing.start, framing.length)
    return framing.compressed
      ? yield* Effect.try({
          try: () => uncompress(bytes, limit),
          catch: (error) =>
            new DemoParseError({
              message:
                memoryFailureMessage(error) ??
                `The demo has invalid or oversized compressed ${context}. Download it again.`,
            }),
        })
      : bytes
  })
}

export function bufferedSource(source: DemoSource): DemoSource {
  const windowBytes = 256 * 1024
  let start = 0
  let buffer: Uint8Array = new Uint8Array()
  return {
    size: source.size,
    readRange: (offset, length) => {
      if (offset >= start && offset + length <= start + buffer.length)
        return Effect.succeed(buffer.subarray(offset - start, offset - start + length))
      if (length > windowBytes) return source.readRange(offset, length)
      const requested = Math.min(windowBytes, source.size - offset)
      return source.readRange(offset, requested).pipe(
        Effect.flatMap((bytes) => {
          if (bytes.length !== requested)
            return Effect.fail(
              new DemoReadError({
                message: 'The demo could not be read completely. Select it again.',
              }),
            )
          start = offset
          buffer = bytes
          return Effect.succeed(bytes.subarray(0, length))
        }),
      )
    },
  }
}
