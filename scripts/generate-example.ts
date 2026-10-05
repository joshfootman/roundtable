import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, open, readFile, rename, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { Effect, Schema, Stream } from 'effect'
import { readDemoMetadata, DemoReadError } from '../src/demo/metadata.ts'
import { readRounds } from '../src/demo/round.ts'
import { encodeRound, decodeRound } from '../src/demo/replay-codec.ts'
import { ExampleManifest } from '../src/demo/example.ts'
import { defaultExampleId, examples, parseExampleId } from '../src/demo/examples.ts'
import type { ExampleId } from '../src/demo/examples.ts'

const args = process.argv.slice(2)
const force = args.includes('--force')
const selection = args.find((arg) => arg !== '--force') ?? defaultExampleId
const id = parseExampleId(basename(selection).replace(/\.dem$/, ''))
if (selection !== '--all' && id === undefined)
  throw new Error('Choose an accepted example ID or filename.')
const ids: ExampleId[] = selection === '--all' ? (Object.keys(examples) as ExampleId[]) : [id!]
const io = <T>(run: () => Promise<T>) =>
  Effect.tryPromise({ try: run, catch: (error) => new DemoReadError({ message: String(error) }) })

for (const id of ids) {
  const example = examples[id]
  const sourcePath =
    selection.includes('/') && selection !== '--all'
      ? resolve(selection)
      : `fixtures/local/${example.filename}`
  const directory = `public${example.assetBase}`
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(sourcePath)) hash.update(chunk)
  const sourceHash = hash.digest('hex')
  assert.equal(sourceHash, example.sourceSha256, `Unverified source recording ${example.filename}`)
  try {
    if (force) throw new Error('Regeneration requested.')
    const existing = Schema.decodeUnknownSync(ExampleManifest)(
      JSON.parse(await readFile(`${directory}/manifest.json`, 'utf8')),
    )
    assert.equal(existing.source.filename, example.filename)
    assert.equal(existing.source.sha256, sourceHash)
    assert.equal(existing.source.match, example.sourceUrl)
    assert.equal(existing.metadata.mapName, example.map)
    assert.equal(existing.rounds.length, example.roundCount)
    for (const descriptor of existing.rounds) {
      const compressed = await readFile(`${directory}/${descriptor.path}`)
      assert.equal(compressed.byteLength, descriptor.compressedBytes)
      const decoded = new Uint8Array(gunzipSync(compressed))
      assert.equal(decoded.byteLength, descriptor.decodedBytes)
      assert.equal(createHash('sha256').update(decoded).digest('hex'), descriptor.sha256)
      const round = decodeRound(decoded.buffer)
      assert.equal(round.number, descriptor.number)
      assert.equal(round.startTick, descriptor.startTick)
    }
    console.log(`Reused ${id}, ${existing.rounds.length} verified archives`)
    continue
  } catch {
    console.log(`Generating ${id}`)
  }
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const file = yield* Effect.acquireRelease(
          io(() => open(sourcePath, 'r')),
          (handle) => Effect.promise(() => handle.close()),
        )
        const { size } = yield* io(() => file.stat())
        const source = {
          size,
          readRange: (offset: number, length: number) =>
            io(async () => {
              const bytes = new Uint8Array(length)
              const { bytesRead } = await file.read(bytes, 0, length, offset)
              return bytes.subarray(0, bytesRead)
            }),
        }
        const metadata = yield* readDemoMetadata(source)
        assert.equal(metadata.mapName, example.map)
        yield* io(() => mkdir(directory, { recursive: true }))
        const rounds: {
          number: number
          startTick: number
          path: string
          compressedBytes: number
          decodedBytes: number
          sha256: string
        }[] = []
        yield* readRounds(source).pipe(
          Stream.runForEach((round) =>
            io(async () => {
              const buffer = encodeRound(round)
              const decoded = decodeRound(buffer)
              assert.equal(decoded.number, round.number)
              assert.equal(decoded.startTick, round.startTick)
              assert.ok(round.outcome, `Missing recorded outcome for ${id} round ${round.number}`)
              assert.deepEqual(decoded.outcome, round.outcome)
              assert.deepEqual(decoded.teamNames, round.teamNames)
              assert.ok(
                round.inspection.every((track) =>
                  track.every((state) => typeof state.onLadder === 'boolean'),
                ),
                `Missing recorded movement state for ${id} round ${round.number}`,
              )
              assert.deepEqual(decoded.inspection, round.inspection)
              const compressed = gzipSync(new Uint8Array(buffer))
              const path = `round-${round.number}.rpl`
              await writeFile(`${directory}/${path}.tmp`, compressed)
              await rename(`${directory}/${path}.tmp`, `${directory}/${path}`)
              rounds.push({
                number: round.number,
                startTick: round.startTick,
                path,
                compressedBytes: compressed.byteLength,
                decodedBytes: buffer.byteLength,
                sha256: createHash('sha256').update(new Uint8Array(buffer)).digest('hex'),
              })
              console.log(`${id} round ${round.number}, ${compressed.byteLength} bytes`)
            }),
          ),
        )
        assert.equal(rounds.length, example.roundCount)
        const manifest = Schema.decodeUnknownSync(ExampleManifest)({
          formatVersion: 1,
          source: { filename: example.filename, sha256: sourceHash, match: example.sourceUrl },
          metadata,
          rounds,
        })
        yield* io(async () => {
          await writeFile(
            `${directory}/manifest.json.tmp`,
            JSON.stringify(manifest, null, 2) + '\n',
          )
          await rename(`${directory}/manifest.json.tmp`, `${directory}/manifest.json`)
        })
      }),
    ),
  )
}
