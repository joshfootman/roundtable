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

test('fetches the linked round first and holds later rounds until released', async () => {
  const manifest: Manifest = JSON.parse(await readFile('public/example/manifest.json', 'utf8'))
  const assets = new Map<string, BodyInit>([
    ['manifest.json', JSON.stringify(manifest)],
    ...(await Promise.all(
      (manifest.rounds as { path: string }[]).map(
        async (round) =>
          [round.path, new Uint8Array(await readFile(`public/example/${round.path}`))] as const,
      ),
    )),
  ])
  const requested: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const path = url.split('/').pop()!
      requested.push(path)
      return new Response(assets.get(path)!)
    }),
  )
  let release!: () => void
  const ready = new Promise<void>((resolve) => (release = resolve))
  const rounds: number[] = []
  const run = Effect.runPromise(
    Stream.runForEach(
      importExample(defaultExampleId, { first: 2, ready }).pipe(
        Stream.takeUntil(() => rounds.length === 3),
      ),
      (event) =>
        Effect.sync(() => {
          if (event.type === 'round') rounds.push(event.round.number)
        }),
    ).pipe(Effect.either),
  )
  await vi.waitFor(() => expect(rounds).toEqual([2]))
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(requested).toEqual(['manifest.json', 'round-2.rpl'])
  release()
  await run
  expect(rounds.slice(0, 3)).toEqual([2, 1, 3])
})
