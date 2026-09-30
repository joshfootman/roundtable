import type { ProjectileSnapshot } from './entities/index.ts'
import type { GrenadeDetonation, ReplayProjectile } from '../replay/types.ts'

type Flight = Omit<ProjectileSnapshot, 'x' | 'y' | 'z'> & {
  startTick: number
  ticks: number[]
  positions: number[]
} & ({ status: 'flying' } | { status: 'ended'; endTick: number })

export function createProjectileCapture() {
  const flights = new Map<string, Flight>()
  function close(key: string, tick: number) {
    const flight = flights.get(key)
    if (flight?.status === 'flying') flights.set(key, { ...flight, status: 'ended', endTick: tick })
  }
  return {
    sample(tick: number, snapshots: ProjectileSnapshot[]) {
      const observed = new Set<string>()
      for (const snapshot of snapshots) {
        const key = `${snapshot.entity}:${snapshot.serial}`
        observed.add(key)
        let flight = flights.get(key)
        if (!flight) {
          const { x: _x, y: _y, z: _z, ...identity } = snapshot
          flight = { ...identity, status: 'flying', startTick: tick, ticks: [], positions: [] }
          flights.set(key, flight)
        }
        if (flight.status === 'ended') continue
        if (flight.ticks.at(-1) === tick) flight.positions.length -= 3
        else flight.ticks.push(tick)
        flight.positions.push(snapshot.x, snapshot.y, snapshot.z)
      }
      for (const key of flights.keys()) if (!observed.has(key)) close(key, tick)
    },
    detonate(event: GrenadeDetonation) {
      for (const [key, flight] of flights)
        if (flight.entity === event.entity) close(key, event.tick)
    },
    finish(endTick: number): ReplayProjectile[] {
      return [...flights.values()].map((flight) => ({
        entity: flight.entity,
        serial: flight.serial,
        kind: flight.kind,
        thrower: flight.thrower,
        startTick: flight.startTick,
        endTick: flight.status === 'ended' ? flight.endTick : endTick,
        ticks: Uint32Array.from(flight.ticks),
        positions: Float32Array.from(flight.positions),
      }))
    },
  }
}
