import { Data } from 'effect'

export class DemoUnsupportedError extends Data.TaggedError('DemoUnsupportedError')<{
  reason: 'empty' | 'archive' | 'source1' | 'unknown-format' | 'other-game'
  message: string
}> {}
export class DemoReadError extends Data.TaggedError('DemoReadError')<{ message: string }> {}
export class DemoParseError extends Data.TaggedError('DemoParseError')<{ message: string }> {}

export function memoryFailureMessage(error: unknown): string | undefined {
  if (
    error instanceof RangeError &&
    /out of memory|array buffer allocation failed|arraybuffer allocation failed|failed to allocate memory/i.test(
      error.message,
    )
  )
    return 'The browser ran out of memory while reading this demo. Close other tabs or choose a shorter recording.'
  return undefined
}
