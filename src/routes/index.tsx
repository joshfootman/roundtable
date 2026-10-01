import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Cause, Effect, Exit, Option, Stream } from 'effect'
import { importDemo } from '../demo/import'
import { updateImport, type ImportState } from '../demo/session'
import { TacticalReplay } from '../replay/TacticalReplay'
import { mapDefinition } from '../replay/maps'

export const Route = createFileRoute('/')({ component: Home })

const emptyRoundStatus = {
  active: 'Reading the first competitive round…',
  complete: 'Parsing complete. No completed competitive rounds found.',
  failed: 'Parsing stopped. No completed competitive rounds found.',
}

function duration(seconds: number) {
  const centiseconds = Math.round(seconds * 100)
  return `${Math.floor(centiseconds / 6000)}m ${((centiseconds % 6000) / 100).toFixed(2)}s`
}

function Home() {
  const [state, setState] = useState<ImportState>({ status: 'empty' })
  const activeImport = useRef<AbortController | null>(null)

  useEffect(() => () => activeImport.current?.abort(), [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const file = new FormData(event.currentTarget).get('demo')
    if (!(file instanceof File) || !file.name) return

    activeImport.current?.abort()
    const controller = new AbortController()
    activeImport.current = controller
    const filename = file.name
    setState((state) => updateImport(state, { type: 'start', filename }))

    const result = await Effect.runPromiseExit(
      Stream.runForEach(importDemo(file), (event) =>
        Effect.sync(() => {
          if (!controller.signal.aborted) setState((state) => updateImport(state, event))
        }),
      ),
      { signal: controller.signal },
    )
    if (controller.signal.aborted) return
    activeImport.current = null
    if (Exit.isFailure(result)) {
      const message = result.cause.pipe(
        Cause.failureOption,
        Option.match({
          onSome: (error) => error.message,
          onNone: () => 'The demo reader stopped unexpectedly. Try importing the file again.',
        }),
      )
      setState((state) => updateImport(state, { type: 'failed', message }))
    }
  }

  const firstRound = state.status === 'ready' ? state.rounds[0] : undefined
  const selectedRound =
    state.status === 'ready'
      ? state.rounds.find((round) => round.startTick === state.selectedStartTick)
      : undefined
  const pendingRounds =
    state.status === 'ready' && state.parsing.status === 'active'
      ? [
          ...(state.discoveredRound ? [state.discoveredRound] : []),
          ...state.roundStartTicks
            .map((startTick, index) => ({ startTick, number: index + 1 }))
            .filter(
              (round) =>
                round.startTick >= (state.rounds.at(-1)?.endTick ?? 0) &&
                (!state.discoveredRound || round.number > state.discoveredRound.number),
            ),
        ]
      : []
  return (
    <main className="workspace">
      <header className="masthead">
        <a href="/" className="brand">
          ROUNDTABLE<span>CS2 DEMO VIEWER</span>
        </a>
        <span className="local-badge">Local files. Private by default.</span>
      </header>
      <section className="intro" aria-labelledby="import-title">
        <p className="eyebrow">START WITH A DEMO</p>
        <h1 id="import-title">Every match has a story.</h1>
        <p className="lede">
          Open a Counter-Strike 2 demo to inspect its players and replay its competitive rounds.
        </p>
        <form className="import-panel" onSubmit={handleSubmit}>
          <div>
            <h2>Import your demo</h2>
            <p>Your file stays on this device. Nothing is uploaded.</p>
          </div>
          <div className="import-controls">
            <label className="file-control">
              Choose a .dem file
              <input type="file" name="demo" accept=".dem" required />
            </label>
            <button type="submit">Import demo</button>
          </div>
        </form>
        <p className="file-hint">Have a ZIP or RAR download? Extract the .dem file first.</p>
      </section>
      <output aria-live="polite" className="import-status">
        {state.status === 'reading'
          ? `Reading ${state.filename}…`
          : state.status === 'ready'
            ? state.rounds.length
              ? `First round loaded. ${state.rounds.length} rounds available. ${state.parsing.status === 'active' ? 'Parsing continues…' : state.parsing.status === 'complete' ? 'Parsing complete.' : 'Parsing stopped.'}`
              : emptyRoundStatus[state.parsing.status]
            : ''}
      </output>
      {state.status === 'error' && (
        <section className="rounded-xl bg-[#38231f] p-6 text-[#ffdbcc]" role="alert">
          <h2 className="m-0 text-lg font-[550]">Unable to open this demo</h2>
          <p className="mt-2 text-sm [overflow-wrap:anywhere]">{state.filename}</p>
          <p className="mt-3 mb-0 text-sm leading-relaxed">{state.message}</p>
        </section>
      )}
      {state.status === 'ready' && (
        <section className="metadata-panel" aria-labelledby="metadata-title">
          <div className="metadata-heading">
            <div>
              <p className="eyebrow">DEMO METADATA</p>
              <h2 id="metadata-title">
                {mapDefinition(state.metadata.mapName)?.name ?? state.metadata.mapName}
              </h2>
            </div>
            <span className="recorded-badge">Imported</span>
          </div>
          <p className="filename">{state.filename}</p>
          <dl className="metadata-grid">
            {[
              ['Map identifier', state.metadata.mapName],
              ['Server', state.metadata.serverName],
              ['Recorded by', state.metadata.clientName],
              ['Recording duration', duration(state.metadata.durationSeconds)],
              ['Playback ticks', state.metadata.playbackTicks.toLocaleString('en-GB')],
              ['Playback frames', state.metadata.playbackFrames.toLocaleString('en-GB')],
              ['Patch version', state.metadata.patchVersion],
              ['Build number', state.metadata.buildNumber],
              ['Demo format', state.metadata.demoVersion],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="metadata-note">
            These values describe the recording. Teams, score and match date are not available in
            this metadata.
          </p>
        </section>
      )}
      {state.status === 'ready' && (
        <section
          aria-labelledby="rounds-title"
          className="mt-6 rounded-2xl border border-white/5 bg-[#17201a] p-[22px] text-[#e7ece8] sm:p-[30px]"
        >
          <h2 id="rounds-title" className="m-0 text-2xl font-[550]">
            Rounds
          </h2>
          {state.parsing.status === 'complete' && state.rounds.length === 0 && (
            <p className="mt-3 text-sm leading-relaxed text-[#a7b5aa]">
              No completed competitive rounds were found in this recording. Metadata remains
              available. Choose another demo to replay a round.
            </p>
          )}
          <ul className="mt-4 flex list-none flex-wrap gap-2 p-0">
            {state.rounds.map((round) => (
              <li key={round.startTick}>
                <button
                  type="button"
                  aria-pressed={round.startTick === state.selectedStartTick}
                  onClick={() =>
                    setState((state) =>
                      updateImport(state, { type: 'select-round', startTick: round.startTick }),
                    )
                  }
                  className="min-h-11 rounded-lg border border-[#303c34] px-4 py-3 outline-offset-4 focus-visible:outline-2 focus-visible:outline-[#bedb8a] aria-pressed:bg-[#bedb8a] aria-pressed:text-[#17201a]"
                >
                  Round {round.number} · Ready
                </button>
              </li>
            ))}
            {pendingRounds.map((round) => (
              <li key={round.startTick}>
                <button
                  type="button"
                  disabled
                  className="rounded-lg border border-[#303c34] px-4 py-3 text-[#a7b5aa] disabled:cursor-wait"
                >
                  Round {round.number} · Pending
                </button>
              </li>
            ))}
          </ul>
          {state.parsing.status === 'active' && state.roundStartTicks.length === 0 && (
            <p className="mt-3 text-sm text-[#a7b5aa]">
              Round count is not recorded. More rounds will appear as parsing continues.
            </p>
          )}
        </section>
      )}
      {firstRound && (
        <section
          aria-labelledby="roster-title"
          className="mt-6 rounded-2xl border border-white/5 bg-[#17201a] p-[22px] text-[#e7ece8] sm:p-[30px]"
        >
          <p className="mb-3 text-[11px] font-semibold tracking-[0.16em] text-[#bedb8a]">
            RECORDED PLAYERS
          </p>
          <h2 id="roster-title" className="m-0 text-2xl font-[550]">
            Player roster
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#a7b5aa]">
            {firstRound.players.length} players recorded in this demo.
          </p>
          <ul className="mt-6 grid list-none gap-3 p-0 sm:grid-cols-2">
            {firstRound.players.map((player) => (
              <li
                key={player.steamId}
                className="min-w-0 rounded-lg border border-[#303c34] bg-[#1b251e] px-4 py-3"
              >
                <p className="m-0 font-[550] [overflow-wrap:anywhere]">{player.name}</p>
                <p className="mt-2 mb-0 font-mono text-xs [overflow-wrap:anywhere] text-[#a7b5aa]">
                  Steam ID: {player.steamId}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {state.status === 'ready' && selectedRound && (
        <TacticalReplay round={selectedRound} mapName={state.metadata.mapName} />
      )}
      {state.status === 'ready' && state.parsing.status === 'failed' && (
        <p role="alert" className="mt-6 rounded-xl bg-[#38231f] p-6 text-[#ffdbcc]">
          Parsing stopped.{' '}
          {state.rounds.length > 0
            ? 'Completed round data remains available.'
            : 'No completed competitive rounds are available.'}{' '}
          {state.parsing.message}
        </p>
      )}
      <footer>Built for a closer look at Counter-Strike.</footer>
    </main>
  )
}
