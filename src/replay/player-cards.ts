import { weaponSlot } from './equipment'
import { frameAt } from './frames'
import { playerNumbers } from './player-numbers'
import { scenePlayers } from './scene'
import type { PlayerInspection, ReplayRound, ReplayWeapon } from './types'

export type PlayerCardData = {
  steamId: string
  number: number
  name: string
  team: 2 | 3
  alive: boolean
  health: number
  kills: number
  deaths: number
  inspection: PlayerInspection
  otherWeapons: ReplayWeapon[]
  carriesBomb: boolean
  flashSeconds: number
}

export function playerCardsAtTick(
  rounds: readonly ReplayRound[],
  round: ReplayRound,
  tick: number,
): PlayerCardData[] {
  const scores = new Map<string, { kills: number; deaths: number }>()
  function score(steamId: string) {
    let value = scores.get(steamId)
    if (!value) {
      value = { kills: 0, deaths: 0 }
      scores.set(steamId, value)
    }
    return value
  }

  for (const replayRound of rounds) {
    if (replayRound.startTick > round.startTick) continue
    for (const death of replayRound.deaths) {
      if (death.tick > tick) continue
      score(death.victim).deaths += 1
      if (death.killer.type !== 'player' || death.killer.steamId === death.victim) continue
      const killerId = death.killer.steamId
      const killer = replayRound.players.findIndex((player) => player.steamId === killerId)
      const victim = replayRound.players.findIndex((player) => player.steamId === death.victim)
      if (killer < 0 || victim < 0) continue
      const offset = frameAt(replayRound, death.tick)
      const killerTeam = replayRound.teams[offset + killer]
      const victimTeam = replayRound.teams[offset + victim]
      if (
        (killerTeam === 2 || killerTeam === 3) &&
        (victimTeam === 2 || victimTeam === 3) &&
        killerTeam !== victimTeam
      ) {
        score(killerId).kills += 1
      }
    }
  }

  const numbers = playerNumbers(round)
  return scenePlayers(round, tick).flatMap((scene): PlayerCardData[] => {
    const { team, inspection } = scene
    const player = round.players[scene.index]!
    const number = numbers.get(player.steamId)
    if ((team !== 2 && team !== 3) || number === undefined || !scene.present) return []
    return [
      {
        ...player,
        number,
        team,
        alive: scene.alive,
        health: scene.health,
        ...score(player.steamId),
        inspection,
        otherWeapons: ['primary', 'pistol', 'knife'].flatMap((slot) => {
          const weapon = inspection.weapons.find(
            (owned) => owned.type !== 'none' && weaponSlot(owned.definition) === slot,
          )
          if (
            !weapon ||
            weapon.type === 'none' ||
            (inspection.weapon.type !== 'none' &&
              weapon.definition === inspection.weapon.definition)
          ) {
            return []
          }
          return [weapon]
        }),
        carriesBomb: scene.bomb === 'carrying' || scene.bomb === 'planting',
        flashSeconds: scene.flashSeconds,
      },
    ]
  })
}
