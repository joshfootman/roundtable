import { Data, Effect, Stream } from 'effect'
import type { DemoMetadata } from './metadata'
import type { ReplayRound } from '../replay/types'

export class DemoImportError extends Data.TaggedError('DemoImportError')<{ message: string }> {}

export type ImportEvent =
  | { type: 'metadata'; metadata: DemoMetadata; roundStartTicks: number[] }
  | { type: 'round'; round: ReplayRound }
  | { type: 'complete' }

export type ImportResult = ImportEvent | { type: 'error'; message: string }

export function importDemo(file: File): Stream.Stream<ImportEvent, DemoImportError> {
  return Stream.asyncPush<ImportEvent, DemoImportError>((emit) =>
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
      worker.onmessage = (event: MessageEvent<ImportResult>) => {
        const result = event.data
        if (result.type === 'error') emit.fail(new DemoImportError({ message: result.message }))
        else {
          emit.single(result)
          if (result.type === 'complete') emit.end()
        }
      }
      worker.onerror = worker.onmessageerror = () =>
        emit.fail(
          new DemoImportError({
            message: 'The demo reader stopped unexpectedly. Try importing the file again.',
          }),
        )
      yield* Effect.try({
        try: () => worker.postMessage(file),
        catch: () =>
          new DemoImportError({
            message: 'The demo could not be sent to the local reader. Try importing it again.',
          }),
      })
    }),
  )
}
