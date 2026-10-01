import { EquipmentIcon, GameIcon, equipmentIcon, recordedWeaponName } from './icons.tsx'
import headshotIcon from '../assets/cs2/deathnotice/icon_headshot.svg'
import suicideIcon from '../assets/cs2/deathnotice/icon_suicide.svg'
import { createUtilityRenderer } from './utility-renderer.ts'
import {
  utilityAppearance,
  SHOT_DISPLAY_SECONDS,
  utilityOverlays,
  initialUtilityVisibility,
  type UtilityVisibility,
} from './utility.ts'
import { equipmentName } from './equipment.ts'
import { useEffect, useRef, useState } from 'react'
import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  type Texture,
} from 'pixi.js'
import { sampleAtTick, recordAtTick, bombPosition, flashRemaining } from './frames'
import {
  mapDefinition,
  mapFacing,
  visibleOnFloor,
  worldToMap,
  type MapDefinition,
  type MapFloor,
} from './maps'
import type { BombEvent, ReplayRound } from './types'

const playerLabelStyle = new TextStyle({
  fontFamily: 'sans-serif',
  fontSize: 12,
  fontWeight: 'bold',
  fill: '#101713',
})

const bombEventIconKeys: Record<BombEvent['type'], string> = {
  'plant-start': 'c4',
  'plant-abort': 'c4',
  planted: 'planted_c4',
  'defuse-start': 'defuser',
  'defuse-abort': 'defuser',
  defused: 'defuser',
  exploded: 'planted_c4',
}

const utilityIconKeys = {
  flash: 'flashbang',
  he: 'hegrenade',
  smoke: 'smokegrenade',
  molotov: 'molotov',
  incendiary: 'incgrenade',
  decoy: 'decoy',
  fire: 'inferno',
}

const bombEventLabels = {
  'plant-start': 'started planting',
  'plant-abort': 'stopped planting',
  planted: 'planted the bomb',
  'defuse-start': 'started defusing',
  'defuse-abort': 'stopped defusing',
  defused: 'defused the bomb',
}

interface PlayerFilters {
  hiddenPlayers: ReadonlySet<string>
  hiddenTeams: ReadonlySet<number>
}

function initialPlayerFilters(): PlayerFilters {
  return { hiddenPlayers: new Set(), hiddenTeams: new Set() }
}

function playerVisible(steamId: string, team: number, filters: PlayerFilters): boolean {
  return !filters.hiddenPlayers.has(steamId) && !filters.hiddenTeams.has(team)
}

interface Playback {
  play(): void
  pause(): void
  seek(tick: number): void
  setFloor(floor: MapFloor): void
  setOverlays(overlays: UtilityVisibility): void
  setFilters(filters: PlayerFilters): void
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
  const [floor, setFloor] = useState<MapFloor>(map.floors === 'split' ? map.initialFloor : 'upper')
  const [overlays, setOverlays] = useState(initialUtilityVisibility)
  const [filters, setFilters] = useState(initialPlayerFilters)
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
    let currentFloor: MapFloor = map.floors === 'split' ? map.initialFloor : 'upper'
    let currentFilters = initialPlayerFilters()
    let currentOverlays = initialUtilityVisibility()

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
      const upper = await Assets.load(map.floors === 'split' ? map.images.upper : map.image)
      const textures: Record<MapFloor, Texture> = {
        upper,
        lower: map.floors === 'split' ? await Assets.load(map.images.lower) : upper,
      }
      if (cancelled) return
      const sceneMap = new Container()
      const radar = new Sprite(textures[currentFloor])
      sceneMap.addChild(radar)
      const utilities = createUtilityRenderer(round, map)
      sceneMap.addChild(utilities.container)
      let symbolScale = 1
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
        const flash = new Graphics()
          .circle(-13, -13, 5)
          .fill('#ffffff')
          .stroke({ color: '#101713', width: 2 })
        marker.addChild(flash)
        const label = new Text({
          text: String(index + 1),
          style: playerLabelStyle,
        })
        label.anchor.set(0.5)
        marker.addChild(label)
        sceneMap.addChild(marker)
        return { container: marker, body, direction, flash }
      })
      const bombMarker = new Graphics()
        .rect(-9, -9, 18, 18)
        .fill('#bedb8a')
        .stroke({ color: '#101713', width: 2 })
      sceneMap.addChild(bombMarker)
      app.stage.addChild(sceneMap)
      app.canvas.setAttribute('aria-hidden', 'true')
      element.appendChild(app.canvas)

      function draw() {
        const sample = sampleAtTick(round.ticks, tick)
        utilities.draw(tick, symbolScale, currentOverlays, currentFloor)
        for (let player = 0; player < markers.length; player++) {
          const position = (sample * markers.length + player) * 3
          const point = worldToMap(map, round.positions[position]!, round.positions[position + 1]!)
          const { container, body, direction, flash } = markers[player]!
          const state = sample * markers.length + player
          const color = round.teams[state] === 3 ? '#8dc5ff' : '#ffd08a'
          flash.visible =
            currentOverlays.flashes &&
            flashRemaining(
              recordAtTick(round.inspection[player]!, tick).flash,
              tick,
              round.tickInterval,
            ) > 0
          container.visible =
            visibleOnFloor(map, currentFloor, round.positions[position + 2]!) &&
            playerVisible(round.players[player]!.steamId, round.teams[state]!, currentFilters)
          body.tint = color
          direction.tint = color
          direction.rotation = mapFacing(map, round.yaw[state]!)
          container.position.set(point.x, point.y)
          container.alpha = round.alive[sample * markers.length + player] ? 1 : 0.35
        }
        const bomb = recordAtTick(round.bomb, tick).state
        const position = bombPosition(round, bomb, sample)
        bombMarker.visible = position !== undefined && visibleOnFloor(map, currentFloor, position.z)
        if (position) {
          const point = worldToMap(map, position.x, position.y)
          const offset = bomb.type === 'carried' ? 15 * bombMarker.scale.x : 0
          bombMarker.position.set(point.x + offset, point.y - offset)
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
        setFloor(next) {
          currentFloor = next
          radar.texture = textures[next]
          draw()
          app.render()
        },
        setOverlays(next) {
          currentOverlays = next
          draw()
          app.render()
        },
        setFilters(next) {
          currentFilters = next
          draw()
          app.render()
        },
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
        symbolScale = (map.imageSize * 0.8) / width
        for (const { container } of markers) container.scale.set((map.imageSize * 0.8) / width)
        bombMarker.scale.set((map.imageSize * 0.8) / width)
        draw()
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
  const bomb = recordAtTick(round.bomb, recordedTick).state
  const bombPoint = bombPosition(round, bomb, sample)
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
      {map.floors === 'split' && (
        <fieldset className="mt-4 flex gap-5">
          <legend className="text-sm font-semibold">Map floor</legend>
          {(['upper', 'lower'] as const).map((value) => (
            <label key={value} className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="radio"
                name="map-floor"
                value={value}
                checked={floor === value}
                disabled={scene.status !== 'ready'}
                className="size-4 accent-[#bedb8a]"
                onChange={() => {
                  setFloor(value)
                  playback.current?.setFloor(value)
                }}
              />
              {value === 'upper' ? 'Upper floor' : 'Lower floor'}
            </label>
          ))}
        </fieldset>
      )}
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
      <details className="mt-4">
        <summary className="min-h-11 cursor-pointer py-3 font-semibold">Utility overlays</summary>
        <fieldset className="mt-2 grid gap-x-5 sm:grid-cols-2">
          <legend className="text-sm font-semibold">Visible overlays</legend>
          {utilityOverlays.map(({ key, label }) => (
            <label key={key} className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[#bedb8a]"
                disabled={scene.status !== 'ready'}
                checked={overlays[key]}
                onChange={(event) => {
                  const next = { ...overlays, [key]: event.currentTarget.checked }
                  setOverlays(next)
                  playback.current?.setOverlays(next)
                }}
              />
              {label}
            </label>
          ))}
        </fieldset>
      </details>
      <details className="mt-4">
        <summary className="min-h-11 cursor-pointer py-3 font-semibold">Player filters</summary>
        <fieldset className="mt-2 flex flex-wrap gap-x-5">
          <legend className="text-sm font-semibold">Visible teams</legend>
          {[
            { team: 2, name: 'Terrorists' },
            { team: 3, name: 'Counter-Terrorists' },
          ].map(({ team, name }) => (
            <label key={team} className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[#bedb8a]"
                disabled={scene.status !== 'ready'}
                checked={!filters.hiddenTeams.has(team)}
                onChange={(event) => {
                  const hiddenTeams = new Set(filters.hiddenTeams)
                  if (event.currentTarget.checked) hiddenTeams.delete(team)
                  else hiddenTeams.add(team)
                  const next = { ...filters, hiddenTeams }
                  setFilters(next)
                  playback.current?.setFilters(next)
                }}
              />
              {name}
            </label>
          ))}
        </fieldset>
        <fieldset className="mt-2 grid gap-x-5 sm:grid-cols-2">
          <legend className="text-sm font-semibold">Visible players</legend>
          {round.players.map((player) => (
            <label key={player.steamId} className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[#bedb8a]"
                disabled={scene.status !== 'ready'}
                checked={!filters.hiddenPlayers.has(player.steamId)}
                onChange={(event) => {
                  const hiddenPlayers = new Set(filters.hiddenPlayers)
                  if (event.currentTarget.checked) hiddenPlayers.delete(player.steamId)
                  else hiddenPlayers.add(player.steamId)
                  const next = { ...filters, hiddenPlayers }
                  setFilters(next)
                  playback.current?.setFilters(next)
                }}
              />
              {player.name}
            </label>
          ))}
        </fieldset>
      </details>
      <p aria-label="Visible player count" className="mt-2 text-sm text-[#a7b5aa]">
        Showing{' '}
        {
          round.players.filter((player, index) =>
            playerVisible(
              player.steamId,
              round.teams[sample * round.players.length + index]!,
              filters,
            ),
          ).length
        }{' '}
        of {round.players.length} players
      </p>
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
      <p hidden={!overlays.shots} className="mt-4 text-sm text-[#a7b5aa]">
        Bullet traces show recorded shot direction. Their length does not represent an impact.
      </p>
      <ul
        hidden={!overlays.shots}
        aria-label="Bullet traces"
        className="mt-3 list-none space-y-2 p-0 text-sm"
      >
        {round.shots
          .filter(
            (shot) =>
              shot.tick <= recordedTick &&
              (recordedTick - shot.tick) * round.tickInterval < SHOT_DISPLAY_SECONDS,
          )
          .map((shot, index) => (
            <li key={index}>
              {round.players.find((player) => player.steamId === shot.player)!.name} ·{' '}
              <EquipmentIcon definition={shot.weapon} />
              {equipmentName(shot.weapon)} shot
              {` · X ${shot.x.toFixed(1)} · Y ${shot.y.toFixed(1)} · Z ${shot.z.toFixed(1)} · Pitch ${shot.pitch.toFixed(1)}° · Facing ${shot.yaw.toFixed(1)}°`}
            </li>
          ))}
      </ul>
      <ul
        hidden={!overlays.fires}
        aria-label="Approximate fire areas"
        className="mt-4 list-none space-y-2 p-0 text-sm"
      >
        {recordAtTick(round.fires, recordedTick).fires.map((fire) => (
          <li key={`${fire.entity}:${fire.serial}`}>
            <GameIcon src={equipmentIcon('inferno')} />
            Approximate fire area · {fire.positions.length / 3} burning{' '}
            {fire.positions.length === 3 ? 'cell' : 'cells'}
          </li>
        ))}
      </ul>
      <ul
        hidden={!overlays.smokes}
        aria-label="Approximate smoke areas"
        className="mt-4 list-none space-y-2 p-0 text-sm"
      >
        {round.smokes
          .filter((smoke) => smoke.startTick <= recordedTick && recordedTick < smoke.endTick)
          .map((smoke) => (
            <li key={`${smoke.entity}:${smoke.startTick}`}>
              <GameIcon src={equipmentIcon('smokegrenade')} />
              Approximate smoke area
              {` · X ${smoke.x.toFixed(1)} · Y ${smoke.y.toFixed(1)} · Z ${smoke.z.toFixed(1)}`}
            </li>
          ))}
      </ul>
      <ul
        hidden={!overlays.trajectories}
        aria-label="Flying grenades"
        className="mt-4 list-none space-y-2 p-0 text-sm"
      >
        {round.projectiles
          .filter(
            (projectile) =>
              projectile.startTick <= recordedTick && recordedTick < projectile.endTick,
          )
          .map((projectile) => {
            const index = sampleAtTick(projectile.ticks, recordedTick) * 3
            return (
              <li key={`${projectile.entity}:${projectile.serial}`}>
                <GameIcon src={equipmentIcon(utilityIconKeys[projectile.kind])} />
                {utilityAppearance[projectile.kind].name} ·{' '}
                {round.players.find((player) => player.steamId === projectile.thrower)!.name}
                {` · X ${projectile.positions[index]!.toFixed(1)} · Y ${projectile.positions[index + 1]!.toFixed(1)} · Z ${projectile.positions[index + 2]!.toFixed(1)}`}
              </li>
            )
          })}
      </ul>
      <ol
        hidden={!overlays.detonations}
        aria-label="Grenade detonations"
        className="mt-3 list-none space-y-2 p-0 text-sm"
      >
        {round.detonations
          .filter((event) => event.tick <= recordedTick)
          .map((event, index) => (
            <li key={index}>
              <GameIcon src={equipmentIcon(utilityIconKeys[event.kind])} />
              {utilityAppearance[event.kind].name} detonated
              {` · X ${event.x.toFixed(1)} · Y ${event.y.toFixed(1)} · Z ${event.z.toFixed(1)}`}
            </li>
          ))}
      </ol>
      <p aria-label="Bomb state" className="mt-5 text-sm text-[#a7b5aa]">
        {bomb.type !== 'inactive' && (
          <GameIcon src={equipmentIcon(bomb.type === 'planted' ? 'planted_c4' : 'c4')} />
        )}
        {bomb.type === 'planted' && bomb.defuser.type === 'player' && (
          <GameIcon src={equipmentIcon('defuser')} />
        )}
        Bomb{' '}
        {bomb.type === 'carried'
          ? `${bomb.planting ? 'being planted by' : 'carried by'} ${round.players.find((player) => player.steamId === bomb.carrier)!.name}`
          : bomb.type === 'planted' && bomb.defuser.type === 'player'
            ? `being defused by ${round.players.find((player) => bomb.defuser.type === 'player' && player.steamId === bomb.defuser.steamId)!.name}`
            : bomb.type}
        {bombPoint &&
          ` · X ${bombPoint.x.toFixed(1)} · Y ${bombPoint.y.toFixed(1)} · Z ${bombPoint.z.toFixed(1)}`}
      </p>
      <ol aria-label="Bomb events" className="mt-3 list-none space-y-2 p-0 text-sm">
        {round.bombEvents
          .filter((event) => event.tick <= recordedTick)
          .map((event, index) => {
            const label =
              event.type === 'exploded'
                ? 'Bomb exploded'
                : `${round.players.find((player) => player.steamId === event.player)!.name} ${bombEventLabels[event.type]}`
            return (
              <li key={index}>
                <GameIcon src={equipmentIcon(bombEventIconKeys[event.type])} />
                {label}
              </li>
            )
          })}
      </ol>
      <div className="mt-5">
        <h3 className="text-sm font-semibold">Kills and deaths</h3>
        <ol aria-label="Kill feed" className="mt-2 list-none space-y-2 p-0 text-sm">
          {round.deaths
            .filter((death) => death.tick <= recordedTick)
            .map((death, index) => {
              const victim = round.players.find((player) => player.steamId === death.victim)!
              const killer = death.killer
              const source =
                killer.type === 'player'
                  ? round.players.find((player) => player.steamId === killer.steamId)!.name
                  : 'World'
              return (
                <li key={index}>
                  {source} → {victim.name}
                  {' · '}
                  <GameIcon src={equipmentIcon(death.weapon)} wide />
                  {recordedWeaponName(death.weapon)}
                  {killer.type === 'player' && killer.steamId === death.victim && (
                    <>
                      {' · '}
                      <GameIcon src={suicideIcon} />
                      Suicide
                    </>
                  )}
                  {death.headshot && (
                    <>
                      {' · '}
                      <GameIcon src={headshotIcon} />
                      Headshot
                    </>
                  )}
                </li>
              )
            })}
        </ol>
      </div>
      <details className="mt-5" open>
        <summary className="cursor-pointer py-2 font-semibold">Recorded player positions</summary>
        <p className="mt-2 text-xs leading-relaxed text-[#a7b5aa]">
          World coordinates at the current recorded sample. Starting positions are shown first.
          Enable freeze time to play from the round’s recorded start.
        </p>
        <ul aria-label="Player inspection" className="mt-4 grid list-none gap-3 p-0 sm:grid-cols-2">
          {round.players.map((player, index) => {
            const state = sample * round.players.length + index
            if (!playerVisible(player.steamId, round.teams[state]!, filters)) return null
            const offset = state * 3
            const { weapon, armour, helmet, grenades, money, flash } = recordAtTick(
              round.inspection[index]!,
              recordedTick,
            )
            const remainingFlash = flashRemaining(flash, recordedTick, round.tickInterval)
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
                  {weapon.type !== 'none' && <EquipmentIcon definition={weapon.definition} />}Weapon{' '}
                  {weapon.type === 'none' ? 'None' : equipmentName(weapon.definition)}
                  {weapon.type === 'gun' && ` · Ammo ${weapon.magazine} / ${weapon.reserve}`}
                </p>
                <p className="mt-2 mb-0 font-mono text-xs text-[#a7b5aa] tabular-nums">
                  Money ${money} · {armour > 0 && <GameIcon src={equipmentIcon('kevlar')} />}Armour{' '}
                  {armour} · {helmet && <GameIcon src={equipmentIcon('helmet')} />}
                  {helmet ? 'Helmet' : 'No helmet'}
                </p>
                <p className="mt-2 mb-0 text-xs text-[#a7b5aa]">
                  Grenades{' '}
                  {grenades.length
                    ? grenades.map((item, index) => (
                        <span key={item.definition}>
                          {index > 0 && ' · '}
                          <EquipmentIcon definition={item.definition} />
                          {equipmentName(item.definition)} × {item.count}
                        </span>
                      ))
                    : 'None'}
                </p>
                <p
                  hidden={!overlays.flashes}
                  className="mt-2 mb-0 font-mono text-xs text-[#a7b5aa] tabular-nums"
                >
                  {remainingFlash > 0 && <GameIcon src={equipmentIcon('flashbang_assist')} />}
                  {remainingFlash > 0
                    ? `Flashed · ${remainingFlash.toFixed(1)} s remaining`
                    : 'Not flashed'}
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
