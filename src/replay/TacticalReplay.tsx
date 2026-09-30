import { useEffect, useRef, useState } from 'react'
import { Application, Assets, Container, Graphics, Sprite, Text } from 'pixi.js'
import { sampleAtTick } from './frames'
import { mapDefinition, worldToMap, type MapDefinition } from './maps'
import type { ReplayRound } from './types'

interface Playback {
  play(): void
  pause(): void
  seek(tick: number): void
  setMinimum(tick: number): void
}

type SceneState =
  | { status: 'loading' }
  | { status: 'ready'; playing: boolean; tick: number; sample: number }
  | { status: 'error' }

function playbackTime(seconds: number) {
  const wholeSeconds = Math.floor(seconds)
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`
}

export function TacticalReplay({ round, mapName }: { round: ReplayRound; mapName: string }) {
  const map = mapDefinition(mapName)
  if (!map)
    return (
      <section className="mt-6 rounded-2xl bg-[#17201a] p-6 text-[#e7ece8]">
        <h2 className="text-xl font-semibold">Map imagery unavailable</h2>
        <p className="mt-3 text-sm leading-relaxed text-[#a7b5aa]">
          A calibrated radar is not registered for {mapName}. Metadata and the player roster remain
          available.
        </p>
      </section>
    )
  return <RoundReplay key={`${mapName}:${round.startTick}`} round={round} map={map} />
}

function RoundReplay({ round, map }: { round: ReplayRound; map: MapDefinition }) {
  const host = useRef<HTMLDivElement>(null)
  const playback = useRef<Playback | null>(null)
  const [includeFreezeTime, setIncludeFreezeTime] = useState(false)
  const [scene, setScene] = useState<SceneState>({ status: 'loading' })

  useEffect(() => {
    const element = host.current!
    const app = new Application()
    let cancelled = false
    let initialized = false
    let observer: ResizeObserver | undefined
    let tick = round.startTick
    let minimum = round.liveStartTick
    let playing = false
    let lastPublished = 0

    async function mount() {
      await app.init({
        width: map.imageSize,
        height: map.imageSize,
        background: '#101713',
        resolution: Math.min(window.devicePixelRatio, 2),
        autoDensity: true,
        autoStart: false,
        preference: 'webgl',
      })
      initialized = true
      if (cancelled) {
        app.destroy(true, { children: true })
        return
      }
      const texture = await Assets.load(map.image)
      if (cancelled) return
      const sceneMap = new Container()
      sceneMap.addChild(new Sprite(texture))
      const markers = round.players.map((_, index) => {
        const marker = new Container()
        const body = new Graphics().circle(0, 0, 10).fill('#ffffff').stroke({
          color: '#101713',
          width: 2,
        })
        marker.addChild(body)
        const direction = new Graphics()
          .poly([10, -5, 23, 0, 10, 5])
          .fill('#ffffff')
          .stroke({ color: '#101713', width: 2 })
        marker.addChild(direction)
        const label = new Text({
          text: String(index + 1),
          style: {
            fontFamily: 'sans-serif',
            fontSize: 12,
            fontWeight: 'bold',
            fill: '#101713',
          },
        })
        label.anchor.set(0.5)
        marker.addChild(label)
        sceneMap.addChild(marker)
        return { container: marker, body, direction }
      })
      app.stage.addChild(sceneMap)
      app.canvas.setAttribute('aria-hidden', 'true')
      element.appendChild(app.canvas)

      function draw() {
        const sample = sampleAtTick(round.ticks, tick)
        for (let player = 0; player < markers.length; player++) {
          const position = (sample * markers.length + player) * 3
          const point = worldToMap(map, round.positions[position]!, round.positions[position + 1]!)
          const { container, body, direction } = markers[player]!
          const state = sample * markers.length + player
          const color = round.teams[state] === 3 ? '#8dc5ff' : '#ffd08a'
          body.tint = color
          direction.tint = color
          direction.rotation = (-round.yaw[state]! * Math.PI) / 180
          container.position.set(point.x, point.y)
          container.alpha = round.alive[sample * markers.length + player] ? 1 : 0.35
        }
        return sample
      }
      function publish(sample: number) {
        setScene({ status: 'ready', playing, tick: Math.floor(tick), sample })
        lastPublished = performance.now()
      }
      function pause(sample = draw()) {
        playing = false
        app.ticker.stop()
        publish(sample)
        app.render()
      }
      playback.current = {
        setMinimum(nextMinimum) {
          minimum = nextMinimum
          tick = Math.max(minimum, tick)
          publish(draw())
          app.render()
        },
        play() {
          if (tick < minimum || tick >= round.endTick) tick = minimum
          playing = true
          publish(draw())
          app.ticker.start()
        },
        pause,
        seek(nextTick) {
          tick = Math.max(minimum, Math.min(round.endTick, nextTick))
          if (tick === round.endTick) pause()
          else {
            publish(draw())
            app.render()
          }
        },
      }
      app.ticker.add((clock) => {
        tick = Math.min(round.endTick, tick + clock.elapsedMS / (round.tickInterval * 1000))
        const sample = draw()
        if (tick >= round.endTick) pause(sample)
        else if (performance.now() - lastPublished >= 250) publish(sample)
      })
      observer = new ResizeObserver(() => {
        const width = element.clientWidth
        app.renderer.resize(width, width)
        sceneMap.scale.set(width / map.imageSize)
        for (const { container } of markers) container.scale.set((map.imageSize * 0.8) / width)
        app.render()
      })
      observer.observe(element)
      publish(draw())
      app.render()
    }
    void mount().catch(() => {
      if (!cancelled) {
        playback.current = null
        observer?.disconnect()
        if (initialized) app.destroy(true, { children: true })
        initialized = false
        setScene({ status: 'error' })
      }
    })
    return () => {
      cancelled = true
      playback.current = null
      observer?.disconnect()
      if (initialized) app.destroy(true, { children: true })
    }
  }, [round, map])

  const sample = scene.status === 'ready' ? scene.sample : 0
  const minimum = includeFreezeTime ? round.startTick : round.liveStartTick
  const recordedTick = scene.status === 'ready' ? scene.tick : round.startTick
  const phase =
    recordedTick < round.liveStartTick
      ? 'Freeze time'
      : recordedTick < round.resultTick
        ? 'Live'
        : 'Post-round'
  const tick = Math.max(minimum, recordedTick)
  const elapsed = playbackTime((tick - minimum) * round.tickInterval)
  const duration = playbackTime((round.endTick - minimum) * round.tickInterval)
  return (
    <section
      className="mt-6 rounded-2xl bg-[#17201a] p-5 text-[#e7ece8] sm:p-8"
      aria-labelledby="replay-title"
    >
      <p className="mb-3 text-[11px] font-semibold tracking-[0.16em] text-[#bedb8a]">
        RECORDED MOVEMENT
      </p>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="replay-title" className="m-0 text-2xl font-semibold">
          {map.name} · Round {round.number}
          {round.overtime > 0 && ` · Overtime ${round.overtime}`}
        </h2>
        <button
          type="button"
          disabled={scene.status !== 'ready'}
          aria-pressed={scene.status === 'ready' && scene.playing}
          className="min-h-11 min-w-24 rounded-lg bg-[#bedb8a] px-5 py-2 font-semibold text-[#17201a] outline-offset-4 focus-visible:outline-2 focus-visible:outline-[#bedb8a] disabled:opacity-50"
          onClick={() =>
            scene.status === 'ready' &&
            (scene.playing ? playback.current?.pause() : playback.current?.play())
          }
        >
          {scene.status === 'ready' && scene.playing ? 'Pause' : 'Play'}
        </button>
      </div>
      <p className="mt-3 text-sm text-[#a7b5aa]">
        Player numbers match the list below. Blue is Counter-Terrorists; gold is Terrorists.
      </p>
      {scene.status === 'error' && (
        <p role="alert" className="mt-4 text-[#ffdbcc]">
          The tactical map could not load. Reload the page and import the demo again.
        </p>
      )}
      {scene.status === 'loading' && <p className="mt-4 text-sm">Loading tactical map…</p>}
      <div
        ref={host}
        className="mt-5 aspect-square w-full overflow-hidden rounded-xl outline outline-white/10"
      />
      <label className="mt-4 flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={includeFreezeTime}
          disabled={scene.status !== 'ready'}
          className="size-4 accent-[#bedb8a]"
          onChange={(event) => {
            const include = event.currentTarget.checked
            setIncludeFreezeTime(include)
            playback.current?.setMinimum(include ? round.startTick : round.liveStartTick)
          }}
        />
        Include freeze time
      </label>
      <p aria-label="Round phase" className="mt-2 text-sm text-[#a7b5aa]">
        {phase}
      </p>
      <p
        aria-label="Replay time"
        data-testid="replay-tick"
        data-tick={recordedTick}
        className="mt-4 font-mono text-sm text-[#a7b5aa] tabular-nums"
      >
        {elapsed}
        {' / '}
        {duration}
      </p>
      <label className="mt-3 block text-sm font-semibold">
        Replay position
        <input
          type="range"
          min={minimum}
          max={round.endTick}
          step={1}
          value={tick}
          disabled={scene.status !== 'ready'}
          aria-valuetext={`${elapsed} of ${duration}`}
          className="block min-h-11 w-full cursor-pointer accent-[#bedb8a] outline-offset-4 focus-visible:outline-2 focus-visible:outline-[#bedb8a] disabled:cursor-default disabled:opacity-50"
          onChange={(event) => playback.current?.seek(event.currentTarget.valueAsNumber)}
        />
      </label>
      <details className="mt-5" open>
        <summary className="cursor-pointer py-2 font-semibold">Recorded player positions</summary>
        <p className="mt-2 text-xs leading-relaxed text-[#a7b5aa]">
          World coordinates at the current recorded sample. Starting positions are shown first.
          Enable freeze time to play from the round’s recorded start.
        </p>
        <ul className="mt-4 grid list-none gap-3 p-0 sm:grid-cols-2">
          {round.players.map((player, index) => {
            const state = sample * round.players.length + index
            const offset = state * 3
            return (
              <li key={player.steamId} className="rounded-lg bg-[#1b251e] p-3">
                <p className="m-0 text-sm font-semibold">
                  {index + 1}. {player.name}{' '}
                  <span className="font-normal text-[#a7b5aa]">
                    · {round.teams[state] === 3 ? 'Counter-Terrorists' : 'Terrorists'}
                  </span>
                </p>
                <p className="mt-2 mb-0 font-mono text-xs text-[#a7b5aa] tabular-nums">
                  X {round.positions[offset]!.toFixed(1)} · Y{' '}
                  {round.positions[offset + 1]!.toFixed(1)} · Z{' '}
                  {round.positions[offset + 2]!.toFixed(1)} ·{' '}
                  {round.alive[state] ? 'Alive' : 'Dead'}
                </p>
                <p className="mt-2 mb-0 font-mono text-xs text-[#a7b5aa] tabular-nums">
                  Health {round.health[state]} · Facing {round.yaw[state]!.toFixed(1)}°
                </p>
              </li>
            )
          })}
        </ul>
      </details>
    </section>
  )
}
