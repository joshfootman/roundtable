import { createProjectileCapture } from './projectiles.ts'
import type { PlayerSnapshot, ProjectileSnapshot } from './entities/index.ts'
import {
  mapPlayerTracks,
  playerTrackLayout,
  playerTrackNames,
  type PlayerTracks,
} from '../replay/tracks.ts'
import type {
  ReplayActor,
  ReplayDamage,
  ReplayDeath,
  ReplayRound,
  ReplayWeapon,
  PlayerInspection,
  BombState,
  BombEvent,
  GrenadeDetonation,
  ReplaySmoke,
  FireArea,
  ReplayShot,
  DroppedItem,
  DroppedPlacement,
} from '../replay/types.ts'

export interface RoundRules {
  score?: ReplayRound['score']
  teamNames?: { ct?: string; t?: string }
  winner?: 'ct' | 't'
  warmup: boolean
  freezePeriod: boolean
  totalRoundsPlayed: number
  started: boolean
  reason: number
  phase: number
  overtime: number
}

export type ReplayEvent =
  | { type: 'round-start'; number: number; startTick: number }
  | { type: 'round'; round: ReplayRound }
  // Rounds numbered above `after` were voided by a restart or a backup restore.
  | { type: 'reset'; after: number }

type Capture = {
  teamNames?: ReplayRound['teamNames']
  score?: ReplayRound['score']
  outcome?: ReplayRound['outcome']
  startTick: number
  number: number
  overtime: number
  players: ReplayRound['players']
  ticks: number[]
  tracks: { [K in keyof PlayerTracks]: number[] }
  projectiles: ReturnType<typeof createProjectileCapture>
  shots: ReplayShot[]
  droppedItems: ReplayRound['droppedItems']
  restingItems: Map<number, DroppedPlacement>
  fires: ReplayRound['fires']
  smokes: ReplaySmoke[]
  detonations: GrenadeDetonation[]
  bombEvents: BombEvent[]
  bomb: ReplayRound['bomb']
  inspection: ReplayRound['inspection']
  deaths: ReplayDeath[]
  damage: ReplayDamage[]
  lastSnapshots: Map<string, PlayerSnapshot>
} & (
  | { phase: 'freeze' }
  | { phase: 'live'; liveStartTick: number }
  | { phase: 'postround'; liveStartTick: number; resultTick: number }
)

/** Appends a roster column, marking the player absent for the samples recorded before they joined. */
function addPlayer(capture: Capture, snapshot: PlayerSnapshot, samples: number) {
  const before = capture.players.length
  capture.players.push({ steamId: snapshot.steamId, name: snapshot.name })
  capture.inspection.push([])
  capture.lastSnapshots.set(snapshot.steamId, snapshot)
  if (!samples) return
  const absent: { [K in keyof PlayerTracks]: number[] } = {
    positions: [snapshot.x, snapshot.y, snapshot.z],
    alive: [0],
    health: [0],
    yaw: [snapshot.yaw],
    pitch: [snapshot.pitch],
    teams: [snapshot.team],
    present: [0],
  }
  for (const name of playerTrackNames) {
    const width = playerTrackLayout[name].width
    const old = capture.tracks[name]
    const grown: number[] = []
    for (let sample = 0; sample < samples; sample++)
      grown.push(
        ...old.slice(sample * before * width, (sample + 1) * before * width),
        ...absent[name],
      )
    capture.tracks[name] = grown
  }
}

function inRoster(capture: Capture, steamId: string) {
  return capture.players.some((player) => player.steamId === steamId)
}

function actorInRoster(capture: Capture, actor: ReplayActor) {
  return actor.type === 'world' || inRoster(capture, actor.steamId)
}

function sameWeapon(x: ReplayWeapon, y: ReplayWeapon): boolean {
  return (
    x.type === y.type &&
    (x.type === 'none' || y.type === 'none' || x.definition === y.definition) &&
    (x.type !== 'gun' || y.type !== 'gun' || (x.magazine === y.magazine && x.reserve === y.reserve))
  )
}

function sameInspection(a: PlayerInspection, b: PlayerInspection): boolean {
  return (
    a.onLadder === b.onLadder &&
    a.flash.type === b.flash.type &&
    (a.flash.type !== 'flashed' ||
      b.flash.type !== 'flashed' ||
      (a.flash.startTick === b.flash.startTick &&
        a.flash.durationSeconds === b.flash.durationSeconds)) &&
    a.money === b.money &&
    a.armour === b.armour &&
    a.helmet === b.helmet &&
    a.grenades.length === b.grenades.length &&
    a.grenades.every(
      (item, index) =>
        item.definition === b.grenades[index]!.definition &&
        item.count === b.grenades[index]!.count,
    ) &&
    sameWeapon(a.weapon, b.weapon) &&
    a.weapons.length === b.weapons.length &&
    a.weapons.every((weapon, index) => sameWeapon(weapon, b.weapons[index]!))
  )
}

const GAME_COMMENCING = 16
const POSTMATCH = 5

export function createRoundTracker() {
  const activeSmokes = new Map<number, ReplaySmoke>()
  let capture: Capture | undefined
  let previousRules: RoundRules | undefined
  let tickInterval = 0
  let publishedRounds = 0

  function finish(round: Capture, endTick: number): ReplayRound {
    if (round.phase !== 'postround' || !round.ticks.length || !tickInterval)
      throw new Error(
        'The competitive round is missing its recorded tick interval, freeze end or positions.',
      )
    publishedRounds = round.number
    return {
      number: round.number,
      ...(round.teamNames ? { teamNames: round.teamNames } : {}),
      ...(round.score ? { score: round.score } : {}),
      ...(round.outcome ? { outcome: round.outcome } : {}),
      overtime: round.overtime,
      startTick: round.startTick,
      liveStartTick: round.liveStartTick,
      resultTick: round.resultTick,
      endTick,
      tickInterval,
      players: round.players,
      deaths: round.deaths,
      damage: round.damage,
      inspection: round.inspection,
      bomb: round.bomb,
      bombEvents: round.bombEvents,
      projectiles: round.projectiles.finish(endTick),
      detonations: round.detonations,
      droppedItems: [
        ...round.droppedItems,
        ...[...round.restingItems.values()]
          .filter((item) => item.from < endTick)
          .map((item) => ({ ...item, to: endTick })),
      ].sort((a, b) => a.from - b.from || a.entity - b.entity),
      shots: round.shots,
      fires: round.fires,
      smokes: round.smokes
        .filter((smoke) => smoke.endTick > round.startTick)
        .map((smoke) => ({
          ...smoke,
          endTick: Math.min(smoke.endTick, endTick),
        })),
      ticks: Uint32Array.from(round.ticks),
      ...(mapPlayerTracks((name) =>
        playerTrackLayout[name].type.from(round.tracks[name]),
      ) as PlayerTracks),
    }
  }

  function bombEvent(event: BombEvent) {
    if (!capture) return
    if (
      event.type !== 'exploded' &&
      !capture.players.some((player) => player.steamId === event.player)
    )
      throw new Error('A bomb event actor is outside the recorded round roster.')
    capture.bombEvents.push(event)
  }

  return {
    smoke(event: Omit<ReplaySmoke, 'startTick' | 'endTick'> & { tick: number }) {
      const { tick, ...position } = event
      if (activeSmokes.has(event.entity))
        throw new Error('A recorded smoke started twice without expiring.')
      const smoke = { ...position, startTick: tick, endTick: Infinity }
      activeSmokes.set(event.entity, smoke)
      capture?.smokes.push(smoke)
    },
    smokeExpired(entity: number, tick: number) {
      const smoke = activeSmokes.get(entity)
      if (!smoke) throw new Error('A recorded smoke expired without a recorded beginning.')
      smoke.endTick = tick
      activeSmokes.delete(entity)
    },
    smokeEntities(tick: number, entities: Set<number>) {
      for (const [id, smoke] of activeSmokes)
        if (!entities.has(id)) {
          smoke.endTick = tick
          activeSmokes.delete(id)
        }
    },
    get recording() {
      return capture !== undefined
    },
    result(winner: 'ct' | 't', reason: number, teamName?: string) {
      if (!capture || capture.phase !== 'postround') return
      capture.outcome = { ...capture.outcome, winner, reason, ...(teamName ? { teamName } : {}) }
    },
    mvp(steamId: string) {
      if (!capture?.outcome) return
      const player = capture.players.find((player) => player.steamId === steamId)
      if (player) capture.outcome.mvp = { name: player.name }
    },
    update(
      tick: number,
      rules: RoundRules | undefined,
      events: string[],
      interval: number,
    ): ReplayEvent[] {
      tickInterval = interval
      if (!rules) {
        if (capture) throw new Error('Missing recorded competitive round rules.')
        return []
      }
      const previous = previousRules
      previousRules = rules
      const output: ReplayEvent[] = []
      const outsideMatch =
        rules.warmup ||
        rules.reason === GAME_COMMENCING ||
        (!rules.started && rules.phase !== POSTMATCH)
      const scoreReset =
        previous !== undefined && rules.totalRoundsPlayed < previous.totalRoundsPlayed
      if (outsideMatch || scoreReset) {
        const after = outsideMatch ? 0 : rules.totalRoundsPlayed
        if (capture || publishedRounds > after) output.push({ type: 'reset', after })
        capture = undefined
        publishedRounds = Math.min(publishedRounds, after)
        if (outsideMatch) return output
      }
      const startsRound =
        rules.started &&
        (events.includes('round_start') ||
          (rules.reason === 0 &&
            (scoreReset ||
              (previous === undefined && rules.freezePeriod) ||
              (previous && (!previous.started || previous.reason !== 0)))))
      if (startsRound && capture?.startTick !== tick) {
        if (capture?.phase === 'postround' && rules.totalRoundsPlayed === capture.number)
          output.push({ type: 'round', round: finish(capture, tick) })
        capture = {
          phase: 'freeze',
          startTick: tick,
          number: rules.totalRoundsPlayed + 1,
          ...(rules.score ? { score: rules.score } : {}),
          overtime: rules.overtime,
          players: [],
          ticks: [],
          tracks: mapPlayerTracks(() => []),
          projectiles: createProjectileCapture(),
          droppedItems: [],
          restingItems: new Map(),
          shots: [],
          fires: [{ tick, fires: [] }],
          smokes: [...activeSmokes.values()],
          detonations: [],
          bombEvents: [],
          bomb: [],
          inspection: [],
          deaths: [],
          damage: [],
          lastSnapshots: new Map(),
        }
        output.push({ type: 'round-start', number: capture.number, startTick: tick })
      }
      if (capture?.phase === 'freeze' && events.includes('round_freeze_end'))
        capture = { ...capture, score: rules.score, phase: 'live', liveStartTick: tick }
      if (capture && capture.phase !== 'postround' && rules.teamNames)
        capture.teamNames = { ...rules.teamNames }
      if (capture?.phase === 'live' && (rules.reason !== 0 || events.includes('round_end'))) {
        capture = { ...capture, phase: 'postround', resultTick: tick }
        if (rules.winner) {
          const teamName = rules.teamNames?.[rules.winner]
          capture.outcome = {
            winner: rules.winner,
            reason: rules.reason,
            ...(teamName ? { teamName } : {}),
          }
        }
      }
      return output
    },
    shot(shot: ReplayShot) {
      if (!capture) return
      if (!capture.players.some((player) => player.steamId === shot.player))
        throw new Error('A recorded shooter is outside the round roster.')
      capture.shots.push(shot)
    },
    droppedItems(tick: number, items: DroppedItem[]) {
      if (!capture) return
      const resting = capture.restingItems
      const current = new Map(items.map((item) => [item.entity, item]))
      for (const [entity, placement] of resting) {
        const item = current.get(entity)
        if (
          item &&
          item.serial === placement.serial &&
          item.definition === placement.definition &&
          item.x === placement.x &&
          item.y === placement.y &&
          item.z === placement.z
        ) {
          current.delete(entity)
          continue
        }
        resting.delete(entity)
        // A placement replaced within its own tick never rendered.
        if (placement.from < tick) capture.droppedItems.push({ ...placement, to: tick })
      }
      for (const item of current.values())
        resting.set(item.entity, { ...item, from: tick, to: tick })
    },
    fires(tick: number, fires: FireArea[]) {
      if (!capture) return
      const track = capture.fires
      if (track.at(-1)?.tick === tick) track.pop()
      const previous = track.at(-1)?.fires
      if (
        !previous ||
        previous.length !== fires.length ||
        fires.some((fire, index) => {
          const old = previous[index]!
          return (
            fire.entity !== old.entity ||
            fire.serial !== old.serial ||
            fire.positions.length !== old.positions.length ||
            fire.positions.some((value, cell) => value !== old.positions[cell])
          )
        })
      )
        track.push({ tick, fires })
    },
    projectiles(tick: number, snapshots: ProjectileSnapshot[]) {
      if (!capture) return
      for (const snapshot of snapshots)
        if (!capture.players.some((player) => player.steamId === snapshot.thrower))
          throw new Error('A grenade thrower is outside the recorded round roster.')
      capture.projectiles.sample(tick, snapshots)
    },
    detonation(event: GrenadeDetonation) {
      if (!capture) return
      capture.detonations.push(event)
      capture.projectiles.detonate(event)
    },
    bombEvent,
    bomb(tick: number, state: BombState) {
      if (!capture) return
      if (
        state.type === 'carried' &&
        !capture.players.some((player) => player.steamId === state.carrier)
      )
        throw new Error('The bomb carrier is outside the recorded round roster.')
      if (state.type === 'planted' && state.defuser.type === 'player') {
        const steamId = state.defuser.steamId
        if (!capture.players.some((player) => player.steamId === steamId))
          throw new Error('The bomb defuser is outside the recorded round roster.')
      }
      const track = capture.bomb
      const observed = track.at(-1)?.state
      if (track.at(-1)?.tick === tick) track.pop()
      const previous = track.at(-1)?.state
      if (
        state.type === 'carried' &&
        state.planting &&
        !(observed?.type === 'carried' && observed.planting)
      )
        bombEvent({ tick, type: 'plant-start', player: state.carrier })
      if (
        observed?.type === 'carried' &&
        observed.planting &&
        state.type !== 'planted' &&
        !(state.type === 'carried' && state.planting)
      )
        bombEvent({ tick, type: 'plant-abort', player: observed.carrier })
      if (state.type === 'planted') {
        const current = state.defuser
        const old = observed?.type === 'planted' ? observed.defuser : { type: 'none' as const }
        if (current.type === 'player' && (old.type !== 'player' || old.steamId !== current.steamId))
          bombEvent({ tick, type: 'defuse-start', player: current.steamId })
        if (old.type === 'player' && current.type === 'none')
          bombEvent({ tick, type: 'defuse-abort', player: old.steamId })
      }
      if (
        !previous ||
        previous.type !== state.type ||
        (previous.type === 'carried' &&
          state.type === 'carried' &&
          (previous.carrier !== state.carrier || previous.planting !== state.planting)) ||
        (previous.type === 'planted' &&
          state.type === 'planted' &&
          (previous.defuser.type !== state.defuser.type ||
            (previous.defuser.type === 'player' &&
              state.defuser.type === 'player' &&
              previous.defuser.steamId !== state.defuser.steamId))) ||
        ((previous.type === 'dropped' || previous.type === 'planted') &&
          (state.type === 'dropped' || state.type === 'planted') &&
          (previous.x !== state.x || previous.y !== state.y || previous.z !== state.z))
      )
        track.push({ tick, state })
    },
    death(event: ReplayDeath) {
      if (!capture) return
      if (
        !inRoster(capture, event.victim) ||
        !actorInRoster(capture, event.killer) ||
        (event.assister !== undefined && !inRoster(capture, event.assister))
      )
        throw new Error('A death event refers to a player outside the recorded round roster.')
      capture.deaths.push(event)
    },
    damage(event: ReplayDamage) {
      if (!capture) return
      if (!inRoster(capture, event.victim) || !actorInRoster(capture, event.attacker))
        throw new Error('A damage event refers to a player outside the recorded round roster.')
      capture.damage.push(event)
    },

    sample(tick: number, snapshots: PlayerSnapshot[]) {
      if (!capture) return
      const { ticks, lastSnapshots } = capture
      if (ticks.length && tick < ticks[ticks.length - 1]!)
        throw new Error('The demo contains out-of-order replay ticks.')
      if (!capture.players.length && !snapshots.length)
        throw new Error('The competitive round has no recorded player positions.')
      if (ticks.at(-1) === tick)
        for (const name of playerTrackNames)
          capture.tracks[name].length -= capture.players.length * playerTrackLayout[name].width
      else ticks.push(tick)
      for (const snapshot of snapshots)
        if (!inRoster(capture, snapshot.steamId)) addPlayer(capture, snapshot, ticks.length - 1)
      const { positions, alive, health, yaw, pitch, teams, present } = capture.tracks
      const { players } = capture
      const byId = new Map(snapshots.map((player) => [player.steamId, player]))
      for (const [index, player] of players.entries()) {
        const current = byId.get(player.steamId)
        const previousSnapshot = lastSnapshots.get(player.steamId)
        if (
          capture.outcome &&
          current?.mvps !== undefined &&
          previousSnapshot?.mvps !== undefined &&
          current.mvps > previousSnapshot.mvps
        )
          capture.outcome.mvp = { name: player.name }
        if (current) lastSnapshots.set(player.steamId, current)
        const recorded = current ?? lastSnapshots.get(player.steamId)!
        present.push(current ? 1 : 0)
        positions.push(recorded.x, recorded.y, recorded.z)
        alive.push(Number(recorded.alive))
        health.push(recorded.health)
        yaw.push(recorded.yaw)
        pitch.push(recorded.pitch)
        teams.push(recorded.team)
        const track = capture.inspection[index]!
        if (track.at(-1)?.tick === tick) track.pop()
        const previous = track.at(-1)
        const currentInspection = {
          tick,
          ...(recorded.onLadder !== undefined ? { onLadder: recorded.onLadder } : {}),
          flash: recorded.flash,
          weapon: recorded.weapon,
          weapons: recorded.weapons,
          money: recorded.money,
          armour: recorded.armour,
          helmet: recorded.helmet,
          grenades: recorded.grenades,
        }
        if (!previous || !sameInspection(previous, currentInspection)) track.push(currentInspection)
      }
    },
    end(tick: number): ReplayEvent[] {
      if (!capture) return []
      if (capture.phase !== 'postround' || previousRules?.totalRoundsPlayed !== capture.number)
        throw new Error('The demo ends before a complete competitive round is recorded.')
      const round = finish(capture, tick)
      capture = undefined
      return [{ type: 'round', round }]
    },
  }
}
