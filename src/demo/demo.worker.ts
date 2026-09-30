import { Cause, Effect, Option } from 'effect'
import { DemoReadError } from './errors'
import { readDemo } from './demo'
import type { ImportResult } from './import'

self.onmessage = (event: MessageEvent<File>) => {
  const file = event.data
  const job = readDemo({
    size: file.size,
    readRange: (offset, length) =>
      Effect.tryPromise({
        try: () =>
          file
            .slice(offset, offset + length)
            .arrayBuffer()
            .then((buffer) => new Uint8Array(buffer)),
        catch: () =>
          new DemoReadError({ message: 'The demo file could not be read. Select it again.' }),
      }),
  }).pipe(
    Effect.matchCause({
      onFailure: (cause): ImportResult => ({
        type: 'error',
        message: Option.match(Cause.failureOption(cause), {
          onSome: (error) => error.message,
          onNone: () => 'The demo reader encountered an unexpected error. Try another demo.',
        }),
      }),
      onSuccess: (demo): ImportResult => ({ type: 'ready', demo }),
    }),
    Effect.tap((result) =>
      Effect.sync(() => {
        if (result.type === 'error') {
          self.postMessage(result)
          return
        }
        const { ticks, positions, alive } = result.demo.firstRound
        self.postMessage(result, { transfer: [ticks.buffer, positions.buffer, alive.buffer] })
      }),
    ),
  )
  Effect.runFork(job)
}
