import { Data } from 'effect'

export class DemoUnsupportedError extends Data.TaggedError('DemoUnsupportedError')<{
  reason: 'empty' | 'archive' | 'source1' | 'unknown-format' | 'other-game'
  message: string
}> {}
export class DemoReadError extends Data.TaggedError('DemoReadError')<{ message: string }> {}
export class DemoParseError extends Data.TaggedError('DemoParseError')<{ message: string }> {}
