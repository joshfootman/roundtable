import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, open, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { Effect, Stream } from 'effect'
import { readDemoMetadata, DemoReadError } from '../src/demo/metadata.ts'
import { readRounds } from '../src/demo/round.ts'
import { encodeRound, decodeRound } from '../src/demo/replay-codec.ts'

const path = process.argv[2] ?? 'fixtures/local/faze-vs-vitality-m2-dust2.dem'
const io = <T>(run: () => Promise<T>) =>
  Effect.tryPromise({ try: run, catch: (error) => new DemoReadError({ message: String(error) }) })
await Effect.runPromise(
  Effect.scoped(
    Effect.gen(function* () {
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
      const hash = yield* io(async () => {
        const hash = createHash('sha256')
        for await (const chunk of createReadStream(path)) hash.update(chunk)
        return hash.digest('hex')
      })
      if (hash !== '0d5a5f00301ea55780f30184b9e257b9d0e742fb5d3e6b4c70878340be6eb7d4')
        return yield* Effect.fail(
          new DemoReadError({
            message:
              'The example generator requires the verified FaZe versus Vitality Dust II recording.',
          }),
        )
      const metadata = yield* readDemoMetadata(source)
      yield* io(() => mkdir('public/example', { recursive: true }))
      const rounds: {
        number: number
        startTick: number
        path: string
        compressedBytes: number
        decodedBytes: number
        sha256: string
      }[] = []
      yield* readRounds(source).pipe(
        Stream.runForEach((round) =>
          io(async () => {
            const buffer = encodeRound(round)
            decodeRound(buffer)
            const compressed = gzipSync(new Uint8Array(buffer))
            const path = `round-${round.number}.rpl`
            await writeFile(`public/example/${path}`, compressed)
            rounds.push({
              number: round.number,
              startTick: round.startTick,
              path,
              compressedBytes: compressed.byteLength,
              decodedBytes: buffer.byteLength,
              sha256: createHash('sha256').update(new Uint8Array(buffer)).digest('hex'),
            })
            console.log(`Generated round ${round.number}, ${compressed.byteLength} bytes`)
          }),
        ),
      )
      yield* io(() =>
        writeFile(
          'public/example/manifest.json',
          JSON.stringify(
            {
              formatVersion: 1,
              source: {
                filename: 'faze-vs-vitality-m2-dust2.dem',
                sha256: hash,
                match:
                  'https://www.hltv.org/matches/2372742/faze-vs-vitality-blast-premier-spring-final-2024',
              },
              metadata,
              rounds,
            },
            null,
            2,
          ) + '\n',
        ),
      )
    }),
  ),
)
