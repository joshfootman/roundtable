import { Cause, Effect, Exit, Option, Stream } from 'effect'
import { importDemo, type ImportEvent, type DemoImportError } from './import'
import { importExample } from './example'
import { defaultExampleId, examples } from './examples'
import type { ExampleId } from './examples'
import { updateImport, type ImportState, type ImportAction } from './session'

export type ReplaySource = { kind: 'local' } | { kind: 'example'; id: ExampleId }

export class ReplaySession {
  private snapshot: { state: ImportState; source: ReplaySource | undefined } = {
    state: { status: 'empty' },
    source: undefined,
  }
  private listeners = new Set<() => void>()
  private controller: AbortController | undefined
  private requestedRound: number | undefined
  private releaseLaterRounds: (() => void) | undefined

  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private update(action: ImportAction) {
    let state = updateImport(this.snapshot.state, action)
    if (state.status === 'ready' && this.requestedRound !== undefined) {
      const round = state.rounds.find((round) => round.number === this.requestedRound)
      if (round) state = updateImport(state, { type: 'select-round', startTick: round.startTick })
    }
    this.snapshot = { ...this.snapshot, state }
    for (const listener of this.listeners) listener()
  }

  restore(source: 'local' | 'example', round?: number, example: ExampleId = defaultExampleId) {
    this.requestedRound = round ?? 1
    const current = this.snapshot.source
    if (source === 'example') {
      if (current?.kind !== 'example' || current.id !== example) {
        const descriptor = examples[example]
        this.open(descriptor.filename, { kind: 'example', id: example }, this.example(example))
      } else this.selectRound(round ?? 1)
    } else {
      if (current?.kind !== 'local') {
        this.controller?.abort()
        this.controller = undefined
        this.snapshot = { state: { status: 'empty' }, source: { kind: 'local' } }
      }
      this.selectRound(round ?? 1)
    }
  }

  openExample(id: ExampleId = defaultExampleId) {
    this.requestedRound = undefined
    this.open(examples[id].filename, { kind: 'example', id }, this.example(id))
  }

  openFile(file: File) {
    if (this.snapshot.state.status !== 'empty') this.requestedRound = undefined
    this.open(file.name, { kind: 'local' }, importDemo(file))
    return this.requestedRound
  }

  /** The shown round can play; later example rounds may download now. */
  roundPlayable = () => {
    this.releaseLaterRounds?.()
  }

  private example(id: ExampleId) {
    let resolve!: () => void
    const promise = new Promise<void>((done) => (resolve = done))
    // Stream the rest anyway if the view never reports the first round, e.g. a hidden tab.
    const fallback = setTimeout(resolve, 3000)
    this.releaseLaterRounds = () => {
      clearTimeout(fallback)
      resolve()
    }
    return importExample(id, { first: this.requestedRound ?? 1, ready: promise })
  }

  selectRound(number: number) {
    this.requestedRound = number
    const state = this.snapshot.state
    const round =
      state.status === 'ready' ? state.rounds.find((round) => round.number === number) : undefined
    if (round) this.update({ type: 'select-round', startTick: round.startTick })
    else for (const listener of this.listeners) listener()
  }

  cancel = () => {
    this.controller?.abort()
    this.controller = undefined
    this.update({ type: 'cancel' })
  }

  clear = () => {
    this.controller?.abort()
    this.controller = undefined
    this.requestedRound = undefined
    this.snapshot = { state: { status: 'empty' }, source: undefined }
    for (const listener of this.listeners) listener()
  }

  dispose() {
    this.controller?.abort()
    this.controller = undefined
    this.listeners.clear()
    this.snapshot = { state: { status: 'empty' }, source: undefined }
    this.requestedRound = undefined
  }

  private open(
    filename: string,
    source: ReplaySource,
    events: Stream.Stream<ImportEvent, DemoImportError>,
  ) {
    this.controller?.abort()
    const controller = new AbortController()
    this.controller = controller
    this.snapshot = { ...this.snapshot, source }
    this.update({ type: 'start', filename })
    void Effect.runPromiseExit(
      Stream.runForEach(events, (event) =>
        Effect.sync(() => {
          if (!controller.signal.aborted) this.update(event)
        }),
      ),
      { signal: controller.signal },
    ).then((result) => {
      if (controller.signal.aborted) return
      this.controller = undefined
      if (Exit.isFailure(result)) {
        const message = result.cause.pipe(
          Cause.failureOption,
          Option.match({
            onSome: (error) => error.message,
            onNone: () => 'The demo reader stopped unexpectedly. Try importing the file again.',
          }),
        )
        this.update({ type: 'failed', message })
      }
    })
  }
}
