import type { PlayerSnapshot } from './entities/index.ts'
import type { ReplayRound } from '../replay/types.ts'

export interface RoundRules {
  warmup: boolean
  totalRoundsPlayed: number
  started: boolean
  reason: number
  phase: number
}

export type ReplayEvent =
  | { type: 'round-start'; number: number; startTick: number }
  | { type: 'round'; round: ReplayRound }
  | { type: 'reset' }

type Capture = {
  startTick: number
  number: number
  players: ReplayRound['players']
  ticks: number[]
  positions: number[]
  alive: number[]
  lastPositions: Map<string, PlayerSnapshot>
} & ({ phase: 'freeze' } | { phase: 'live' | 'postround'; liveStartTick: number })

const GAME_COMMENCING = 16
const POSTMATCH = 5

export function createRoundTracker() {
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
      startTick: round.startTick,
      liveStartTick: round.liveStartTick,
      endTick,
      tickInterval,
      players: round.players,
      ticks: Uint32Array.from(round.ticks),
      positions: Float32Array.from(round.positions),
      alive: Uint8Array.from(round.alive),
    }
  }

  return {
    get recording() {
      return capture !== undefined
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
            (scoreReset || (previous && (!previous.started || previous.reason !== 0)))))
      if (startsRound && capture?.startTick !== tick) {
        if (capture?.phase === 'postround' && rules.totalRoundsPlayed === capture.number)
          output.push({ type: 'round', round: finish(capture, tick) })
        capture = {
          phase: 'freeze',
          startTick: tick,
          number: rules.totalRoundsPlayed + 1,
          players: [],
          ticks: [],
          positions: [],
          alive: [],
          lastPositions: new Map(),
        }
        output.push({ type: 'round-start', number: capture.number, startTick: tick })
      }
      if (capture?.phase === 'freeze' && events.includes('round_freeze_end'))
        capture = { ...capture, phase: 'live', liveStartTick: tick }
      if (capture?.phase === 'live' && (rules.reason !== 0 || events.includes('round_end')))
        capture.phase = 'postround'
      return output
    },
    sample(tick: number, snapshots: PlayerSnapshot[]) {
      if (!capture) return
      const { ticks, positions, alive, lastPositions } = capture
      if (ticks.length && tick < ticks[ticks.length - 1]!)
        throw new Error('The demo contains out-of-order replay ticks.')
      if (!capture.players.length) {
        if (!snapshots.length)
          throw new Error('The competitive round has no recorded player positions.')
        capture.players = snapshots.map(({ steamId, name, team }) => ({ steamId, name, team }))
      }
      const { players } = capture
      const byId = new Map(snapshots.map((player) => [player.steamId, player]))
      if (ticks.at(-1) === tick) {
        positions.length -= players.length * 3
        alive.length -= players.length
      } else ticks.push(tick)
      for (const player of players) {
        const current = byId.get(player.steamId)
        if (current) lastPositions.set(player.steamId, current)
        const recorded = current ?? lastPositions.get(player.steamId)
        if (!recorded) throw new Error('A competitive player has no recorded position.')
        positions.push(recorded.x, recorded.y, recorded.z)
        alive.push(Number(recorded.alive))
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
