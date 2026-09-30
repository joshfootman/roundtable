import { Data, Effect } from 'effect'
import type { ImportedDemo } from './demo'

export class DemoImportError extends Data.TaggedError('DemoImportError')<{ message: string }> {}

export type ImportResult =
  | { type: 'ready'; demo: ImportedDemo }
  | { type: 'error'; message: string }

export function importDemo(file: File): Effect.Effect<ImportedDemo, DemoImportError> {
  return Effect.scoped(
    Effect.gen(function* () {
      const worker = yield* Effect.acquireRelease(
        Effect.try({
          try: () => new Worker(new URL('./demo.worker.ts', import.meta.url), { type: 'module' }),
          catch: () =>
            new DemoImportError({
              message: 'The demo reader could not start. Reload the page and try again.',
            }),
        }),
        (worker) =>
          Effect.sync(() => {
            worker.onmessage = null
            worker.onerror = null
            worker.onmessageerror = null
            worker.terminate()
          }),
      )
      return yield* Effect.async<ImportedDemo, DemoImportError>((resume) => {
        worker.onmessage = (event: MessageEvent<ImportResult>) => {
          const result = event.data
          resume(
            result.type === 'ready'
              ? Effect.succeed(result.demo)
              : Effect.fail(new DemoImportError({ message: result.message })),
          )
        }
        worker.onerror = worker.onmessageerror = () => {
          resume(
            Effect.fail(
              new DemoImportError({
                message: 'The demo reader stopped unexpectedly. Try importing the file again.',
              }),
            ),
          )
        }
        try {
          worker.postMessage(file)
        } catch {
          resume(
            Effect.fail(
              new DemoImportError({
                message: 'The demo could not be sent to the local reader. Try importing it again.',
              }),
            ),
          )
        }
      })
    }),
  )
}
