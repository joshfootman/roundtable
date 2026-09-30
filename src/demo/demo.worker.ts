import { Cause, Effect, Option, Stream } from 'effect'
import { DemoReadError } from './errors'
import { readRecordingInfo } from './metadata'
import { readReplay } from './round'
import type { ImportResult } from './import'

function send(result: ImportResult) {
  if (result.type === 'round') {
    const { ticks, positions, alive } = result.round
    self.postMessage(result, { transfer: [ticks.buffer, positions.buffer, alive.buffer] })
  } else self.postMessage(result)
}

self.onmessage = (event: MessageEvent<File>) => {
  const file = event.data
  const source = {
    size: file.size,
    readRange: (offset: number, length: number) =>
      Effect.tryPromise({
        try: () =>
          file
            .slice(offset, offset + length)
            .arrayBuffer()
            .then((buffer) => new Uint8Array(buffer)),
        catch: () =>
          new DemoReadError({ message: 'The demo file could not be read. Select it again.' }),
      }),
  }
  Effect.runFork(
    Effect.gen(function* () {
      const recording = yield* readRecordingInfo(source)
      send({ type: 'metadata', ...recording })
      yield* Stream.runForEach(readReplay(source), (event) => Effect.sync(() => send(event)))
      send({ type: 'complete' })
    }).pipe(
      Effect.catchAllCause((cause) =>
        Effect.sync(() =>
          send({
            type: 'error',
            message: Option.match(Cause.failureOption(cause), {
              onSome: (error) => error.message,
              onNone: () => 'The demo reader encountered an unexpected error. Try another demo.',
            }),
          }),
        ),
      ),
    ),
  )
}
