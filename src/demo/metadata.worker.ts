import { Cause, Effect, Option } from 'effect'
import { DemoReadError, readDemoMetadata } from './metadata'
import type { ImportResult } from './import'

self.onmessage = (event: MessageEvent<File>) => {
  const file = event.data
  const job = readDemoMetadata({
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
      onSuccess: (metadata): ImportResult => ({ type: 'ready', metadata }),
    }),
    Effect.tap((result) => Effect.sync(() => self.postMessage(result))),
  )
  Effect.runFork(job)
}
