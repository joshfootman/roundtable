import { Effect } from 'effect'
import { DemoReadError, memoryFailureMessage } from './errors'
import type { DemoSource } from './source'

export function fileSource(file: Blob): DemoSource {
  return {
    size: file.size,
    readRange: (offset, length) =>
      Effect.tryPromise({
        try: () => file.slice(offset, offset + length).arrayBuffer(),
        catch: (error) => error,
      }).pipe(
        Effect.retry({
          times: 2,
          while: (error) => error instanceof DOMException && error.name === 'NotReadableError',
        }),
        Effect.map((buffer) => new Uint8Array(buffer)),
        Effect.mapError(
          (error) =>
            new DemoReadError({
              message:
                memoryFailureMessage(error) ?? 'The demo file could not be read. Select it again.',
            }),
        ),
      ),
  }
}
