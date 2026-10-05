import { Effect, Schema, Stream } from 'effect'
import { DemoImportError, type ImportEvent } from './import.ts'
import { memoryFailureMessage } from './errors.ts'
import { decodeRound } from './replay-codec.ts'
import { defaultExampleId, examples } from './examples.ts'
import type { ExampleId } from './examples.ts'

export const ExampleManifest = Schema.Struct({
  formatVersion: Schema.Literal(1),
  source: Schema.Struct({
    filename: Schema.NonEmptyString,
    sha256: Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/)),
    match: Schema.String,
  }),
  metadata: Schema.Struct({
    mapName: Schema.NonEmptyString,
    serverName: Schema.NonEmptyString,
    clientName: Schema.NonEmptyString,
    gameDirectory: Schema.NonEmptyString,
    demoVersion: Schema.NonEmptyString,
    patchVersion: Schema.Int.pipe(Schema.nonNegative()),
    buildNumber: Schema.Int.pipe(Schema.nonNegative()),
    durationSeconds: Schema.Positive,
    playbackTicks: Schema.Int.pipe(Schema.positive()),
    playbackFrames: Schema.Int.pipe(Schema.positive()),
  }),
  rounds: Schema.NonEmptyArray(
    Schema.Struct({
      number: Schema.Int.pipe(Schema.positive()),
      startTick: Schema.Int.pipe(Schema.nonNegative()),
      path: Schema.String.pipe(Schema.pattern(/^round-\d+\.rpl$/)),
      compressedBytes: Schema.Int.pipe(Schema.positive()),
      decodedBytes: Schema.Int.pipe(Schema.positive()),
      sha256: Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/)),
    }),
  ),
}).pipe(
  Schema.filter((manifest) =>
    manifest.rounds.every(
      (round, index) =>
        round.number === index + 1 &&
        round.path === `round-${round.number}.rpl` &&
        (index === 0 || round.startTick > manifest.rounds[index - 1]!.startTick),
    ),
  ),
)

export function importExample(
  id: ExampleId = defaultExampleId,
): Stream.Stream<ImportEvent, DemoImportError> {
  const example = examples[id]
  const fetchAsset = (path: string) =>
    Effect.tryPromise({
      try: async (signal) => {
        const response = await fetch(`${example.assetBase}/${path}`, { signal })
        if (!response.ok) throw new Error(`Example download failed (${response.status}).`)
        return new Uint8Array(await response.arrayBuffer())
      },
      catch: (error) =>
        new DemoImportError({
          message:
            memoryFailureMessage(error) ??
            'The example match could not be downloaded. Check your connection and try again.',
        }),
    })
  return Stream.unwrap(
    Effect.gen(function* () {
      const response = yield* fetchAsset('manifest.json')
      const manifest = yield* Effect.tryPromise({
        try: async () => JSON.parse(new TextDecoder().decode(response)),
        catch: () => new DemoImportError({ message: 'The example match manifest is unreadable.' }),
      }).pipe(
        Effect.flatMap(Schema.decodeUnknown(ExampleManifest)),
        Effect.mapError(
          () => new DemoImportError({ message: 'The example match manifest is incompatible.' }),
        ),
      )
      if (
        manifest.source.filename !== example.filename ||
        manifest.source.sha256 !== example.sourceSha256 ||
        manifest.source.match !== example.sourceUrl ||
        manifest.metadata.mapName !== example.map ||
        manifest.rounds.length !== example.roundCount
      )
        return yield* Effect.fail(
          new DemoImportError({
            message: 'The example manifest does not match the selected recording.',
          }),
        )
      const metadata: ImportEvent = {
        type: 'metadata',
        metadata: manifest.metadata,
        roundStartTicks: manifest.rounds.map((round) => round.startTick),
      }
      const rounds = Stream.fromIterable(manifest.rounds).pipe(
        Stream.mapEffect((descriptor) =>
          Effect.gen(function* () {
            const response = yield* fetchAsset(descriptor.path)
            if (response.byteLength !== descriptor.compressedBytes)
              return yield* Effect.fail(
                new DemoImportError({
                  message:
                    'An example round download is incomplete. Try loading the example again.',
                }),
              )
            const round = yield* Effect.tryPromise({
              try: async () => {
                const bytes = await new Response(
                  new Blob([response]).stream().pipeThrough(new DecompressionStream('gzip')),
                ).arrayBuffer()
                if (bytes.byteLength !== descriptor.decodedBytes)
                  throw new Error('Truncated replay download.')
                const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
                const hash = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join(
                  '',
                )
                if (hash !== descriptor.sha256) throw new Error('Replay checksum mismatch.')
                const round = decodeRound(bytes)
                if (round.number !== descriptor.number || round.startTick !== descriptor.startTick)
                  throw new Error('Replay descriptor mismatch.')
                return round
              },
              catch: (error) =>
                new DemoImportError({
                  message:
                    memoryFailureMessage(error) ??
                    'An example round is damaged or incompatible. Try loading the example again.',
                }),
            })
            return { type: 'round', round } satisfies ImportEvent
          }),
        ),
      )
      return Stream.make(metadata).pipe(
        Stream.concat(rounds),
        Stream.concat(Stream.succeed<ImportEvent>({ type: 'complete' })),
      )
    }),
  )
}
