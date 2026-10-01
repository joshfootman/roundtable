import { replayBuffers } from '../replay/buffers.ts'
import { Cause, Effect, Option, Stream } from 'effect'
import { fileSource } from './file-source'
import { readRecordingInfo } from './metadata'
import { readReplay } from './round'
import type { ImportResult } from './import'

function send(result: ImportResult) {
  if (result.type === 'round') {
    self.postMessage(result, { transfer: replayBuffers(result.round) })
  } else self.postMessage(result)
}

self.onmessage = (event: MessageEvent<File>) => {
  const file = event.data
  const source = fileSource(file)
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
