import { firearms, equipmentName } from '../../replay/equipment.ts'
import type {
  ReplayWeapon,
  PlayerInspection,
  BombState,
  GrenadeKind,
  FireArea,
  ReplayDeath,
  DroppedItem,
} from '../../replay/types.ts'
import { type EntityValue } from './field-decoder.ts'
import type { createEntityStore, Entity, FieldPolicy } from './store.ts'

export interface ProjectileSnapshot {
  entity: number
  serial: number
  kind: GrenadeKind
  thrower: string
  x: number
  y: number
  z: number
}

const projectileClasses: Record<string, GrenadeKind> = {
  CFlashbangProjectile: 'flash',
  CHEGrenadeProjectile: 'he',
  CSmokeGrenadeProjectile: 'smoke',
  CMolotovProjectile: 'molotov',
  CDecoyProjectile: 'decoy',
}

interface EntityProjection {
  teams: Entity[]
  controllers: Entity[]
  controllersByPawn: Map<number, Entity>
  plantedBombs: Entity[]
  carriedBomb?: Entity
  equipment: [number, Entity][]
  projectileCandidates: [number, Entity][]
  infernos: [number, Entity][]
  smokeIds: Set<number>
  gameRules?: Entity
}
export interface PlayerSnapshot {
  steamId: string
  name: string
  team: 2 | 3
  mvps?: number
  onLadder?: boolean
  x: number
  y: number
  z: number
  alive: boolean
  health: number
  yaw: number
  pitch: number
  money: number
  armour: number
  helmet: boolean
  grenades: PlayerInspection['grenades']
  flash: PlayerInspection['flash']
  weapon: ReplayWeapon
  weapons: ReplayWeapon[]
}
const replayFields = new Set([
  'm_MoveType',
  'm_flFlashDuration',
  'm_fireCount',
  'm_steamID',
  'm_hOwnerEntity',
  'm_hThrower',
  'm_bIsIncGrenade',
  'm_nExplodeEffectTickBegin',
  'm_bDidSmokeEffect',
  'm_bBombTicking',
  'm_bBombDefused',
  'm_bStartedArming',
  'm_hBombDefuser',
  'm_hPlayerPawn',
  'm_iszPlayerName',
  'm_iTeamNum',
  'm_iScore',
  'm_iMVPs',
  'm_szClanTeamname',
  'm_iHealth',
  'm_lifeState',
  'm_angEyeAngles',
  'm_ArmorValue',
  'm_pInGameMoneyServices.m_iAccount',
  'm_pItemServices.m_bHasHelmet',
  'm_pWeaponServices.m_hMyWeapons',
  'm_pWeaponServices.m_iAmmo.14',
  'm_pWeaponServices.m_hActiveWeapon',
  'm_iItemDefinitionIndex',
  'm_iClip1',
  'm_pReserveAmmo.0',
  ...['X', 'Y', 'Z'].flatMap((axis) => [
    `CBodyComponent.m_cell${axis}`,
    `CBodyComponent.m_vec${axis}`,
  ]),
  ...[
    'm_bWarmupPeriod',
    'm_bFreezePeriod',
    'm_totalRoundsPlayed',
    'm_bHasMatchStarted',
    'm_eRoundWinReason',
    'm_iRoundWinStatus',
    'm_gamePhase',
    'm_nOvertimePlaying',
  ].map((name) => `m_pGameRules.${name}`),
])
const retainedNames = new Map<string, boolean>()
function retained(name: string) {
  let keep = retainedNames.get(name)
  if (keep === undefined) {
    keep =
      replayFields.has(name) ||
      name.startsWith('m_pWeaponServices.m_hMyWeapons.') ||
      /^(m_bFireIsBurning|m_firePositions)\./.test(name)
    retainedNames.set(name, keep)
  }
  return keep
}
// view() groups entities by these fields, so only their arrival or a pawn change regroups them.
const classifying = new Set(['m_hPlayerPawn', 'm_iItemDefinitionIndex', 'm_iClip1', 'm_hThrower'])

export const cs2Fields: FieldPolicy = {
  retained,
  classifying,
  regroupOnChange: new Set(['m_hPlayerPawn']),
  stamped: new Map([['m_flFlashDuration', 'flashStartTick']]),
}

const weaponSlots: string[] = []
function weaponSlot(index: number) {
  return (weaponSlots[index] ??= `m_pWeaponServices.m_hMyWeapons.${index}`)
}

/** CS2 game state read from the live entities of a store built with `cs2Fields`. */
export function createCs2State(store: ReturnType<typeof createEntityStore>) {
  let projection: EntityProjection | undefined
  let projectedAt = -1
  function view(): EntityProjection {
    if (projection && projectedAt === store.membership) return projection
    const result: EntityProjection = {
      teams: [],
      controllers: [],
      controllersByPawn: new Map(),
      plantedBombs: [],
      equipment: [],
      projectileCandidates: [],
      infernos: [],
      smokeIds: new Set(),
    }
    for (const [id, entity] of store.entities) {
      if (entity.className === 'CCSGameRulesProxy') result.gameRules ??= entity
      if (!entity.active) continue
      if (entity.className === 'CCSTeam') result.teams.push(entity)
      if (entity.className === 'CCSPlayerController') {
        result.controllers.push(entity)
        const handle = entity.values.get('m_hPlayerPawn')
        if (typeof handle === 'number' && !result.controllersByPawn.has(handle))
          result.controllersByPawn.set(handle, entity)
      }
      if (entity.values.has('m_iItemDefinitionIndex') && entity.values.has('m_iClip1'))
        result.equipment.push([id, entity])
      if (entity.className === 'CPlantedC4') result.plantedBombs.push(entity)
      if (entity.className === 'CC4') result.carriedBomb ??= entity
      if (entity.values.has('m_hThrower')) result.projectileCandidates.push([id, entity])
      if (entity.className === 'CInferno') result.infernos.push([id, entity])
      if (entity.className === 'CSmokeGrenadeProjectile') result.smokeIds.add(id)
    }
    projection = result
    projectedAt = store.membership
    return result
  }
  // Inventory changes far less often than the pawn, so it is cached on its own inputs.
  const inventories = new WeakMap<
    Entity,
    {
      handles: (EntityValue | undefined)[]
      ammo: EntityValue | undefined
      weapons: [handle: number, entity: Entity, revision: number][]
      inventory: Pick<PlayerInspection, 'grenades' | 'weapons'>
    }
  >()
  function inventory(pawn: Entity): Pick<PlayerInspection, 'grenades' | 'weapons'> {
    const length = pawn.values.get('m_pWeaponServices.m_hMyWeapons')
    if (typeof length !== 'number') throw new Error('Missing recorded inventory length.')
    const ammo = pawn.values.get('m_pWeaponServices.m_iAmmo.14')
    const previous = inventories.get(pawn)
    if (
      previous &&
      previous.handles.length === length &&
      previous.ammo === ammo &&
      previous.handles.every((handle, index) => pawn.values.get(weaponSlot(index)) === handle) &&
      previous.weapons.every(
        ([handle, entity, revision]) =>
          entity.revision === revision && store.entities.get(handle & 0x3fff) === entity,
      )
    ) {
      weaponReads?.push(...previous.weapons)
      return previous.inventory
    }
    const outer = weaponReads
    weaponReads = []
    const result = readInventory(pawn, length)
    inventories.set(pawn, {
      handles: Array.from({ length }, (_, index) => pawn.values.get(weaponSlot(index))),
      ammo,
      weapons: weaponReads,
      inventory: result,
    })
    outer?.push(...weaponReads)
    weaponReads = outer
    return result
  }
  function readInventory(
    pawn: Entity,
    length: number,
  ): Pick<PlayerInspection, 'grenades' | 'weapons'> {
    const counts = new Map<number, number>()
    const weapons: Exclude<ReplayWeapon, { type: 'none' }>[] = []
    for (let index = 0; index < length; index++) {
      const handle = pawn.values.get(weaponSlot(index))
      if (typeof handle !== 'number') throw new Error('Missing recorded inventory handle.')
      const item = weapon(handle)
      if (item.type === 'none') continue
      weapons.push(item)
      const definition = item.definition
      if (definition < 43 || definition > 48) continue
      const count = definition === 43 ? pawn.values.get('m_pWeaponServices.m_iAmmo.14') : 1
      if (typeof count !== 'number' || !Number.isInteger(count) || count < 0)
        throw new Error('Missing recorded grenade quantity.')
      if (count > 0) counts.set(definition, count)
    }
    return {
      weapons: weapons.sort((a, b) => a.definition - b.definition),
      grenades: [...counts]
        .sort(([a], [b]) => a - b)
        .map(([definition, count]) => ({ definition, count })),
    }
  }
  function weapon(handle: EntityValue | undefined): ReplayWeapon {
    if (typeof handle !== 'number') throw new Error('Missing recorded weapon handle.')
    if (handle === 0xffffff || handle === 0xffffffff) return { type: 'none' }
    const entity = store.entityForHandle(handle)
    weaponReads?.push([handle, entity, entity.revision])
    const definition = entity.values.get('m_iItemDefinitionIndex')
    if (typeof definition !== 'number') throw new Error('Missing recorded weapon definition.')
    equipmentName(definition)
    if (!(definition in firearms)) return { type: 'item', definition }
    const magazine = entity.values.get('m_iClip1')
    const reserve = entity.values.get('m_pReserveAmmo.0')
    if (typeof magazine !== 'number' || typeof reserve !== 'number' || magazine < 0 || reserve < 0)
      throw new Error('Missing recorded weapon ammunition.')
    return { type: 'gun', definition, magazine, reserve }
  }
  function position(entity: Entity): { x: number; y: number; z: number } {
    function axis(axis: string) {
      const cell = entity.values.get(`CBodyComponent.m_cell${axis}`)
      const offset = entity.values.get(`CBodyComponent.m_vec${axis}`)
      if (
        typeof cell !== 'number' ||
        typeof offset !== 'number' ||
        !Number.isFinite(cell) ||
        !Number.isFinite(offset)
      )
        throw new Error('A replay entity is missing its recorded position.')
      return cell * 512 - 16384 + offset
    }
    return { x: axis('X'), y: axis('Y'), z: axis('Z') }
  }
  function playerByPawnHandle(handle: number): string {
    store.entityForHandle(handle)
    const controller = view().controllersByPawn.get(handle)
    const steam = controller?.values.get('m_steamID')
    if (typeof steam !== 'bigint' || steam <= 0n) throw new Error('Missing recorded pawn identity.')
    return steam.toString()
  }
  function bomb(): BombState {
    const current = view()
    for (const planted of current.plantedBombs) {
      const ticking = planted.values.get('m_bBombTicking')
      const defused = planted.values.get('m_bBombDefused')
      if (typeof ticking !== 'boolean' || typeof defused !== 'boolean')
        throw new Error('Missing recorded planted bomb state.')
      if (ticking && !defused) {
        const handle = planted.values.get('m_hBombDefuser')
        if (typeof handle !== 'number') throw new Error('Missing recorded bomb defuser.')
        return {
          type: 'planted',
          ...position(planted),
          defuser:
            handle === 0xffffff || handle === 0xffffffff
              ? { type: 'none' }
              : { type: 'player', steamId: playerByPawnHandle(handle) },
        }
      }
    }
    const c4 = current.carriedBomb
    if (!c4) return { type: 'inactive' }
    const owner = c4.values.get('m_hOwnerEntity')
    if (typeof owner !== 'number') throw new Error('Missing recorded bomb owner.')
    if (owner === 0xffffff || owner === 0xffffffff) return { type: 'dropped', ...position(c4) }
    const planting = c4.values.get('m_bStartedArming')
    if (typeof planting !== 'boolean') throw new Error('Missing recorded bomb arming state.')
    return { type: 'carried', carrier: playerByPawnHandle(owner), planting }
  }
  function droppedItems(): DroppedItem[] {
    const result: DroppedItem[] = []
    for (const [id, entity] of view().equipment) {
      if (entity.className.endsWith('Projectile')) continue
      const definition = entity.values.get('m_iItemDefinitionIndex')
      if (
        typeof definition !== 'number' ||
        !(definition in firearms || (definition >= 43 && definition <= 48))
      )
        continue
      const owner = entity.values.get('m_hOwnerEntity')
      if (typeof owner !== 'number') throw new Error('Missing recorded dropped item owner.')
      if (owner !== 0xffffff && owner !== 0xffffffff) continue
      result.push({ entity: id, serial: entity.serial, definition, ...position(entity) })
    }
    return result.sort((a, b) => a.entity - b.entity)
  }
  function projectiles(): ProjectileSnapshot[] {
    const result: ProjectileSnapshot[] = []
    for (const [index, entity] of view().projectileCandidates) {
      let kind = projectileClasses[entity.className]
      if (!kind) throw new Error(`Unsupported recorded grenade class ${entity.className}.`)
      const effect = entity.values.get('m_nExplodeEffectTickBegin')
      if (
        (typeof effect === 'number' && effect > 0) ||
        entity.values.get('m_bDidSmokeEffect') === true
      )
        continue
      if (kind === 'molotov') {
        const incendiary = entity.values.get('m_bIsIncGrenade')
        if (typeof incendiary !== 'boolean') throw new Error('Missing recorded fire grenade type.')
        if (incendiary) kind = 'incendiary'
      }
      const thrower = entity.values.get('m_hThrower')
      if (typeof thrower !== 'number') throw new Error('Missing recorded grenade thrower.')
      result.push({
        entity: index,
        serial: entity.serial,
        kind,
        thrower: playerByPawnHandle(thrower),
        ...position(entity),
      })
    }
    return result
  }
  // A snapshot is rebuilt only when its controller, pawn or one of the weapons it read changed.
  const built = new WeakMap<
    Entity,
    {
      pawn: Entity
      controllerRevision: number
      pawnRevision: number
      weapons: [handle: number, entity: Entity, revision: number][]
      snapshot: PlayerSnapshot
    }
  >()
  let weaponReads: [number, Entity, number][] | undefined
  function snapshots(): PlayerSnapshot[] {
    const players: PlayerSnapshot[] = []
    for (const controller of view().controllers) {
      const steam = controller.values.get('m_steamID')
      const handle = controller.values.get('m_hPlayerPawn')
      if (
        typeof steam !== 'bigint' ||
        steam <= 0n ||
        typeof handle !== 'number' ||
        handle === 0xffffff
      )
        continue
      const pawn = store.entities.get(handle & 0x3fff)
      if (!pawn || pawn.serial !== Math.floor(handle / 16384)) continue
      const previous = built.get(controller)
      if (
        previous?.pawn === pawn &&
        previous.controllerRevision === controller.revision &&
        previous.pawnRevision === pawn.revision &&
        previous.weapons.every(
          ([handle, entity, revision]) =>
            entity.revision === revision && store.entities.get(handle & 0x3fff) === entity,
        )
      ) {
        players.push(previous.snapshot)
        continue
      }
      const team = pawn.values.get('m_iTeamNum')
      if (team !== 2 && team !== 3) continue
      const name = controller.values.get('m_iszPlayerName')
      if (typeof name !== 'string' || !name.trim())
        throw new Error('A replay player is missing their name.')
      const health = pawn.values.get('m_iHealth')
      const life = pawn.values.get('m_lifeState')
      const angles = pawn.values.get('m_angEyeAngles')
      if (!Array.isArray(angles) || !Number.isFinite(angles[0]) || !Number.isFinite(angles[1]))
        throw new Error('A replay player is missing their recorded facing direction.')
      if (typeof health !== 'number' || typeof life !== 'number')
        throw new Error('A replay player is missing their recorded life state.')
      const money = controller.values.get('m_pInGameMoneyServices.m_iAccount')
      if (typeof money !== 'number' || !Number.isInteger(money) || money < 0)
        throw new Error('Missing recorded player money.')
      const armour = pawn.values.get('m_ArmorValue')
      const helmet = pawn.values.get('m_pItemServices.m_bHasHelmet')
      if (
        typeof armour !== 'number' ||
        !Number.isInteger(armour) ||
        armour < 0 ||
        typeof helmet !== 'boolean'
      )
        throw new Error('Missing recorded player armour.')
      const duration = pawn.values.get('m_flFlashDuration')
      if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0)
        throw new Error('Missing recorded flash duration.')
      let flash: PlayerInspection['flash'] = { type: 'none' }
      if (duration > 0) {
        const startTick = pawn.values.get('flashStartTick')
        if (typeof startTick !== 'number') throw new Error('Missing recorded flash beginning.')
        flash = { type: 'flashed', startTick, durationSeconds: duration }
      }
      const mvps = controller.values.get('m_iMVPs')
      const moveType = pawn.values.get('m_MoveType')
      weaponReads = []
      const snapshot: PlayerSnapshot = {
        steamId: steam.toString(),
        name,
        team,
        ...(typeof mvps === 'number' ? { mvps } : {}),
        ...(typeof moveType === 'number' ? { onLadder: moveType === 9 } : {}),
        ...position(pawn),
        alive: health > 0 && life === 0,
        health,
        yaw: angles[1]!,
        pitch: angles[0]!,
        money,
        armour,
        helmet,
        flash,
        ...inventory(pawn),
        weapon: weapon(pawn.values.get('m_pWeaponServices.m_hActiveWeapon')),
      }
      built.set(controller, {
        pawn,
        controllerRevision: controller.revision,
        pawnRevision: pawn.revision,
        weapons: weaponReads,
        snapshot,
      })
      weaponReads = undefined
      players.push(snapshot)
    }
    if (new Set(players.map((player) => player.steamId)).size !== players.length)
      throw new Error('The replay contains duplicate player identities.')
    return players.sort((a, b) => a.steamId.localeCompare(b.steamId))
  }
  function playerByUserId(id: number) {
    const steamId = store.user(id)
    if (!steamId) throw new Error('A replay event refers to an unknown player.')
    return steamId
  }
  return {
    playerByUserId,
    killerByUserId(id: number): ReplayDeath['killer'] {
      if (id === 65535 || (id === 0 && !store.user(0))) return { type: 'world' }
      return { type: 'player', steamId: playerByUserId(id) }
    },
    snapshots,
    bomb,
    playerByPawnHandle,
    droppedItems,
    projectiles,
    fires(): FireArea[] {
      const fires: FireArea[] = []
      for (const [id, entity] of view().infernos) {
        const count = entity.values.get('m_fireCount')
        if (typeof count !== 'number' || !Number.isInteger(count) || count < 0)
          throw new Error('Missing recorded fire cell count.')
        const positions: number[] = []
        for (let cell = 0; cell < count; cell++) {
          const burning = entity.values.get(`m_bFireIsBurning.${cell}`)
          if (typeof burning !== 'boolean') throw new Error('Missing recorded burning cell state.')
          if (!burning) continue
          const point = entity.values.get(`m_firePositions.${cell}`)
          if (!Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite))
            throw new Error('Missing recorded fire cell position.')
          positions.push(...point)
        }
        if (positions.length) fires.push({ entity: id, serial: entity.serial, positions })
      }
      return fires.sort((a, b) => a.entity - b.entity)
    },
    smokeEntities() {
      return view().smokeIds
    },
    gameRules() {
      const entity = view().gameRules
      if (!entity) return undefined
      const warmup = entity.values.get('m_pGameRules.m_bWarmupPeriod')
      const freezePeriod = entity.values.get('m_pGameRules.m_bFreezePeriod')
      const rounds = entity.values.get('m_pGameRules.m_totalRoundsPlayed')
      const started = entity.values.get('m_pGameRules.m_bHasMatchStarted')
      const reason = entity.values.get('m_pGameRules.m_eRoundWinReason')
      const phase = entity.values.get('m_pGameRules.m_gamePhase')
      const overtime = entity.values.get('m_pGameRules.m_nOvertimePlaying')
      const winner = entity.values.get('m_pGameRules.m_iRoundWinStatus')
      if (
        typeof warmup !== 'boolean' ||
        typeof freezePeriod !== 'boolean' ||
        typeof rounds !== 'number' ||
        typeof started !== 'boolean' ||
        typeof reason !== 'number' ||
        typeof phase !== 'number' ||
        typeof overtime !== 'number' ||
        overtime < 0
      )
        throw new Error('Missing recorded competitive round rules.')
      const scores = new Map<number, number>()
      const names = new Map<number, string>()
      for (const team of view().teams) {
        const side = team.values.get('m_iTeamNum')
        const score = team.values.get('m_iScore')
        if (typeof side === 'number' && typeof score === 'number') scores.set(side, score)
        const name = team.values.get('m_szClanTeamname')
        if (typeof side === 'number' && typeof name === 'string' && name.trim())
          names.set(side, name.trim())
      }
      const ct = scores.get(3)
      const t = scores.get(2)
      return {
        warmup,
        freezePeriod,
        totalRoundsPlayed: rounds,
        started,
        reason,
        phase,
        overtime,
        ...(winner === 2 || winner === 3
          ? { winner: winner === 3 ? ('ct' as const) : ('t' as const) }
          : {}),
        ...(ct !== undefined && t !== undefined ? { score: { ct, t } } : {}),
        ...(names.size ? { teamNames: { ct: names.get(3), t: names.get(2) } } : {}),
      }
    },
  }
}
