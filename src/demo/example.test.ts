import { readFile } from 'node:fs/promises'
import { Effect, Either, Stream } from 'effect'
import { afterEach, expect, test, vi } from 'vitest'
import { importExample } from './example'
import { defaultExampleId, parseExampleId } from './examples'
import type { ImportEvent } from './import'

afterEach(() => vi.unstubAllGlobals())

test.each([
  [
    'filename',
    (manifest: Manifest) => {
      manifest.source.filename = 'different.dem'
    },
  ],
  [
    'source hash',
    (manifest: Manifest) => {
      manifest.source.sha256 = 'a'.repeat(64)
    },
  ],
  [
    'source match',
    (manifest: Manifest) => {
      manifest.source.match = 'https://example.com/another-match'
    },
  ],
  [
    'map',
    (manifest: Manifest) => {
      manifest.metadata.mapName = 'de_nuke'
    },
  ],
  [
    'round count',
    (manifest: Manifest) => {
      manifest.rounds.pop()
    },
  ],
] as const)(
  'rejects a manifest with a different %s before emitting playback data',
  async (_name, mutate) => {
    const manifest: Manifest = JSON.parse(await readFile('public/example/manifest.json', 'utf8'))
    mutate(manifest)
    const fetch = vi.fn(async () => new Response(JSON.stringify(manifest)))
    vi.stubGlobal('fetch', fetch)
    const events: ImportEvent[] = []

    const result = await Effect.runPromise(
      Stream.runForEach(importExample(defaultExampleId), (event) =>
        Effect.sync(() => {
          events.push(event)
        }),
      ).pipe(Effect.either),
    )

    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result))
      expect(result.left.message).toBe(
        'The example manifest does not match the selected recording.',
      )
    expect(events).toEqual([])
    expect(fetch).toHaveBeenCalledTimes(1)
  },
)

test.each([123, 'missing-example', '__proto__'])('rejects unknown example identity %s', (value) => {
  expect(parseExampleId(value)).toBeUndefined()
})

test('accepts a supported example identity', () => {
  expect(parseExampleId('faze-vs-vitality-m2-dust2')).toBe('faze-vs-vitality-m2-dust2')
})

type Manifest = {
  source: { filename: string; sha256: string; match: string }
  metadata: { mapName: string }
  rounds: unknown[]
}
