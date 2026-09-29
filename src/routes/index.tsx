import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Effect, Exit } from 'effect'
import { importDemo } from '../demo/import'
import type { DemoMetadata } from '../demo/metadata'

export const Route = createFileRoute('/')({ component: Home })

type ImportState =
  | { status: 'empty' }
  | { status: 'reading'; filename: string }
  | { status: 'ready'; filename: string; metadata: DemoMetadata }
  | { status: 'error'; filename: string; message: string }

function duration(seconds: number | null) {
  if (seconds === null) return 'Not recorded'
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
    setState({ status: 'reading', filename })

    const result = await Effect.runPromiseExit(
      importDemo(file).pipe(
        Effect.match({
          onFailure: (error): ImportState => ({
            status: 'error',
            filename,
            message: error.message,
          }),
          onSuccess: (metadata): ImportState => ({ status: 'ready', filename, metadata }),
        }),
      ),
      { signal: controller.signal },
    )
    if (controller.signal.aborted) return
    activeImport.current = null
    setState(
      Exit.isSuccess(result)
        ? result.value
        : {
            status: 'error',
            filename,
            message: 'The demo reader stopped unexpectedly. Try importing the file again.',
          },
    )
  }

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
        <p className="lede">Open a Counter-Strike 2 demo to inspect its recorded metadata.</p>
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
            ? 'Demo metadata loaded.'
            : ''}
      </output>
      {state.status === 'error' && (
        <section className="error-panel" role="alert">
          <h2>Unable to open this demo</h2>
          <p>{state.message}</p>
        </section>
      )}
      {state.status === 'ready' && (
        <section className="metadata-panel" aria-labelledby="metadata-title">
          <div className="metadata-heading">
            <div>
              <p className="eyebrow">DEMO METADATA</p>
              <h2 id="metadata-title">
                {state.metadata.mapName === 'de_dust2'
                  ? 'Dust II'
                  : (state.metadata.mapName ?? 'Map not recorded')}
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
              ['Playback ticks', state.metadata.playbackTicks?.toLocaleString('en-GB')],
              ['Playback frames', state.metadata.playbackFrames?.toLocaleString('en-GB')],
              ['Patch version', state.metadata.patchVersion],
              ['Build number', state.metadata.buildNumber],
              ['Demo format', state.metadata.demoVersion],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value ?? 'Not recorded'}</dd>
              </div>
            ))}
          </dl>
          <p className="metadata-note">
            These values describe the recording. Teams, score and match date are not available in
            this metadata.
          </p>
        </section>
      )}
      <footer>Built for a closer look at Counter-Strike.</footer>
    </main>
  )
}
