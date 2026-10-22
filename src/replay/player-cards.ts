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
  assists: number
  inspection: PlayerInspection
  mainWeapon: ReplayWeapon
  utility: UtilitySlot[]
  carriesBomb: boolean
  flashSeconds: number
}

export type UtilitySlot = { definition: number; owned: boolean }

export function playerCardsAtTick(
  rounds: readonly ReplayRound[],
  round: ReplayRound,
  tick: number,
): PlayerCardData[] {
  const scores = new Map<string, { kills: number; deaths: number; assists: number }>()
  function score(steamId: string) {
    let value = scores.get(steamId)
    if (!value) {
      value = { kills: 0, deaths: 0, assists: 0 }
      scores.set(steamId, value)
    }
    return value
  }

  for (const replayRound of rounds) {
    if (replayRound.startTick > round.startTick) continue
    for (const death of replayRound.deaths) {
      if (death.tick > tick) continue
      score(death.victim).deaths += 1
      if (death.assister && death.assister !== death.victim) score(death.assister).assists += 1
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
        mainWeapon: mainWeapon(inspection),
        utility: utilitySlots(inspection, team),
        carriesBomb: scene.bomb === 'carrying' || scene.bomb === 'planting',
        flashSeconds: scene.flashSeconds,
      },
    ]
  })
}

const slotRanks = { primary: 0, pistol: 1, knife: 2 } as const

function mainWeapon(inspection: PlayerInspection): ReplayWeapon {
  let main: ReplayWeapon = { type: 'none' }
  let mainRank = Infinity
  // The held weapon goes first so it wins ties with its stale inventory copy.
  for (const weapon of [inspection.weapon, ...inspection.weapons]) {
    if (weapon.type === 'none') continue
    const slot = weaponSlot(weapon.definition)
    if (slot && slotRanks[slot] < mainRank) {
      main = weapon
      mainRank = slotRanks[slot]
    }
  }
  return main
}

function utilitySlots(inspection: PlayerInspection, team: 2 | 3): UtilitySlot[] {
  const remaining = new Map(
    inspection.grenades.map((grenade) => [grenade.definition, grenade.count]),
  )
  // Each slot lists the grenades that can fill it; the first is drawn as the empty ghost.
  const fire = team === 2 ? [46, 48] : [48, 46]
  return [[43], [43], [44], [45], fire].map((definitions) => {
    const definition = definitions.find((candidate) => (remaining.get(candidate) ?? 0) > 0)
    if (definition === undefined) return { definition: definitions[0]!, owned: false }
    remaining.set(definition, remaining.get(definition)! - 1)
    return { definition, owned: true }
  })
}
