import { createProjectileCapture } from './projectiles.ts'
import type { PlayerSnapshot, ProjectileSnapshot } from './entities/index.ts'
import type {
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
  | { type: 'reset' }

type Capture = {
  teamNames?: ReplayRound['teamNames']
  score?: ReplayRound['score']
  outcome?: ReplayRound['outcome']
  startTick: number
  number: number
  overtime: number
  players: ReplayRound['players']
  ticks: number[]
  positions: number[]
  alive: number[]
  health: number[]
  yaw: number[]
  teams: number[]
  projectiles: ReturnType<typeof createProjectileCapture>
  shots: ReplayShot[]
  droppedItems: ReplayRound['droppedItems']
  fires: ReplayRound['fires']
  smokes: ReplaySmoke[]
  detonations: GrenadeDetonation[]
  bombEvents: BombEvent[]
  bomb: ReplayRound['bomb']
  inspection: ReplayRound['inspection']
  deaths: ReplayDeath[]
  lastSnapshots: Map<string, PlayerSnapshot>
} & (
  | { phase: 'freeze' }
  | { phase: 'live'; liveStartTick: number }
  | { phase: 'postround'; liveStartTick: number; resultTick: number }
)

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
      inspection: round.inspection,
      bomb: round.bomb,
      bombEvents: round.bombEvents,
      projectiles: round.projectiles.finish(endTick),
      detonations: round.detonations,
      droppedItems: round.droppedItems,
      shots: round.shots,
      fires: round.fires,
      smokes: round.smokes
        .filter((smoke) => smoke.endTick > round.startTick)
        .map((smoke) => ({
          ...smoke,
          endTick: Math.min(smoke.endTick, endTick),
        })),
      ticks: Uint32Array.from(round.ticks),
      positions: Float32Array.from(round.positions),
      alive: Uint8Array.from(round.alive),
      health: Int32Array.from(round.health),
      yaw: Float32Array.from(round.yaw),
      teams: Uint8Array.from(round.teams),
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
        if (capture || publishedRounds) output.push({ type: 'reset' })
        capture = undefined
        publishedRounds = 0
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
          positions: [],
          alive: [],
          health: [],
          yaw: [],
          teams: [],
          projectiles: createProjectileCapture(),
          droppedItems: [{ tick, items: [] }],
          shots: [],
          fires: [{ tick, fires: [] }],
          smokes: [...activeSmokes.values()],
          detonations: [],
          bombEvents: [],
          bomb: [],
          inspection: [],
          deaths: [],
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
      const track = capture.droppedItems
      if (track.at(-1)?.tick === tick) track.pop()
      const previous = track.at(-1)?.items
      if (
        !previous ||
        previous.length !== items.length ||
        items.some((item, index) => {
          const old = previous[index]!
          return (
            item.entity !== old.entity ||
            item.serial !== old.serial ||
            item.definition !== old.definition ||
            item.x !== old.x ||
            item.y !== old.y ||
            item.z !== old.z
          )
        })
      )
        track.push({ tick, items })
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
      const killer = event.killer
      if (
        !capture.players.some((player) => player.steamId === event.victim) ||
        (killer.type === 'player' &&
          !capture.players.some((player) => player.steamId === killer.steamId))
      )
        throw new Error('A death event refers to a player outside the recorded round roster.')
      capture.deaths.push(event)
    },
    sample(tick: number, snapshots: PlayerSnapshot[]) {
      if (!capture) return
      const { ticks, positions, alive, health, yaw, teams, lastSnapshots } = capture
      if (ticks.length && tick < ticks[ticks.length - 1]!)
        throw new Error('The demo contains out-of-order replay ticks.')
      if (!capture.players.length) {
        if (!snapshots.length)
          throw new Error('The competitive round has no recorded player positions.')
        capture.players = snapshots.map(({ steamId, name }) => ({ steamId, name }))
        capture.inspection = snapshots.map(() => [])
      }
      const { players } = capture
      const byId = new Map(snapshots.map((player) => [player.steamId, player]))
      if (ticks.at(-1) === tick) {
        positions.length -= players.length * 3
        alive.length -= players.length
        health.length -= players.length
        yaw.length -= players.length
        teams.length -= players.length
      } else ticks.push(tick)
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
        const recorded = current ?? lastSnapshots.get(player.steamId)
        if (!recorded) throw new Error('A competitive player has no recorded position.')
        positions.push(recorded.x, recorded.y, recorded.z)
        alive.push(Number(recorded.alive))
        health.push(recorded.health)
        yaw.push(recorded.yaw)
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
