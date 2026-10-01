import { Effect } from 'effect'
import { expect, test, vi } from 'vitest'
import { fileSource } from './file-source'

test('retries transient file reads up to three attempts and preserves the requested bytes', async () => {
  const file = new Blob([new Uint8Array([10, 20, 30, 40, 50])])
  const read = vi.spyOn(Blob.prototype, 'arrayBuffer')
  try {
    read
      .mockRejectedValueOnce(new DOMException('Busy', 'NotReadableError'))
      .mockRejectedValueOnce(new DOMException('Busy', 'NotReadableError'))
    await expect(Effect.runPromise(fileSource(file).readRange(1, 3))).resolves.toEqual(
      new Uint8Array([20, 30, 40]),
    )
    expect(read).toHaveBeenCalledTimes(3)

    read.mockClear().mockRejectedValue(new DOMException('Busy', 'NotReadableError'))
    await expect(
      Effect.runPromise(Effect.either(fileSource(file).readRange(1, 3))),
    ).resolves.toMatchObject({
      _tag: 'Left',
      left: { _tag: 'DemoReadError', message: 'The demo file could not be read. Select it again.' },
    })
    expect(read).toHaveBeenCalledTimes(3)

    read.mockClear().mockRejectedValue(new DOMException('Denied', 'SecurityError'))
    await expect(
      Effect.runPromise(Effect.either(fileSource(file).readRange(1, 3))),
    ).resolves.toMatchObject({
      _tag: 'Left',
      left: { _tag: 'DemoReadError', message: 'The demo file could not be read. Select it again.' },
    })
    expect(read).toHaveBeenCalledTimes(1)
  } finally {
    read.mockRestore()
  }
})
