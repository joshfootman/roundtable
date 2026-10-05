import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { open, readFile, mkdir, writeFile } from 'node:fs/promises'
import { cpus, platform, release, totalmem } from 'node:os'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { Effect, Stream } from 'effect'
import { DemoReadError } from '../src/demo/errors.ts'
import { encodeRound } from '../src/demo/replay-codec.ts'
import { readReplay } from '../src/demo/round.ts'
import type { DemoSource } from '../src/demo/source.ts'

const arguments_ = process.argv.slice(2)
const verificationOnly = arguments_.includes('--verify-only')
if (verificationOnly) arguments_.splice(arguments_.indexOf('--verify-only'), 1)
function option(name: string, fallback: string) {
  const index = arguments_.indexOf(name)
  if (index === -1) return fallback
  const value = arguments_[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}.`)
  arguments_.splice(index, 2)
  return value
}
const baselineDirectory = option('--baseline', '')
const candidateDirectory = option('--candidate', '')
const repetitions = Number(option('--runs', '3'))
const output = option('--output', 'test-results/parser-performance/parser-comparison.json')
if (!Number.isSafeInteger(repetitions) || repetitions < 1)
  throw new Error('The run count must be a positive integer.')
if (arguments_.some((argument) => argument.startsWith('--')))
  throw new Error('Unknown parser benchmark option.')
const paths = arguments_.length
  ? arguments_
  : [
      'fixtures/replay/dust2-through-round-4.dem.gz',
      'fixtures/replay/anubis-2026-first-round.dem.gz',
    ]
const candidate: Pick<typeof import('../src/demo/round.ts'), 'readReplay'> = candidateDirectory
  ? await import(pathToFileURL(resolve(candidateDirectory, 'round.ts')).href)
  : { readReplay }
const variants = [{ name: 'current', readReplay: candidate.readReplay }]
if (baselineDirectory) {
  const baseline: typeof import('../src/demo/round.ts') = await import(
    pathToFileURL(resolve(baselineDirectory, 'round.ts')).href
  )
  variants.unshift({ name: 'baseline', readReplay: baseline.readReplay })
}
const sourceVersions = await Promise.all(
  variants.map(async (variant) => {
    const directory = resolve(
      variant.name === 'baseline' ? baselineDirectory : candidateDirectory || 'src/demo',
    )
    const hash = createHash('sha256')
    for (const file of [
      'round.ts',
      'round-lifecycle.ts',
      'projectiles.ts',
      'source.ts',
      'entities/bit-reader.ts',
      'entities/field-decoder.ts',
      'entities/field-path.ts',
      'entities/serializers.ts',
      'entities/index.ts',
    ]) {
      hash.update(file)
      hash.update(await readFile(resolve(directory, file)))
    }
    return { variant: variant.name, sha256: hash.digest('hex') }
  }),
)
const fixtures = await Promise.all(
  paths.map(async (path) => ({
    path,
    bytes: path.endsWith('.gz') ? new Uint8Array(gunzipSync(await readFile(path))) : undefined,
    rounds: path.endsWith('dust2-through-round-4.dem.gz')
      ? 4
      : path.endsWith('first-round.dem.gz')
        ? 1
        : undefined,
  })),
)
type Observation = {
  variant: string
  path: string
  firstRoundMs: number
  allRoundsMs: number
  rounds: number
  sourceBytes: number
  bytesRead: number
  outputSha256: string
}
const expected = new Map<string, { rounds: number; hash: string }>()
async function measure(variant: (typeof variants)[number], fixture: (typeof fixtures)[number]) {
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const io = <T>(run: () => Promise<T>) =>
          Effect.tryPromise({
            try: run,
            catch: (error) => new DemoReadError({ message: String(error) }),
          })
        let bytesRead = 0
        let source: DemoSource
        if (fixture.bytes) {
          const bytes = fixture.bytes
          source = {
            size: bytes.length,
            readRange: (offset, length) =>
              Effect.sync(() => {
                bytesRead += length
                return bytes.subarray(offset, offset + length)
              }),
          }
        } else {
          const file = yield* Effect.acquireRelease(
            io(() => open(fixture.path, 'r')),
            (handle) => Effect.promise(() => handle.close()),
          )
          const { size } = yield* io(() => file.stat())
          source = {
            size,
            readRange: (offset, length) =>
              io(async () => {
                const bytes = new Uint8Array(length)
                const result = await file.read(bytes, 0, length, offset)
                bytesRead += result.bytesRead
                return bytes.subarray(0, result.bytesRead)
              }),
          }
        }
        const hash = createHash('sha256')
        let rounds = 0
        let firstRoundMs = 0
        let fingerprintMs = 0
        const started = performance.now()
        let replay = variant.readReplay(source)
        if (fixture.rounds !== undefined) {
          const limit = fixture.rounds
          replay = replay.pipe(
            Stream.takeUntil((event) => event.type === 'round' && ++rounds === limit),
          )
        }
        let completed = 0
        yield* Stream.runForEach(replay, (event) =>
          Effect.sync(() => {
            if (event.type === 'round' && completed++ === 0)
              firstRoundMs = performance.now() - started - fingerprintMs
            const fingerprintStarted = performance.now()
            hash.update(event.type)
            if (event.type === 'round') hash.update(new Uint8Array(encodeRound(event.round)))
            else hash.update(JSON.stringify(event))
            fingerprintMs += performance.now() - fingerprintStarted
          }),
        )
        const observation: Observation = {
          variant: variant.name,
          path: fixture.path,
          firstRoundMs,
          allRoundsMs: performance.now() - started - fingerprintMs,
          rounds: completed,
          sourceBytes: source.size,
          bytesRead,
          outputSha256: hash.digest('hex'),
        }
        assert.ok(completed > 0, `No completed rounds in ${fixture.path}.`)
        if (fixture.rounds !== undefined) assert.equal(completed, fixture.rounds)
        const prior = expected.get(fixture.path)
        if (prior) {
          assert.equal(completed, prior.rounds, `Round count changed for ${fixture.path}.`)
          assert.equal(
            observation.outputSha256,
            prior.hash,
            `Replay output changed for ${fixture.path}.`,
          )
        } else expected.set(fixture.path, { rounds: completed, hash: observation.outputSha256 })
        return observation
      }),
    ),
  )
}
const observations: Observation[] = []
for (const fixture of fixtures) {
  if (!verificationOnly) for (const variant of variants) await measure(variant, fixture)
  for (let run = 0; run < (verificationOnly ? 1 : repetitions); run++) {
    const order = run % 2 ? [...variants].reverse() : variants
    for (const variant of order) {
      const observation = await measure(variant, fixture)
      observations.push(observation)
      console.log(JSON.stringify({ run: run + 1, ...observation }))
    }
  }
}
const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!
const summaries = fixtures.flatMap((fixture) =>
  variants.map((variant) => {
    const runs = observations.filter(
      (run) => run.path === fixture.path && run.variant === variant.name,
    )
    return {
      path: fixture.path,
      variant: variant.name,
      firstRoundMedianMs: median(runs.map((run) => run.firstRoundMs)),
      allRoundsMedianMs: median(runs.map((run) => run.allRoundsMs)),
    }
  }),
)
const report = {
  recordedAt: new Date().toISOString(),
  environment: {
    cpu: cpus()[0]?.model,
    platform: platform(),
    release: release(),
    memoryBytes: totalmem(),
    node: process.version,
  },
  method: verificationOnly
    ? 'One verification per variant and fixture without warmup. Timings are diagnostic only. Full replay event and round fingerprints must match.'
    : 'One warmup per variant and fixture. Sequential paired runs alternate order. Gzip fixtures are expanded before timing. Replay serialization and hashing are excluded from parse time. Full replay event and round fingerprints must match.',
  baselineDirectory: baselineDirectory || undefined,
  candidateDirectory: candidateDirectory || undefined,
  sourceVersions,
  repetitions: verificationOnly ? 1 : repetitions,
  verificationOnly,
  observations,
  summaries,
}
await mkdir(dirname(output), { recursive: true })
await writeFile(output, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ output, summaries }))
