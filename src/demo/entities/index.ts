import { createCs2State, cs2Fields } from './cs2.ts'
import { createEntityStore } from './store.ts'

export type { PlayerSnapshot, ProjectileSnapshot } from './cs2.ts'

export function createEntityDecoder() {
  const store = createEntityStore(cs2Fields)
  return {
    sendTables: store.sendTables,
    classes: store.classes,
    serverInfo: store.serverInfo,
    tables: store.tables,
    createTable: store.createTable,
    clearTables: store.clearTables,
    updateTable: store.updateTable,
    packet: store.packet,
    ...createCs2State(store),
  }
}
