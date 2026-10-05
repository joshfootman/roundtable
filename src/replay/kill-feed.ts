import { sampleAtTick } from './frames'
import type { ReplayRound } from './types'

export function killFeedAtTick(round: ReplayRound, tick: number) {
  return round.deaths
    .flatMap((death, index) => {
      if (death.tick > tick) return []
      const offset = sampleAtTick(round.ticks, death.tick) * round.players.length
      function player(steamId: string) {
        const index = round.players.findIndex((player) => player.steamId === steamId)
        return {
          name: round.players[index]?.name ?? 'Unknown player',
          team: index < 0 ? undefined : round.teams[offset + index],
        }
      }
      return [
        {
          ...death,
          id: index,
          attacker: death.killer.type === 'player' ? player(death.killer.steamId) : undefined,
          target: player(death.victim),
          suicide: death.killer.type === 'player' && death.killer.steamId === death.victim,
        },
      ]
    })
    .sort((a, b) => b.tick - a.tick || b.id - a.id)
}
