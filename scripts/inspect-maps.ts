import { open } from 'node:fs/promises'
import { Effect } from 'effect'
import { DemoReadError, readDemoMetadata } from '../src/demo/metadata.ts'
import { readFirstRound } from '../src/demo/round.ts'

const paths = process.argv.slice(2)
if (paths.length === 0) throw new Error('Pass one or more extracted .dem paths.')

for (const path of paths) {
  const result = await Effect.runPromiseExit(
    Effect.scoped(
      Effect.gen(function* () {
        const io = <T>(run: () => Promise<T>) =>
          Effect.tryPromise({
            try: run,
            catch: (error) => new DemoReadError({ message: String(error) }),
          })
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
        console.log(JSON.stringify({ path, size, metadata }))
        const round = yield* readFirstRound(source)
        console.log(
          JSON.stringify({
            path,
            round: round.number,
            startTick: round.startTick,
            endTick: round.endTick,
            players: round.players,
            frames: round.ticks.length,
            startingPositions: Array.from(round.positions.subarray(0, round.players.length * 3)),
          }),
        )
      }),
    ),
  )
  if (result._tag === 'Failure') {
    console.error(path, result.cause)
    process.exitCode = 1
  }
}
